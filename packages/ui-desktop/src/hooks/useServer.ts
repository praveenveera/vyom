// ─────────────────────────────────────────────────────────────────────────────
// useServer — manages the embedded GarageBuild server process via Tauri invoke
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface ServerState {
  running: boolean;
  checking: boolean;
  error: string | null;
  start: (binPath: string) => Promise<void>;
  stop: () => Promise<void>;
  refresh: () => Promise<void>;
}

// Tauri invoke is unavailable in browser dev mode — fall back gracefully
async function safeInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (typeof window !== 'undefined' && !('__TAURI_INTERNALS__' in window)) {
    throw new Error('Tauri not available — running in browser mode');
  }
  return invoke<T>(cmd, args);
}

export function useServer(): ServerState {
  const [running, setRunning] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const status = await safeInvoke<boolean>('get_server_status');
      setRunning(status);
      setError(null);
    } catch (err) {
      setRunning(false);
      // Silently ignore Tauri-not-available errors in browser dev mode
      if (err instanceof Error && err.message.includes('Tauri not available')) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => { void refresh(); }, 5_000);
    return () => clearInterval(interval);
  }, [refresh]);

  const start = useCallback(async (binPath: string): Promise<void> => {
    setError(null);
    try {
      await safeInvoke<void>('start_server', { binPath });
      await refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      throw err;
    }
  }, [refresh]);

  const stop = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      await safeInvoke<void>('stop_server');
      await refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      throw err;
    }
  }, [refresh]);

  return { running, checking, error, start, stop, refresh };
}
