// Gates /results.html behind HTTP Basic Auth so only the admin can see
// submissions. Credentials come from Netlify environment variables
// (PROJECT_EMAIL / PROJECT_PASSWORD) — set them in Site settings >
// Environment variables with scope "Functions", or in a local .env for
// `netlify dev`. Never commit the actual values.

export default async (request, context) => {
  const expectedUser = Netlify.env.get('PROJECT_EMAIL');
  const expectedPass = Netlify.env.get('PROJECT_PASSWORD');

  if (!expectedUser || !expectedPass) {
    return new Response(
      'Admin credentials are not configured (PROJECT_EMAIL / PROJECT_PASSWORD).',
      { status: 500 }
    );
  }

  const authHeader = request.headers.get('authorization') || '';
  const [scheme, encoded] = authHeader.split(' ');

  if (scheme === 'Basic' && encoded) {
    try {
      const decoded = atob(encoded);
      const sep = decoded.indexOf(':');
      const user = decoded.slice(0, sep);
      const pass = decoded.slice(sep + 1);

      if (user === expectedUser && pass === expectedPass) {
        return context.next();
      }
    } catch {
      // fall through to 401 on malformed header
    }
  }

  return new Response('Authentication required.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Results"',
    },
  });
};

export const config = { path: ['/results.html', '/results'] };
