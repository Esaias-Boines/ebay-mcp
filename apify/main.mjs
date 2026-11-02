/**
 * Apify Standby entry point: serves the eBay MCP server at /mcp and charges one
 * pay-per-event event per successful tool call (writes cost more than reads).
 */
import process from 'node:process';
import { Actor, log } from 'apify';
import express from 'express';
import { createHttpMcpApp, createHttpTransportConfigFromEnv } from '../build/mcp/httpTransport.js';
import { isReadOnlyTool } from '../build/mcp/readOnlyFilter.js';
import { resolveEbayConfigFromHeaders } from './sessionConfig.mjs';

const READ_EVENT = 'tool-call';
const WRITE_EVENT = 'write-tool-call';

await Actor.init();

const port = Number(process.env.ACTOR_STANDBY_PORT ?? process.env.ACTOR_WEB_SERVER_PORT ?? 3000);
const config = {
  ...createHttpTransportConfigFromEnv({ ...process.env, MCP_PATH: '/mcp', OAUTH_ENABLED: 'false' }),
  host: '0.0.0.0',
  port,
  // Apify Standby authenticates callers with their Apify token before requests reach us.
  authEnabled: false,
  staticAuthToken: undefined,
  sessionIdleTimeoutMs: Number(process.env.MCP_SESSION_IDLE_TIMEOUT_MS) || 30 * 60_000,
  serverInfo: {
    name: 'ebay-seller-mcp',
    title: 'eBay Seller MCP (hosted on Apify)',
    websiteUrl: 'https://apify.com',
  },
  resolveSessionEbayConfig: resolveEbayConfigFromHeaders,
  onToolCall: async ({ name, ok }) => {
    if (!ok) {
      return;
    }
    await Actor.charge({ eventName: isReadOnlyTool({ name }) ? READ_EVENT : WRITE_EVENT });
  },
};

const mcpApp = await createHttpMcpApp(config);
const app = express();
// Apify Standby readiness probe and a human-friendly landing response.
app.get('/', (_req, res) => {
  res
    .status(200)
    .type('text/plain')
    .send('eBay Seller MCP is running. Connect your MCP client to /mcp.');
});
app.use(mcpApp);

app.listen(port, '0.0.0.0', () => {
  log.info(`eBay Seller MCP listening on port ${port} at /mcp`);
});
