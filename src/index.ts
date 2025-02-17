const HTML_REDIRECT_PAGE = (target: string) => `<!DOCTYPE html>
<html>
<head>
  <title>Redirecting...</title>
  <script>
    window.location.replace("${target}");
  </script>
</head>
<body>
  <p>Redirecting... <noscript>If the page does not redirect automatically, please <a href="${target}">click here</a>.</noscript></p>
</body>
</html>`;

const redirect = (target: string, htmlRedirect: boolean): Response => {
  if (htmlRedirect) {
    return new Response(HTML_REDIRECT_PAGE(target), {
      headers: { 'Content-Type': 'text/html;charset=UTF-8' },
    });
  } else {
    return Response.redirect(target, 302);
  }
};

const generateRandomString = (length: number = 6): string => {
  const chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const GET = async (request: Request, env: Env, ctx: ExecutionContext): Promise<Response> => {
  const url = new URL(request.url);
  const path = url.pathname.substring(1);

  const defaultUrl = env.DEFAULT_URL;
  const htmlRedirect = env.HTML_REDIRECT ?? false;
  const kv = env.KV_NAMESPACE_BINDING;

  if (!path) {
    return redirect(defaultUrl, htmlRedirect);
  }

  try {
    const target = await kv.get(path);
    if (target) {
      return redirect(target, htmlRedirect);
    } else {
      console.warn(`Target URL not found for path ${path}, redirecting to default URL.`);
      return redirect(defaultUrl, htmlRedirect);
    }
  } catch (error: any) {
    console.error('Unexpected error with Worker (GET): ', error);
    return new Response('Internal Server Error', { status: 500 });
  }
};

const POST = async (request: Request, env: Env, ctx: ExecutionContext): Promise<Response> => {
  const url = new URL(request.url);
  const kv = env.KV_NAMESPACE_BINDING;
  const apiToken = env.API_TOKEN;

  if (!apiToken) {
    console.error('API_TOKEN not configured for POST requests.');
    return new Response('Internal Server Error', { status: 500 });
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.warn('Unauthorized POST request: Missing or invalid Authorization header.');
    return new Response('Unauthorized', { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } });
  }
  const token = authHeader.substring(7);
  if (token !== apiToken) {
    console.warn('Unauthorized POST request: Invalid API token.');
    return new Response('Unauthorized', { status: 401, headers: { 'WWW-Authenticate': 'Bearer' }});
  }

  try {
    let body;
    try {
      body = await request.json<{ url?: string }>();
    } catch (error: any) {
      console.warn('Bad POST request: Empty or invalid JSON request body.');
      return new Response('Bad Request: Empty or invalid JSON request body', { status: 400 });
    }
    
    const urlToShorten = body?.url;

    if (!urlToShorten) {
      console.warn('Bad POST request: Missing "url" in request body.');
      return new Response('Bad Request: Missing "url" in request body', { status: 400 });
    }
    try {
      new URL(urlToShorten);
    } catch {
      console.warn('Bad POST request: Invalid URL format in request body.');
      return new Response('Bad Request: Invalid URL format in request body', { status: 400 });
    }

    let shortPath;
    let attempts = 0;
    const MAX_ATTEMPTS = 10;

    do {
      shortPath = generateRandomString();
      const existingUrl = await kv.get(shortPath);
      if (!existingUrl) break; // found a unique path
      attempts++;
      if (attempts >= MAX_ATTEMPTS) {
        console.error('Failed to generate unique short path after multiple attempts.');
        return new Response('Internal Server Error', { status: 500 });
      }
    } while (true);

    await kv.put(shortPath, urlToShorten);
    
    const shortUrl = new URL(`/${shortPath}`, url).href;

    return new Response(JSON.stringify({ short: shortUrl, original: urlToShorten }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error processing POST request: ', error);
    return new Response('Internal Server Error', { status: 500 });
  }
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const method = request.method.toUpperCase();
    const kv = env.KV_NAMESPACE_BINDING;
    const defaultUrl = env.DEFAULT_URL;

    if (!kv) {
      console.error('KV namespace binding not configured.');
      return new Response('Internal Server Error', { status: 500 });
    }
    if (!defaultUrl) {
      console.error('Default redirect url not configured.');
      return new Response('Internal Server Error', { status: 500 });
    }

    const handlers: { [key: string]: (request: Request, env: Env, ctx: ExecutionContext) => Promise<Response> } = {
      'GET': GET,
      'POST': POST,
    };

    const handler = handlers[method];

    if (handler) {
      return handler(request, env, ctx);
    } else {
      return new Response('Method Not Allowed', { status: 405, headers: { 'Allow': 'GET, POST' } });
    }
  },
} satisfies ExportedHandler<Env>;
