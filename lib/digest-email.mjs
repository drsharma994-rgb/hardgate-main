/* HARDGATE — LP digest email delivery (Resend, SendGrid, SMTP). Zero npm deps. */
import net from 'node:net';
import tls from 'node:tls';

export function digestEmailTo(){
  return String(process.env.LP_DIGEST_EMAIL_TO || '')
    .split(',')
    .map(function(s){ return s.trim(); })
    .filter(Boolean);
}

export function digestEmailFrom(){
  return process.env.LP_DIGEST_EMAIL_FROM
    || process.env.SMTP_FROM
    || process.env.RESEND_FROM
    || '';
}

function smtpConfigReady(){
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && digestEmailFrom());
}

export function digestEmailReady(){
  if (!digestEmailTo().length) return false;
  if (process.env.RESEND_API_KEY && digestEmailFrom()) return true;
  if (process.env.SENDGRID_API_KEY && digestEmailFrom()) return true;
  return smtpConfigReady();
}

function encodeMimeHeader(s){
  return String(s || '').replace(/\r?\n/g, ' ');
}

export function buildMimeMessage(from, toList, subject, text, html){
  var boundary = 'hg_' + Date.now().toString(36);
  var lines = [
    'From: ' + encodeMimeHeader(from),
    'To: ' + toList.map(encodeMimeHeader).join(', '),
    'Subject: ' + encodeMimeHeader(subject),
    'MIME-Version: 1.0',
    'Content-Type: multipart/alternative; boundary="' + boundary + '"',
    '',
    '--' + boundary,
    'Content-Type: text/plain; charset=utf-8',
    '',
    String(text || ''),
    '--' + boundary,
    'Content-Type: text/html; charset=utf-8',
    '',
    String(html || ''),
    '--' + boundary + '--',
    '',
  ];
  return lines.join('\r\n');
}

async function sendViaResend(from, toList, subject, text, html){
  var key = process.env.RESEND_API_KEY || '';
  if (!key) return { ok: false, skipped: true, reason: 'no RESEND_API_KEY' };
  try{
    var res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: from,
        to: toList,
        subject: subject,
        html: html,
        text: text,
      }),
    });
    var body = '';
    try{ body = await res.text(); }catch(e){}
    return { ok: res.ok, status: res.status, response: body.slice(0, 200) };
  }catch(e){
    return { ok: false, reason: (e && e.message) || 'resend error' };
  }
}

async function sendViaSendGrid(from, toList, subject, text, html){
  var key = process.env.SENDGRID_API_KEY || '';
  if (!key) return { ok: false, skipped: true, reason: 'no SENDGRID_API_KEY' };
  try{
    var res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: toList.map(function(e){ return { email: e }; }) }],
        from: { email: from },
        subject: subject,
        content: [
          { type: 'text/plain', value: text },
          { type: 'text/html', value: html },
        ],
      }),
    });
    return { ok: res.ok || res.status === 202, status: res.status };
  }catch(e){
    return { ok: false, reason: (e && e.message) || 'sendgrid error' };
  }
}

function readSmtpResponse(socket){
  return new Promise(function(resolve, reject){
    var buf = '';
    function onData(chunk){
      buf += chunk.toString('utf8');
      if (buf.indexOf('\r\n') >= 0){
        socket.removeListener('data', onData);
        socket.removeListener('error', reject);
        resolve(buf.trim());
      }
    }
    socket.on('data', onData);
    socket.on('error', reject);
  });
}

function smtpWrite(socket, line){
  return new Promise(function(resolve, reject){
    socket.write(line + '\r\n', function(err){
      if (err) reject(err);
      else readSmtpResponse(socket).then(resolve).catch(reject);
    });
  });
}

function smtpCode(resp){
  var m = String(resp || '').match(/^(\d{3})/);
  return m ? +m[1] : 0;
}

async function sendViaSmtp(from, toList, subject, text, html){
  if (!smtpConfigReady()) return { ok: false, skipped: true, reason: 'smtp not configured' };
  var host = process.env.SMTP_HOST;
  var port = +(process.env.SMTP_PORT || 587);
  var user = process.env.SMTP_USER;
  var pass = process.env.SMTP_PASS;
  var secure = process.env.SMTP_SECURE === 'true' || port === 465;
  var message = buildMimeMessage(from, toList, subject, text, html);

  return new Promise(function(resolve){
  function fail(reason){ resolve({ ok: false, reason: reason }); }

  function run(socket){
    var step = 0;
    socket.setEncoding('utf8');
    socket.on('error', function(e){ fail((e && e.message) || 'smtp socket error'); });

    readSmtpResponse(socket).then(async function(greet){
      if (smtpCode(greet) !== 220){ return fail('smtp greet: ' + greet); }
      try{
        var ehlo = await smtpWrite(socket, 'EHLO hardgate.local');
        if (smtpCode(ehlo) !== 250) return fail('smtp ehlo: ' + ehlo);

        if (!secure && ehlo.toUpperCase().indexOf('STARTTLS') >= 0){
          var st = await smtpWrite(socket, 'STARTTLS');
          if (smtpCode(st) !== 220) return fail('smtp starttls: ' + st);
          var tlsSock = tls.connect({ socket: socket, servername: host });
          tlsSock.on('error', function(e){ fail((e && e.message) || 'tls error'); });
          await new Promise(function(r){ tlsSock.once('secureConnect', r); });
          socket = tlsSock;
          socket.setEncoding('utf8');
          ehlo = await smtpWrite(socket, 'EHLO hardgate.local');
          if (smtpCode(ehlo) !== 250) return fail('smtp ehlo2: ' + ehlo);
        }

        var au = await smtpWrite(socket, 'AUTH LOGIN');
        if (smtpCode(au) !== 334) return fail('smtp auth: ' + au);
        var u = await smtpWrite(socket, Buffer.from(user, 'utf8').toString('base64'));
        if (smtpCode(u) !== 334) return fail('smtp user: ' + u);
        var p = await smtpWrite(socket, Buffer.from(pass, 'utf8').toString('base64'));
        if (smtpCode(p) !== 235) return fail('smtp pass: ' + p);

        var mf = await smtpWrite(socket, 'MAIL FROM:<' + from + '>');
        if (smtpCode(mf) !== 250) return fail('smtp mail from: ' + mf);
        for (var i = 0; i < toList.length; i++){
          var rc = await smtpWrite(socket, 'RCPT TO:<' + toList[i] + '>');
          if (smtpCode(rc) !== 250 && smtpCode(rc) !== 251) return fail('smtp rcpt: ' + rc);
        }
        var dt = await smtpWrite(socket, 'DATA');
        if (smtpCode(dt) !== 354) return fail('smtp data: ' + dt);
        socket.write(message.replace(/\n\./g, '\n..') + '\r\n.\r\n');
        var done = await readSmtpResponse(socket);
        await smtpWrite(socket, 'QUIT').catch(function(){});
        socket.end();
        resolve({ ok: smtpCode(done) === 250, status: smtpCode(done), response: done });
      }catch(e){
        try{ socket.end(); }catch(e2){}
        fail((e && e.message) || 'smtp error');
      }
    }).catch(fail);
  }

  if (secure){
    var s = tls.connect(port, host, { servername: host }, function(){ run(s); });
    s.on('error', function(e){ fail((e && e.message) || 'tls connect error'); });
  } else {
    var n = net.connect(port, host, function(){ run(n); });
    n.on('error', function(e){ fail((e && e.message) || 'net connect error'); });
  }
  });
}

export async function sendDigestEmail(subject, text, html){
  var toList = digestEmailTo();
  var from = digestEmailFrom();
  if (!toList.length) return { ok: false, skipped: true, reason: 'no LP_DIGEST_EMAIL_TO' };
  if (!from) return { ok: false, skipped: true, reason: 'no LP_DIGEST_EMAIL_FROM' };

  if (process.env.RESEND_API_KEY){
    return Object.assign({ provider: 'resend' }, await sendViaResend(from, toList, subject, text, html));
  }
  if (process.env.SENDGRID_API_KEY){
    return Object.assign({ provider: 'sendgrid' }, await sendViaSendGrid(from, toList, subject, text, html));
  }
  if (smtpConfigReady()){
    return Object.assign({ provider: 'smtp' }, await sendViaSmtp(from, toList, subject, text, html));
  }
  return { ok: false, skipped: true, reason: 'no email provider configured' };
}
