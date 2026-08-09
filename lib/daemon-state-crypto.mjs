/* HARDGATE — optional encrypted daemon state at rest (libsodium-style via Node AES-256-GCM). */
import fs from 'node:fs';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const ALGO = 'aes-256-gcm';

function deriveKey(passphrase, salt){
  return scryptSync(passphrase, salt, 32);
}

export function hgStateEncryptionEnabled(env){
  env = env || process.env;
  return !!(env.HARDGATE_STATE_ENCRYPTION_KEY || env.HARDGATE_STATE_PASSPHRASE);
}

export function hgEncryptStateJson(obj, env){
  env = env || process.env;
  var pass = env.HARDGATE_STATE_ENCRYPTION_KEY || env.HARDGATE_STATE_PASSPHRASE || '';
  if (!pass) return JSON.stringify(obj);
  var salt = randomBytes(16);
  var iv = randomBytes(12);
  var key = deriveKey(pass, salt);
  var cipher = createCipheriv(ALGO, key, iv);
  var plain = Buffer.from(JSON.stringify(obj), 'utf8');
  var enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  var tag = cipher.getAuthTag();
  return JSON.stringify({
    enc: true,
    v: 1,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: enc.toString('base64'),
  });
}

export function hgDecryptStateJson(raw, env){
  env = env || process.env;
  var pass = env.HARDGATE_STATE_ENCRYPTION_KEY || env.HARDGATE_STATE_PASSPHRASE || '';
  try{
    var j = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!j || !j.enc) return j;
    if (!pass) throw new Error('HARDGATE_STATE_ENCRYPTION_KEY required to decrypt');
    var salt = Buffer.from(j.salt, 'base64');
    var iv = Buffer.from(j.iv, 'base64');
    var tag = Buffer.from(j.tag, 'base64');
    var data = Buffer.from(j.data, 'base64');
    var key = deriveKey(pass, salt);
    var dec = createDecipheriv(ALGO, key, iv);
    dec.setAuthTag(tag);
    var plain = Buffer.concat([dec.update(data), dec.final()]);
    return JSON.parse(plain.toString('utf8'));
  }catch(e){
    return null;
  }
}

export function hgReadStateFile(filePath, env){
  if (!fs.existsSync(filePath)) return null;
  var raw = fs.readFileSync(filePath, 'utf8');
  try{
    var j = JSON.parse(raw);
    if (j && j.enc) return hgDecryptStateJson(j, env);
    return j;
  }catch(e){ return null; }
}

export function hgWriteStateFile(filePath, state, env){
  var out = hgStateEncryptionEnabled(env) ? hgEncryptStateJson(state, env) : JSON.stringify(state, null, 2) + '\n';
  fs.writeFileSync(filePath, out, 'utf8');
}
