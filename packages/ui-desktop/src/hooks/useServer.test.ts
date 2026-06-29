// ─────────────────────────────────────────────────────────────────────────────
// useServer tests — Tauri invoke mocked via vi.mock
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useServer } from './useServer';

// Hoist mock before any imports
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';
const mockInvoke = invoke as MockedFunction<typeof invoke>;

// Simulate Tauri runtime environment so safeInvoke doesn't short-circuit
Object.defineProperty(window, '__TAURI_INTERNALS__', {
  value: {},
  configurable: true,
  writable: true,
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function invokeReturns(value: unknown) {
  mockInvoke.mockResolvedValueOnce(value as never);
}

function invokeRejects(msg: string) {
  mockInvoke.mockRejectedValueOnce(new Error(msg) as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  // Do NOT use vi.useFakeTimers() here — @testing-library's waitFor relies
  // on real setTimeout for its polling and hangs with fake timers.
});

afterEach(() => {
  vi.useRealTimers(); // clean up if any test set up fake timers locally
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useServer', () => {
  it('calls get_server_status on mount and sets checking=false', async () => {
    invokeReturns(false);
    const { result } = renderHook(() => useServer());

    expect(result.current.checking).toBe(true);
    await waitFor(() => expect(result.current.checking).toBe(false));

    expect(mockInvoke).toHaveBeenCalledWith('get_server_status', undefined);
    expect(result.current.running).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('sets running=true when server is already running', async () => {
    invokeReturns(true);
    const { result } = renderHook(() => useServer());

    await waitFor(() => expect(result.current.checking).toBe(false));
    expect(result.current.running).toBe(true);
  });

  it('sets error when get_server_status invoke fails', async () => {
    invokeRejects('permission denied');
    const { result } = renderHook(() => useServer());

    await waitFor(() => expect(result.current.checking).toBe(false));
    expect(result.current.running).toBe(false);
    expect(result.current.error).toMatch(/permission denied/);
  });

  it('start calls start_server then refreshes status', async () => {
    // invoke call order: initial status → start_server → refresh after start
    mockInvoke
      .mockResolvedValueOnce(false as never)
      .mockResolvedValueOnce(undefined as never)
      .mockResolvedValueOnce(true as never);

    const { result } = renderHook(() => useServer());
    await waitFor(() => expect(result.current.checking).toBe(false));

    await act(async () => {
      await result.current.start('/usr/local/bin/garagebuild-server');
    });

    expect(mockInvoke).toHaveBeenCalledWith('start_server', { binPath: '/usr/local/bin/garagebuild-server' });
    expect(result.current.running).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('start sets error and rethrows when invoke fails', async () => {
    mockInvoke
      .mockResolvedValueOnce(false as never)
      .mockRejectedValueOnce(new Error('binary not found') as never);

    const { result } = renderHook(() => useServer());
    await waitFor(() => expect(result.current.checking).toBe(false));

    await act(async () => {
      await expect(result.current.start('/bad/path')).rejects.toThrow('binary not found');
    });

    expect(result.current.error).toMatch(/binary not found/);
  });

  it('stop calls stop_server then refreshes status', async () => {
    mockInvoke
      .mockResolvedValueOnce(true as never)    // initial status
      .mockResolvedValueOnce(undefined as never) // stop_server
      .mockResolvedValueOnce(false as never);   // refresh after stop

    const { result } = renderHook(() => useServer());
    await waitFor(() => expect(result.current.running).toBe(true));

    await act(async () => {
      await result.current.stop();
    });

    expect(mockInvoke).toHaveBeenCalledWith('stop_server', undefined);
    expect(result.current.running).toBe(false);
  });

  it('stop sets error and rethrows when invoke fails', async () => {
    mockInvoke
      .mockResolvedValueOnce(true as never)
      .mockRejectedValueOnce(new Error('kill failed') as never);

    const { result } = renderHook(() => useServer());
    await waitFor(() => expect(result.current.running).toBe(true));

    await act(async () => {
      await expect(result.current.stop()).rejects.toThrow('kill failed');
    });

    expect(result.current.error).toMatch(/kill failed/);
  });

  it('sets up a 5-second polling interval', async () => {
    const spy = vi.spyOn(globalThis, 'setInterval');
    invokeReturns(false);

    const { result } = renderHook(() => useServer());

    await waitFor(() => expect(result.current.checking).toBe(false));
    expect(spy).toHaveBeenCalledWith(expect.any(Function), 5_000);
    spy.mockRestore();
  });

  it('exposes manual refresh via the returned refresh function', async () => {
    mockInvoke
      .mockResolvedValueOnce(false as never) // initial
      .mockResolvedValueOnce(true as never);  // manual refresh

    const { result } = renderHook(() => useServer());
    await waitFor(() => expect(result.current.checking).toBe(false));

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.running).toBe(true);
  });

  it('clears error when subsequent invoke succeeds', async () => {
    mockInvoke
      .mockRejectedValueOnce(new Error('network error') as never) // initial fails
      .mockResolvedValueOnce(true as never);  // manual refresh succeeds

    const { result } = renderHook(() => useServer());
    await waitFor(() => expect(result.current.checking).toBe(false));
    expect(result.current.error).not.toBeNull();

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.running).toBe(true);
  });
});
