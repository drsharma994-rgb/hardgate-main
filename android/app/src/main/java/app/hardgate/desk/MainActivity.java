package app.hardgate.desk;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * Thin launcher over the live HARDGATE desk. The SPA is the product;
 * this Activity is a full-screen WebView with no browser chrome.
 * Deploys to Render show up on next launch — no APK rebuild.
 */
public class MainActivity extends Activity {
    static final String HOME = "https://hardgate-main.onrender.com/";

    private WebView desk;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        desk = findViewById(R.id.desk);
        wire(desk);
        if (savedInstanceState != null) desk.restoreState(savedInstanceState);
        else desk.loadUrl(HOME);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (desk != null) desk.saveState(outState);
    }

    @Override
    public void onBackPressed() {
        if (desk != null && desk.canGoBack()) desk.goBack();
        else super.onBackPressed();
    }

    @SuppressWarnings("SetJavaScriptEnabled")
    private void wire(WebView web) {
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setUserAgentString(s.getUserAgentString() + " HARDGATE-Android");

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(web, false);

        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                if (req == null || req.getUrl() == null) return true;
                return !stayInside(req.getUrl()) && openOutside(req.getUrl());
            }
        });
    }

    /** Same-origin desk stays in the WebView. Everything else (mailto, Play, docs) leaves. */
    static boolean stayInside(Uri uri) {
        if (uri == null) return false;
        String scheme = uri.getScheme() == null ? "" : uri.getScheme();
        String host = uri.getHost() == null ? "" : uri.getHost();
        if (!"https".equalsIgnoreCase(scheme)) return false;
        return "hardgate-main.onrender.com".equalsIgnoreCase(host);
    }

    private boolean openOutside(Uri uri) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (Exception e) {
            return false;
        }
        return true;
    }
}
