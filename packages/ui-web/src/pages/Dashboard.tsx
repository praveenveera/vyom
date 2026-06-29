import { useEffect, useState } from 'react';
import type { GarageBuildApiClient } from '../api/client';
import type { Workspace, PluginRecord } from '../api/types';

interface Props {
  client: GarageBuildApiClient;
}

const TYPE_PALETTE: Record<string, [string, string]> = {
  ai:         ['#4f46e5', '#eef2ff'],
  deployment: ['#0369a1', '#f0f9ff'],
  frontend:   ['#d97706', '#fffbeb'],
  testing:    ['#16a34a', '#f0fdf4'],
  storage:    ['#9333ea', '#faf5ff'],
};

function typeColor(type: string): [string, string] {
  return TYPE_PALETTE[type] ?? ['#475569', '#f1f5f9'];
}

const s = {
  pageTitle: { fontSize: 22, fontWeight: 700, color: '#0f172a', margin: '0 0 6px' },

  statusPill: (ok: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
    background: ok ? '#f0fdf4' : '#fef2f2',
    color: ok ? '#16a34a' : '#dc2626',
    border: `1px solid ${ok ? '#bbf7d0' : '#fecaca'}`,
  }),
  statusDot: (ok: boolean): React.CSSProperties => ({
    width: 7, height: 7, borderRadius: '50%',
    background: ok ? '#22c55e' : '#ef4444',
  }),

  infoBar: {
    display: 'flex', alignItems: 'center', gap: 16,
    marginBottom: 24, marginTop: 8,
  },
  infoSep: { color: '#e2e8f0', fontSize: 18 },
  infoText: { fontSize: 13, color: '#64748b' },
  infoValue: { color: '#475569', fontWeight: 600 },

  wsCard: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 1,
    background: '#e2e8f0',
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 28,
  },
  wsField: {
    background: '#fff',
    padding: '16px 20px',
  },
  wsLabel: {
    fontSize: 11, fontWeight: 700, color: '#94a3b8',
    textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 6,
  },
  wsValue: { fontSize: 15, fontWeight: 600, color: '#0f172a' },
  wsValueMono: { fontSize: 13, fontWeight: 600, color: '#0f172a', fontFamily: 'monospace' },

  sectionTitle: { fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 12 },
  pluginGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
    gap: 10,
  },
  pluginCard: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 10,
    padding: '14px 16px',
  },
  pluginTop: {
    display: 'flex', alignItems: 'flex-start',
    justifyContent: 'space-between', marginBottom: 10,
  },
  pluginIcon: (bg: string, color: string): React.CSSProperties => ({
    width: 34, height: 34, borderRadius: 8,
    background: bg, color,
    fontWeight: 700, fontSize: 15,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }),
  pluginStatusBadge: (ok: boolean): React.CSSProperties => ({
    padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
    background: ok ? '#f0fdf4' : '#fef2f2',
    color: ok ? '#16a34a' : '#dc2626',
  }),
  pluginName: { fontSize: 14, fontWeight: 600, color: '#0f172a', marginBottom: 2 },
  pluginVersion: { fontSize: 12, color: '#94a3b8' },
  typeBadge: (color: string, bg: string): React.CSSProperties => ({
    display: 'inline-block', padding: '2px 7px', borderRadius: 4,
    fontSize: 11, fontWeight: 700, color, background: bg, marginTop: 8,
  }),

  emptyPlugins: { color: '#94a3b8', fontSize: 14, padding: '32px 0', textAlign: 'center' as const },
  loadingText: { color: '#94a3b8', fontSize: 14 },
  errorCard: {
    background: '#fef2f2', border: '1px solid #fecaca',
    borderRadius: 10, padding: '16px 20px', color: '#b91c1c', fontSize: 13,
  },
  errorTitle: { fontWeight: 700, marginBottom: 4 },
  errorHint: { fontSize: 12, color: '#ef4444', marginTop: 6 },
};

export function Dashboard({ client }: Props) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [plugins, setPlugins] = useState<PluginRecord[]>([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    Promise.all([
      client.ping().then(ok => { if (mounted) setConnected(ok); }).catch(() => { if (mounted) setConnected(false); }),
      client.getWorkspace().then(ws => { if (mounted) setWorkspace(ws); }).catch((e: unknown) => { if (mounted) setError(e instanceof Error ? e.message : 'Failed to load workspace'); }),
      client.listPlugins().then(ps => { if (mounted) setPlugins(ps); }).catch(() => { if (mounted) setPlugins([]); }),
    ]).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [client]);

  if (loading) {
    return <p style={s.loadingText}>Connecting to GarageBuild engine…</p>;
  }

  if (error !== null && workspace === null) {
    return (
      <div style={s.errorCard}>
        <div style={s.errorTitle}>Cannot reach engine</div>
        {error}
        <div style={s.errorHint}>Make sure the server is running at localhost:3000</div>
      </div>
    );
  }

  return (
    <div>
      <h2 style={s.pageTitle}>{workspace?.name ?? 'GarageBuild Workspace'}</h2>

      <div style={s.infoBar}>
        <span style={s.statusPill(connected)}>
          <span style={s.statusDot(connected)} />
          {connected ? 'Engine Connected' : 'Engine Offline'}
        </span>
        {workspace && (
          <>
            <span style={s.infoSep}>·</span>
            <span style={s.infoText}>
              Owner: <span style={s.infoValue}>{workspace.owner}</span>
            </span>
            <span style={s.infoSep}>·</span>
            <span style={s.infoText}>
              Theme: <span style={s.infoValue}>{workspace.settings.theme}</span>
            </span>
          </>
        )}
      </div>

      {workspace && (
        <div style={s.wsCard}>
          <div style={s.wsField}>
            <div style={s.wsLabel}>Workspace ID</div>
            <div style={s.wsValueMono}>{workspace.id.slice(0, 8)}…</div>
          </div>
          <div style={s.wsField}>
            <div style={s.wsLabel}>Plugins Loaded</div>
            <div style={s.wsValue}>{plugins.length}</div>
          </div>
          <div style={s.wsField}>
            <div style={s.wsLabel}>Telemetry</div>
            <div style={s.wsValue}>{workspace.settings.telemetryEnabled ? 'Enabled' : 'Disabled'}</div>
          </div>
        </div>
      )}

      <div style={s.sectionTitle}>Loaded Plugins</div>
      {plugins.length === 0 ? (
        <div style={s.emptyPlugins}>No plugins loaded.</div>
      ) : (
        <div style={s.pluginGrid}>
          {plugins.map(p => {
            const [color, bg] = typeColor(p.type);
            return (
              <div key={p.id} style={s.pluginCard}>
                <div style={s.pluginTop}>
                  <div style={s.pluginIcon(bg, color)}>
                    {(p.name[0] ?? '?').toUpperCase()}
                  </div>
                  <span style={s.pluginStatusBadge(p.status === 'loaded')}>
                    {p.status}
                  </span>
                </div>
                <div style={s.pluginName}>{p.name}</div>
                <div style={s.pluginVersion}>v{p.version}</div>
                <div style={s.typeBadge(color, bg)}>{p.type}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
