import { describe, expect, it, vi } from 'vitest';
import { Effect } from 'effect';

type ToolCallback = (args: Record<string, unknown>) => Promise<{ isError?: boolean }>;

const registered = vi.hoisted(() => new Map<string, ToolCallback>());

vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: vi.fn(function (this: unknown) {
    return {
      registerTool: vi.fn((name: string, _config: unknown, callback: ToolCallback) => {
        registered.set(name, callback);
        return { update: vi.fn(), disable: vi.fn() };
      }),
      registerResource: vi.fn(),
      server: { oninitialized: undefined, getClientCapabilities: () => ({}) },
    };
  }),
}));

vi.mock('@/tools/registry.js', () => ({
  getToolEntries: () => [
    {
      definition: { name: 'fake_ok', description: 'ok', inputSchema: {} },
      handler: async () => ({ items: [] }),
    },
    {
      definition: { name: 'fake_fail', description: 'fails', inputSchema: {} },
      handler: async () => {
        throw new Error('eBay said no');
      },
    },
  ],
}));

describe('MCP runtime onToolCall', () => {
  it('reports successful and failed tool calls without changing results', async () => {
    const { createEbayMcpRuntime } = await import('@/mcp/runtime.js');
    const events: unknown[] = [];
    createEbayMcpRuntime({
      api: { initialize: () => Effect.succeed(undefined) } as never,
      onToolCall: (event) => {
        events.push(event);
      },
    });

    const ok = await registered.get('fake_ok')?.({});
    const failed = await registered.get('fake_fail')?.({});

    expect(ok?.isError).toBeUndefined();
    expect(failed?.isError).toBe(true);
    expect(events).toEqual([
      { name: 'fake_ok', ok: true, durationMs: expect.any(Number) },
      { name: 'fake_fail', ok: false, durationMs: expect.any(Number) },
    ]);
  });

  it('swallows observer failures', async () => {
    const { createEbayMcpRuntime } = await import('@/mcp/runtime.js');
    createEbayMcpRuntime({
      api: { initialize: () => Effect.succeed(undefined) } as never,
      onToolCall: () => {
        throw new Error('billing down');
      },
    });

    await expect(registered.get('fake_ok')?.({})).resolves.toMatchObject({
      content: [expect.objectContaining({ type: 'text' })],
    });
  });
});
