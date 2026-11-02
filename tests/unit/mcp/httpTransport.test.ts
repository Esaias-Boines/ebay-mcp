import request from 'supertest';
import { describe, expect, it } from 'vitest';
import {
  createHttpMcpApp,
  createHttpTransportConfigFromEnv,
  getAuthServerMetadataUrl,
  getHttpServerUrl,
  type HttpTransportConfig,
  normalizeMcpPath,
} from '@/mcp/httpTransport.js';
import process from 'node:process';

function createTestConfig(overrides: Partial<HttpTransportConfig> = {}): HttpTransportConfig {
  return {
    authEnabled: false,
    ebayConfig: {
      clientId: 'client',
      clientSecret: 'secret',
      environment: 'sandbox',
    },
    host: '127.0.0.1',
    oauth: {
      authServerUrl: 'http://localhost:8080/realms/master',
      requiredScopes: ['mcp:tools'],
      useIntrospection: true,
    },
    port: 3000,
    projectRoot: process.cwd(),
    ...overrides,
  };
}

describe('HTTP MCP transport', () => {
  it('builds HTTP server and metadata URLs from config', () => {
    const config = createTestConfig();

    expect(getHttpServerUrl(config)).toBe('http://127.0.0.1:3000');
    expect(getAuthServerMetadataUrl(config)).toBe(
      'http://localhost:8080/realms/master/.well-known/openid-configuration',
    );

    expect(
      getAuthServerMetadataUrl({
        oauth: {
          ...config.oauth,
          authServerUrl: 'https://auth.example.test',
        },
      }),
    ).toBe('https://auth.example.test/.well-known/oauth-authorization-server');
  });

  it('creates config from env defaults and overrides', () => {
    const config = createHttpTransportConfigFromEnv({
      MCP_HOST: '0.0.0.0',
      MCP_PORT: '4444',
      OAUTH_ENABLED: 'false',
      OAUTH_REQUIRED_SCOPES: 'mcp:tools,mcp:admin',
    });

    expect(config.host).toBe('0.0.0.0');
    expect(config.port).toBe(4444);
    expect(config.authEnabled).toBe(false);
    expect(config.oauth.requiredScopes).toEqual(['mcp:tools', 'mcp:admin']);
  });

  it('binds 0.0.0.0 and uses PORT when only PORT is set', () => {
    const config = createHttpTransportConfigFromEnv({
      PORT: '8080',
    });

    expect(config.host).toBe('0.0.0.0');
    expect(config.port).toBe(8080);
  });

  it('lets MCP_HOST override the PORT-driven 0.0.0.0 default', () => {
    const config = createHttpTransportConfigFromEnv({
      PORT: '8080',
      MCP_HOST: '127.0.0.1',
    });

    expect(config.host).toBe('127.0.0.1');
    expect(config.port).toBe(8080);
  });

  it('prefers MCP_PORT over PORT', () => {
    const config = createHttpTransportConfigFromEnv({
      PORT: '8080',
      MCP_PORT: '4000',
    });

    expect(config.host).toBe('0.0.0.0');
    expect(config.port).toBe(4000);
  });

  it('reads staticAuthToken from MCP_AUTH_TOKEN', () => {
    const config = createHttpTransportConfigFromEnv({
      MCP_AUTH_TOKEN: 'deploy-secret',
    });

    expect(config.staticAuthToken).toBe('deploy-secret');
  });

  it('keeps health available without OAuth', async () => {
    const app = await createHttpMcpApp(createTestConfig());
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'healthy',
      oauth_enabled: false,
    });
    expect(response.body.timestamp).toEqual(expect.any(String));
  });

  it('rejects session requests without a valid MCP session id', async () => {
    const app = await createHttpMcpApp(createTestConfig());
    const response = await request(app).get('/');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'invalid_session',
      error_description: 'Invalid or missing session ID',
    });
  });

  it('rejects protected routes without the static bearer token', async () => {
    const app = await createHttpMcpApp(
      createTestConfig({
        staticAuthToken: 'deploy-secret',
      }),
    );

    const response = await request(app).get('/');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: 'unauthorized',
      error_description: 'Missing or invalid bearer token',
    });
  });

  it('accepts protected routes with the static bearer token', async () => {
    const app = await createHttpMcpApp(
      createTestConfig({
        staticAuthToken: 'deploy-secret',
      }),
    );

    // Health is unauthenticated; hit the MCP session route which uses auth middleware.
    // A valid bearer passes auth, then the handler still rejects missing session id.
    const response = await request(app).get('/').set('Authorization', 'Bearer deploy-secret');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'invalid_session',
      error_description: 'Invalid or missing session ID',
    });
  });

  it('keeps health unauthenticated when static bearer auth is enabled', async () => {
    const app = await createHttpMcpApp(
      createTestConfig({
        staticAuthToken: 'deploy-secret',
      }),
    );

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'healthy' });
  });

  it('normalizes MCP paths', () => {
    expect(normalizeMcpPath(undefined)).toBe('/');
    expect(normalizeMcpPath('')).toBe('/');
    expect(normalizeMcpPath('mcp/')).toBe('/mcp');
    expect(normalizeMcpPath('//v1/mcp')).toBe('/v1/mcp');
  });

  it('reads MCP_PATH and MCP_SESSION_IDLE_TIMEOUT_MS from env', () => {
    const config = createHttpTransportConfigFromEnv({
      MCP_PATH: 'mcp',
      MCP_SESSION_IDLE_TIMEOUT_MS: '900000',
    });

    expect(config.mcpPath).toBe('/mcp');
    expect(config.sessionIdleTimeoutMs).toBe(900_000);
    expect(createHttpTransportConfigFromEnv({}).sessionIdleTimeoutMs).toBeUndefined();
  });

  it('serves MCP on a custom path only', async () => {
    const app = await createHttpMcpApp(createTestConfig({ mcpPath: '/mcp' }));

    expect((await request(app).get('/mcp')).body).toMatchObject({ error: 'invalid_session' });
    expect((await request(app).get('/')).status).toBe(404);
  });

  describe('per-session eBay credentials', () => {
    const initialize = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' },
      },
    };

    it('rejects the session with 400 when the resolver throws', async () => {
      const app = await createHttpMcpApp(
        createTestConfig({
          resolveSessionEbayConfig: () => {
            throw new Error('Missing x-ebay-client-id header');
          },
        }),
      );

      const response = await request(app)
        .post('/')
        .set('Accept', 'application/json, text/event-stream')
        .send(initialize);

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('Missing x-ebay-client-id header');
    });

    it('builds the session from request headers and advertises overridden branding', async () => {
      const seen: (string | undefined)[] = [];
      const app = await createHttpMcpApp(
        createTestConfig({
          serverInfo: { name: 'hosted-ebay', title: 'Hosted eBay MCP' },
          resolveSessionEbayConfig: (req) => {
            const clientId = req.headers['x-ebay-client-id'];
            seen.push(typeof clientId === 'string' ? clientId : undefined);
            return {
              clientId: String(clientId),
              clientSecret: 'session-secret',
              environment: 'sandbox',
            };
          },
        }),
      );

      const response = await request(app)
        .post('/')
        .set('Accept', 'application/json, text/event-stream')
        .set('x-ebay-client-id', 'session-client')
        .send(initialize);

      expect(response.status).toBe(200);
      expect(response.headers['mcp-session-id']).toEqual(expect.any(String));
      expect(response.text).toContain('hosted-ebay');
      expect(seen).toEqual(['session-client']);
    });
  });
});
