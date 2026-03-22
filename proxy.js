// Simple CORS Proxy Server for OpenAI-compatible APIs
// Usage: node proxy.js
// Then set API Endpoint in the app to: http://localhost:3456/proxy

const http = require('http');
const https = require('https');
const { URL } = require('url');

const PORT = 3456;

const server = http.createServer((req, res) => {
  // CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Only handle POST /proxy
  if (req.method !== 'POST' || !req.url.startsWith('/proxy')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'CORS Proxy running',
      usage: 'POST /proxy with JSON body containing "endpoint" and "payload" fields',
      example: {
        endpoint: 'https://api.deepseek.com/v1/chat/completions',
        headers: { 'Authorization': 'Bearer sk-xxx' },
        payload: { model: 'deepseek-chat', messages: [{ role: 'user', content: 'Hi' }] }
      }
    }));
    return;
  }

  // Read request body
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    try {
      const { endpoint, headers: customHeaders, payload } = JSON.parse(body);

      if (!endpoint) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'Missing "endpoint" field' } }));
        return;
      }

      const url = new URL(endpoint);
      const postData = JSON.stringify(payload);

      const options = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          ...customHeaders,
        },
      };

      const proxyReq = https.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, {
          'Content-Type': proxyRes.headers['content-type'] || 'application/json',
          'Access-Control-Allow-Origin': '*',
        });
        proxyRes.pipe(res);
      });

      proxyReq.on('error', (e) => {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: `Proxy error: ${e.message}` } }));
      });

      proxyReq.write(postData);
      proxyReq.end();

    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: `Invalid request: ${e.message}` } }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`\n🚀 CORS Proxy Server running at http://localhost:${PORT}`);
  console.log(`\n   Set your API Endpoint in the app to:`);
  console.log(`   → http://localhost:${PORT}/proxy\n`);
});
