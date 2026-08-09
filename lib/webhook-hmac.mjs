/* HARDGATE — webhook HMAC verification (Tink/libsodium pattern via Node crypto). */
import { createHmac, timingSafeEqual } from 'node:crypto';

export function hgWebhookSign(body, secret, version){
  version = version || process.env.HARDGATE_WEBHOOK_KEY_VERSION || 'v1';
  var key = secret || process.env.BOOK_EXECUTE_FILL_SECRET || process.env.HARDGATE_WEBHOOK_SECRET || '';
  if (!key) return null;
  var payload = typeof body === 'string' ? body : JSON.stringify(body || {});
  var sig = createHmac('sha256', key).update(version + '.' + payload).digest('hex');
  return version + '=' + sig;
}

export function hgWebhookVerify(body, header, secret){
  if (!header) return false;
  var key = secret || process.env.BOOK_EXECUTE_FILL_SECRET || process.env.HARDGATE_WEBHOOK_SECRET || '';
  if (!key) return false;
  var parts = String(header).split('=');
  if (parts.length < 2) return false;
  var version = parts[0];
  var got = parts.slice(1).join('=');
  var expect = hgWebhookSign(body, key, version);
  if (!expect) return false;
  var expSig = expect.split('=').slice(1).join('=');
  try{
    var A = Buffer.from(got, 'hex');
    var B = Buffer.from(expSig, 'hex');
    if (A.length !== B.length) return false;
    return timingSafeEqual(A, B);
  }catch(e){ return false; }
}

/** Support rotated secrets: HARDGATE_WEBHOOK_SECRET_PREVIOUS */
export function hgWebhookVerifyAny(body, header){
  if (hgWebhookVerify(body, header, process.env.BOOK_EXECUTE_FILL_SECRET || process.env.HARDGATE_WEBHOOK_SECRET)) return true;
  if (process.env.HARDGATE_WEBHOOK_SECRET_PREVIOUS
      && hgWebhookVerify(body, header, process.env.HARDGATE_WEBHOOK_SECRET_PREVIOUS)) return true;
  return false;
}
