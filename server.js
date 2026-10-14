const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const { getSupabaseConfig } = require('./supabase-config');

const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const PUBLIC_FILES = new Map([
  ['/index.html', ['public/index.html', 'text/html; charset=utf-8']],
  ['/script.js', ['public/script.js', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['public/styles.css', 'text/css; charset=utf-8']]
]);

async function loadEnvFile() {
  let contents;
  try {
    contents = await fs.readFile(path.join(ROOT, '.env'), 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }

  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!match || match[1] in process.env) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, '').trim();
    }
    process.env[match[1]] = value;
  }
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  response.end(JSON.stringify(body));
}

async function serveStatic(response, pathname) {
  const file = PUBLIC_FILES.get(pathname === '/' ? '/index.html' : pathname);
  if (!file) {
    sendJson(response, 404, { error: 'Not found.' });
    return;
  }
  const [filename, contentType] = file;
  const content = await fs.readFile(path.join(ROOT, filename));
  response.writeHead(200, {
    'Content-Type': contentType,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-cache'
  });
  response.end(content);
}

async function start() {
  await loadEnvFile();
  const server = http.createServer(async (request, response) => {
    let url;
    try {
      url = new URL(request.url, `http://${HOST}:${PORT}`);
    } catch {
      sendJson(response, 400, { error: 'Invalid request URL.' });
      return;
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.setHeader('Allow', 'GET, HEAD');
      sendJson(response, 405, { error: 'Method not allowed.' });
      return;
    }

    try {
      if (url.pathname === '/api/config') {
        sendJson(response, 200, getSupabaseConfig());
        return;
      }
      await serveStatic(response, decodeURIComponent(url.pathname));
    } catch (error) {
      if (error instanceof URIError) {
        sendJson(response, 400, { error: 'Invalid URL path.' });
        return;
      }
      if (error.code === 'ENOENT') {
        sendJson(response, 404, { error: 'Not found.' });
        return;
      }
      console.error('Request failed:', error);
      sendJson(response, 500, { error: 'The local app server could not complete the request.' });
    }
  });

  server.listen(PORT, HOST, () => {
    const config = getSupabaseConfig();
    console.log(`Janaseva eSurvey is running at http://${HOST}:${PORT}`);
    console.log(config.configured
      ? 'Supabase configuration found. Sign in to use cloud surveys.'
      : 'Supabase is not configured. Copy .env.example to .env and add your project settings.');
  });
}

start().catch((error) => {
  console.error('Could not start the eSurvey server:', error);
  process.exitCode = 1;
});
