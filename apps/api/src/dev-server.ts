import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { resolveCheckoutBaseUrl } from '@airexpay/configuration';
import { createApp } from './app.ts';
import { MemoryDatabase } from './db/memory.ts';

const port = Number(process.env.PORT ?? 8787);
const environment = process.env.ENVIRONMENT ?? 'dev';
const app = createApp({
  db: new MemoryDatabase(),
  environment,
  allowedModesRaw: process.env.ALLOWED_MODES ?? 'mock',
  modeAEnv: process.env.NOWPAYMENTS_MODE_A_ENABLED ?? 'false',
  ipnSecret: process.env.SIMULATION_IPN_SECRET,
  checkoutBaseUrl: resolveCheckoutBaseUrl(environment, process.env.PUBLIC_CHECKOUT_BASE_URL),
});

const server = createServer((req, res) => {
  void handle(req, res);
});

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const host = req.headers.host ?? `127.0.0.1:${port}`;
  const url = `http://${host}${req.url ?? '/'}`;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const body = Buffer.concat(chunks);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    headers.set(key, Array.isArray(value) ? value.join(', ') : value);
  }
  const request = new Request(url, {
    method: req.method,
    headers,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
  });
  const response = await app.fetch(request);
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  res.end(Buffer.from(await response.arrayBuffer()));
}

server.listen(port, '127.0.0.1', () => {
  console.log(`AirExpay simulation API listening on http://127.0.0.1:${port}`);
});
