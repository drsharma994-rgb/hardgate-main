#!/usr/bin/env python3
"""HARDGATE <-> TradingAgents bridge — run the Tauric multi-agent pipeline for XAUUSD.

WHAT THIS IS, AND WHAT IT DELIBERATELY IS NOT

TradingAgents (TauricResearch) is a Python LangGraph application whose agents
are LLM-driven. HARDGATE is a classic-script browser app. The two cannot call
each other, so this file is the seam: stdin/argv in, ONE JSON object on
stdout, every log line on stderr.

It runs the pipeline the repo actually ships, for the instrument this desk
trades:

    market analyst -> social analyst -> news analyst -> fundamentals analyst
      -> bull researcher <-> bear researcher (debate)
      -> research manager -> trader
      -> aggressive <-> conservative <-> neutral risk debators
      -> portfolio manager -> final rating

XAUUSD is a first-class symbol there: tradingagents.dataflows.symbol_utils
maps it to Yahoo's COMEX front-month future GC=F, because gold has no spot
forex pair on Yahoo. That mapping is the vendor's, not ours — we pass the
broker symbol the desk uses and let the library resolve it, so we cannot
drift from its table.

WHAT IT RETURNS, AND WHAT IT REFUSES TO INVENT

The pipeline's output is a FIVE-TIER RATING (Buy / Overweight / Hold /
Underweight / Sell) plus each agent's prose report. It is NOT an entry, a
stop or a target — TradingAgents does not produce levels and this bridge
does not manufacture them. Pricing the view into a trade is HARDGATE's job,
done in tauric.js against the same plan layer and the same gates every other
gold card goes through. A view is not a trade until something has priced it
and something has judged it.

Three ways this can fail and they are NOT the same thing, so they are
reported separately rather than as one error string:

    install    the package or its venv is not importable here
    key        no LLM provider key is set, so no agent can think
    vendor     the market-data host is unreachable (in this sandbox every
               one of them answers 403 to CONNECT at the gateway)

--preflight answers all three WITHOUT constructing the graph, so the tab can
say precisely what is missing before anyone spends a token on a run.

Usage:
    tauric-bridge.py --preflight
    tauric-bridge.py --run [--symbol XAUUSD] [--date YYYY-MM-DD]
                           [--analysts market,social,news,fundamentals]
                           [--depth 1]
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import traceback
from datetime import date as _date

# Every provider key TradingAgents reads, in the order its own README lists
# them. Presence of ANY ONE is enough for the pipeline to think; which one is
# chosen is the library's business (llm_provider), not ours.
PROVIDER_KEYS = (
    ("OPENAI_API_KEY", "openai"),
    ("ANTHROPIC_API_KEY", "anthropic"),
    ("GOOGLE_API_KEY", "google"),
    ("XAI_API_KEY", "xai"),
    ("DEEPSEEK_API_KEY", "deepseek"),
    ("DASHSCOPE_API_KEY", "dashscope"),
    ("DASHSCOPE_CN_API_KEY", "dashscope_cn"),
    ("ZHIPU_API_KEY", "zhipu"),
    ("ZHIPU_CN_API_KEY", "zhipu_cn"),
    ("MINIMAX_API_KEY", "minimax"),
    ("MINIMAX_CN_API_KEY", "minimax_cn"),
    ("OPENROUTER_API_KEY", "openrouter"),
    ("MISTRAL_API_KEY", "mistral"),
    ("MOONSHOT_API_KEY", "moonshot"),
    ("GROQ_API_KEY", "groq"),
    ("NVIDIA_API_KEY", "nvidia"),
)

# The report keys the graph leaves on its final state. Listed rather than
# discovered so a rename upstream shows up as a MISSING report in the tab
# instead of silently dropping an agent's work off the card.
REPORT_KEYS = (
    ("market_report", "Market Analyst"),
    ("sentiment_report", "Social / Sentiment Analyst"),
    ("news_report", "News Analyst"),
    ("fundamentals_report", "Fundamentals Analyst"),
    ("investment_plan", "Research Manager"),
    ("trader_investment_plan", "Trader"),
    ("final_trade_decision", "Portfolio Manager"),
)


def _emit(obj: dict) -> None:
    """One JSON object on stdout, nothing else, ever."""
    json.dump(obj, sys.stdout, ensure_ascii=False, default=str)
    sys.stdout.write("\n")
    sys.stdout.flush()


def _keys_present() -> list:
    """Provider keys that are set to something real.

    A placeholder ('', 'your-key-here', 'sk-...') is NOT a key. .env.example
    ships every name with an empty value and users copy it wholesale, so
    treating 'present in environ' as 'usable' would report a ready pipeline
    that fails on the first call.
    """
    out = []
    for env_name, provider in PROVIDER_KEYS:
        raw = (os.environ.get(env_name) or "").strip()
        if not raw:
            continue
        low = raw.lower()
        if low.startswith("your") or low in {"...", "none", "null", "changeme"}:
            continue
        if len(raw) < 8:
            continue
        out.append({"env": env_name, "provider": provider})
    return out


def _resolve_symbol(symbol: str) -> dict:
    """What the vendor will actually ask for. Never our own guess."""
    try:
        from tradingagents.dataflows.symbol_utils import normalize_symbol
        return {"input": symbol, "vendor": normalize_symbol(symbol), "by": "symbol_utils"}
    except Exception as exc:  # noqa: BLE001 — reported, not swallowed
        return {"input": symbol, "vendor": None, "by": None, "error": str(exc)}


def _probe_vendor(symbol: str) -> dict:
    """Can the configured market-data vendor actually be reached?

    Deliberately a REAL fetch of a couple of days rather than a socket test:
    a gateway that answers 403 to CONNECT, an expired token and a delisted
    symbol are three different failures and only a real call tells them
    apart. Cheap, keyless, and it is the same path the market analyst takes.
    """
    res = _resolve_symbol(symbol)
    if not res.get("vendor"):
        return {"ok": False, "reason": "symbol did not resolve", "detail": res.get("error")}
    try:
        import yfinance as yf
        hist = yf.Ticker(res["vendor"]).history(period="5d")
        rows = int(len(hist))
        if rows <= 0:
            return {"ok": False, "reason": "vendor returned no rows",
                    "vendor_symbol": res["vendor"],
                    "detail": "reachable, but empty for this symbol and window"}
        last = hist["Close"].iloc[-1]
        return {"ok": True, "vendor_symbol": res["vendor"], "rows": rows,
                "last_close": float(last),
                "last_date": str(hist.index[-1].date())}
    except Exception as exc:  # noqa: BLE001
        msg = str(exc)
        blocked = ("CONNECT tunnel failed" in msg or "403" in msg
                   or "Failed to perform" in msg or "Max retries" in msg)
        return {"ok": False,
                "reason": "gateway or network blocked the vendor" if blocked else "vendor call failed",
                "vendor_symbol": res["vendor"],
                "blocked": bool(blocked),
                "detail": msg[:400]}


def preflight(symbol: str) -> dict:
    """Everything the tab needs to decide what to say, spending nothing.

    No graph is constructed and no LLM is contacted: building the graph
    instantiates a provider client, and a preflight that costs tokens is a
    preflight nobody runs.
    """
    out = {"ok": False, "stage": "preflight", "symbol": symbol}

    try:
        import tradingagents  # noqa: F401
        from tradingagents.default_config import DEFAULT_CONFIG
        out["install"] = {"ok": True, "python": sys.version.split()[0]}
        out["config"] = {
            "llm_provider": DEFAULT_CONFIG.get("llm_provider"),
            "deep_think_llm": DEFAULT_CONFIG.get("deep_think_llm"),
            "quick_think_llm": DEFAULT_CONFIG.get("quick_think_llm"),
            "data_vendors": DEFAULT_CONFIG.get("data_vendors"),
        }
    except Exception as exc:  # noqa: BLE001
        out["install"] = {"ok": False, "error": str(exc)[:400]}
        out["blocked"] = "install"
        return out

    keys = _keys_present()
    out["keys"] = {"ok": bool(keys), "providers": [k["provider"] for k in keys],
                   "env_names": [k["env"] for k in keys]}

    out["symbol_map"] = _resolve_symbol(symbol)
    out["vendor"] = _probe_vendor(symbol)

    if not keys:
        out["blocked"] = "key"
    elif not out["vendor"].get("ok"):
        out["blocked"] = "vendor"
    else:
        out["ok"] = True
    return out


def run(symbol: str, trade_date: str, analysts: tuple, depth: int) -> dict:
    """The full pipeline, or an honest account of why it did not run."""
    pre = preflight(symbol)
    if not pre.get("ok"):
        pre["stage"] = "run"
        pre["ran"] = False
        return pre

    from tradingagents.default_config import DEFAULT_CONFIG
    from tradingagents.graph.trading_graph import TradingAgentsGraph

    config = DEFAULT_CONFIG.copy()
    config["max_debate_rounds"] = max(1, int(depth))
    config["max_risk_discuss_rounds"] = max(1, int(depth))

    out = {"ok": False, "stage": "run", "ran": False, "symbol": symbol,
           "trade_date": trade_date, "analysts": list(analysts),
           "symbol_map": pre.get("symbol_map"), "vendor": pre.get("vendor"),
           "config": pre.get("config")}

    try:
        graph = TradingAgentsGraph(selected_analysts=analysts, debug=False, config=config)
        # asset_type stays "stock": TradingAgents' crypto pipeline is for
        # BTC-style pairs, and gold reaches the vendor as a COMEX future,
        # which its stock path already handles. Passing "crypto" would route
        # a metal through on-chain tooling that has nothing to say about it.
        final_state, signal = graph.propagate(symbol, trade_date, asset_type="stock")
    except Exception as exc:  # noqa: BLE001
        out["error"] = str(exc)[:1200]
        out["traceback"] = traceback.format_exc()[-2000:]
        out["blocked"] = "run"
        return out

    reports = {}
    missing = []
    for key, label in REPORT_KEYS:
        val = final_state.get(key) if hasattr(final_state, "get") else None
        if val:
            reports[key] = {"label": label, "text": str(val)}
        else:
            missing.append({"key": key, "label": label})

    debate = final_state.get("investment_debate_state") or {}
    risk = final_state.get("risk_debate_state") or {}

    out.update({
        "ok": True,
        "ran": True,
        "signal": signal,
        "reports": reports,
        "missing_reports": missing,
        "debate": {
            "bull": str(debate.get("bull_history") or "") or None,
            "bear": str(debate.get("bear_history") or "") or None,
            "judge": str(debate.get("judge_decision") or "") or None,
        },
        "risk": {
            "aggressive": str(risk.get("aggressive_history") or "") or None,
            "conservative": str(risk.get("conservative_history") or "") or None,
            "neutral": str(risk.get("neutral_history") or "") or None,
            "judge": str(risk.get("judge_decision") or "") or None,
        },
    })
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="HARDGATE bridge to TradingAgents")
    ap.add_argument("--preflight", action="store_true")
    ap.add_argument("--run", action="store_true")
    ap.add_argument("--symbol", default="XAUUSD")
    ap.add_argument("--date", default=_date.today().isoformat())
    ap.add_argument("--analysts", default="market,social,news,fundamentals")
    ap.add_argument("--depth", type=int, default=1)
    args = ap.parse_args()

    analysts = tuple(a.strip() for a in args.analysts.split(",") if a.strip())

    try:
        if args.run:
            _emit(run(args.symbol, args.date, analysts, args.depth))
        else:
            _emit(preflight(args.symbol))
    except Exception as exc:  # noqa: BLE001 — a crash is still one JSON object
        _emit({"ok": False, "stage": "bridge", "blocked": "bridge",
               "error": str(exc)[:800], "traceback": traceback.format_exc()[-2000:]})
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
