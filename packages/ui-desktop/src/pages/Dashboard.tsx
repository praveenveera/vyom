import { useEffect, useState } from 'react';
import type { GarageBuildApiClient } from '../api/client';
import type { Workspace, PluginRecord } from '../api/types';
import { StatusBadge } from '../components/StatusBadge';

interface Props {
  client: GarageBuildApiClient;
}

export function Dashboard({ client }: Props) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [plugins, setPlugins] = useState<PluginRecord[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    client.ping().then(setConnected).catch(() => setConnected(false));
    client.getWorkspace().then(setWorkspace).catch((e: unknown) => {
      setError(e instanceof Error ? e.message : 'Failed to load workspace');
    });
    client.listPlugins().then(setPlugins).catch(() => setPlugins([]));
  }, [client]);

  if (error !== null) return <p style={{ color: '#ef4444' }}>Error: {error}</p>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>{workspace?.name ?? '…'}</h2>
        <StatusBadge connected={connected} />
      </div>
      {workspace !== null && <p style={{ color: '#6b7280', marginTop: 0 }}>Owner: {workspace.owner}</p>}

      <h3>Loaded Plugins</h3>
      {plugins.length === 0 ? (
        <p style={{ color: '#9ca3af' }}>No plugins loaded.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
              <th style={{ padding: '4px 8px' }}>Plugin</th>
              <th style={{ padding: '4px 8px' }}>Type</th>
              <th style={{ padding: '4px 8px' }}>Version</th>
              <th style={{ padding: '4px 8px' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {plugins.map((p) => (
              <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '4px 8px' }}>{p.name}</td>
                <td style={{ padding: '4px 8px', color: '#6b7280' }}>{p.type}</td>
                <td style={{ padding: '4px 8px', color: '#6b7280' }}>{p.version}</td>
                <td style={{ padding: '4px 8px', color: p.status === 'loaded' ? '#22c55e' : '#ef4444' }}>{p.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
