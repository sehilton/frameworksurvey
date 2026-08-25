// Gates /results.html behind a login form (instead of the browser's native
// HTTP Basic Auth popup, which some managed/corporate browsers silently
// block). Renders its own login page, and on success sets a signed,
// stateless session cookie — no database needed, just an HMAC signature
// checked on every subsequent request.
//
// Env vars (Netlify Site settings > Environment variables, scope
// "Functions"; a local .env works for `netlify dev`):
//   PROJECT_EMAIL / PROJECT_PASSWORD — the admin login.
//   SESSION_SECRET (optional but recommended) — key used to sign session
//     cookies. Falls back to PROJECT_PASSWORD if unset.
// Never put these in client-side code.

const COOKIE_NAME = 'ff_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

const encoder = new TextEncoder();

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmacSign(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return bytesToBase64Url(new Uint8Array(signature));
}

async function createSessionToken(secret) {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const signature = await hmacSign(secret, String(expiresAt));
  return `${expiresAt}.${signature}`;
}

async function verifySessionToken(secret, token) {
  if (!token) return false;
  const dotIndex = token.indexOf('.');
  if (dotIndex <= 0) return false;

  const expiresAt = token.slice(0, dotIndex);
  const signature = token.slice(dotIndex + 1);

  if (Number(expiresAt) < Math.floor(Date.now() / 1000)) return false;

  const expectedSignature = await hmacSign(secret, expiresAt);
  return signature === expectedSignature;
}

function getCookie(request, name) {
  const header = request.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

function loginPage({ error = '', redirectTo = '/results.html' } = {}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Framework Feedback — Admin Login</title>
<link rel="stylesheet" href="/style.css" />
</head>
<body>
<main class="sheet" style="max-width:420px;">
  <div class="title-block">
    <div class="title-block__main">
      <div class="title-block__eyebrow">Restricted</div>
      <h1 class="title-block__title">Admin Login</h1>
    </div>
  </div>
  <form class="form-body" method="POST" action="/results.html" novalidate>
    <input type="hidden" name="redirectTo" value="${escapeHtml(redirectTo)}" />
    ${error ? `<div class="status-banner status-banner--error">${escapeHtml(error)}</div>` : ''}
    <div class="field">
      <label for="email">Email</label>
      <input type="email" id="email" name="email" autocomplete="username" required />
    </div>
    <div class="field">
      <label for="password">Password</label>
      <input type="password" id="password" name="password" autocomplete="current-password" required />
    </div>
    <div class="actions">
      <button type="submit" class="btn">Log in</button>
    </div>
  </form>
</main>
</body>
</html>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default async (request, context) => {
  const expectedUser = Netlify.env.get('PROJECT_EMAIL');
  const expectedPass = Netlify.env.get('PROJECT_PASSWORD');
  const sessionSecret = Netlify.env.get('SESSION_SECRET') || expectedPass;

  if (!expectedUser || !expectedPass) {
    return new Response(
      'Admin credentials are not configured (PROJECT_EMAIL / PROJECT_PASSWORD).',
      { status: 500 }
    );
  }

  const url = new URL(request.url);

  if (url.pathname === '/logout') {
    return new Response(null, {
      status: 303,
      headers: {
        Location: '/results.html',
        'Set-Cookie': `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
      },
    });
  }

  if (request.method === 'POST') {
    const form = await request.formData();
    const email = String(form.get('email') || '');
    const password = String(form.get('password') || '');
    const requestedRedirect = String(form.get('redirectTo') || '/results.html');
    // only allow same-site relative paths, never an absolute/protocol-relative URL
    const redirectTo = requestedRedirect.startsWith('/') && !requestedRedirect.startsWith('//')
      ? requestedRedirect
      : '/results.html';

    if (email === expectedUser && password === expectedPass) {
      const token = await createSessionToken(sessionSecret);
      return new Response(null, {
        status: 303,
        headers: {
          Location: redirectTo,
          'Set-Cookie': `${COOKIE_NAME}=${token}; Path=/; Max-Age=${SESSION_TTL_SECONDS}; HttpOnly; Secure; SameSite=Lax`,
        },
      });
    }

    return new Response(loginPage({ error: 'Incorrect email or password.', redirectTo }), {
      status: 401,
      headers: { 'Content-Type': 'text/html; charset=UTF-8' },
    });
  }

  const sessionToken = getCookie(request, COOKIE_NAME);
  if (await verifySessionToken(sessionSecret, sessionToken)) {
    return context.next();
  }

  return new Response(loginPage({ redirectTo: url.pathname }), {
    status: 401,
    headers: { 'Content-Type': 'text/html; charset=UTF-8' },
  });
};

export const config = { path: ['/results.html', '/results', '/logout'] };
