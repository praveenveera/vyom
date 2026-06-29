import { useState } from 'react';
import type { ServerState } from '../hooks/useServer';

interface Props {
  server: ServerState;
}

const DEFAULT_BIN = '/usr/local/bin/garagebuild-server';

export function ServerControls({ server }: Props) {
  const [binPath, setBinPath] = useState(DEFAULT_BIN);
  const [busy, setBusy] = useState(false);

  const handleStart = async () => {
    setBusy(true);
    try {
      await server.start(binPath);
    } finally {
      setBusy(false);
    }
  };

  const handleStop = async () => {
    setBusy(true);
    try {
      await server.stop();
    } finally {
      setBusy(false);
    }
  };

  const statusColor = server.checking ? '#f59e0b' : server.running ? '#22c55e' : '#6b7280';
  const statusText = server.checking ? 'Checking…' : server.running ? 'Running' : 'Stopped';

  return (
    <div
      style={{
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
        marginBottom: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor, display: 'inline-block' }} />
        <span style={{ fontSize: 13, fontWeight: 500 }}>GarageBuild Server: {statusText}</span>
      </div>

      {server.error !== null && (
        <span style={{ fontSize: 12, color: '#ef4444' }}>{server.error}</span>
      )}

      {!server.running && !server.checking && (
        <>
          <input
            value={binPath}
            onChange={(e) => setBinPath(e.target.value)}
            placeholder="Path to garagebuild-server binary"
            style={{ padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 12, flex: '1 1 220px' }}
          />
          <button
            onClick={() => { void handleStart(); }}
            disabled={busy}
            style={{ padding: '4px 12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
          >
            {busy ? 'Starting…' : 'Start Server'}
          </button>
        </>
      )}

      {server.running && (
        <button
          onClick={() => { void handleStop(); }}
          disabled={busy}
          style={{ padding: '4px 12px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
        >
          {busy ? 'Stopping…' : 'Stop Server'}
        </button>
      )}
    </div>
  );
}
