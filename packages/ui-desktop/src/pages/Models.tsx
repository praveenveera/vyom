import { useEffect, useState } from 'react';
import type { GarageBuildApiClient } from '../api/client';
import type { ModelConfig } from '../api/types';

interface Props {
  client: GarageBuildApiClient;
}

export function Models({ client }: Props) {
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ provider: '', modelName: '', apiKey: '' });

  const load = () => {
    client.listModels().then(setModels).catch((e: unknown) => {
      setError(e instanceof Error ? e.message : 'Failed to load models');
    });
  };

  useEffect(load, [client]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.provider.trim() === '' || form.modelName.trim() === '') return;
    setAdding(true);
    try {
      await client.addModel({
        provider: form.provider.trim(),
        modelName: form.modelName.trim(),
        ...(form.apiKey.trim() !== '' && { apiKey: form.apiKey.trim() }),
      });
      setForm({ provider: '', modelName: '', apiKey: '' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add model');
    } finally {
      setAdding(false);
    }
  };

  const handleActivate = (id: string) => {
    client.activateModel(id).then(load).catch((e: unknown) => {
      setError(e instanceof Error ? e.message : 'Failed to activate model');
    });
  };

  const handleRemove = (id: string) => {
    client.removeModel(id).then(load).catch((e: unknown) => {
      setError(e instanceof Error ? e.message : 'Failed to remove model');
    });
  };

  return (
    <div>
      <h2>AI Models</h2>
      {error !== null && <p style={{ color: '#ef4444' }}>{error}</p>}

      <form onSubmit={(e) => { void handleAdd(e); }} style={{ marginBottom: 24, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input placeholder="Provider (e.g. openai)" value={form.provider}
          onChange={(e) => setForm(f => ({ ...f, provider: e.target.value }))}
          style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, flex: '1 1 140px' }} required />
        <input placeholder="Model (e.g. gpt-4o)" value={form.modelName}
          onChange={(e) => setForm(f => ({ ...f, modelName: e.target.value }))}
          style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, flex: '2 1 180px' }} required />
        <input type="password" placeholder="API key (optional)" value={form.apiKey}
          onChange={(e) => setForm(f => ({ ...f, apiKey: e.target.value }))}
          style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, flex: '1 1 160px' }} />
        <button type="submit" disabled={adding}
          style={{ padding: '6px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
          {adding ? 'Adding…' : 'Add Model'}
        </button>
      </form>

      {models.length === 0
        ? <p style={{ color: '#9ca3af' }}>No models configured.</p>
        : models.map((m) => (
          <div key={m.id} style={{ border: `1px solid ${m.isActive ? '#2563eb' : '#e5e7eb'}`, borderRadius: 8, padding: '12px 16px', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <strong>{m.displayName}</strong>
              <span style={{ marginLeft: 8, fontSize: 12, color: '#6b7280' }}>{m.provider}/{m.modelName}</span>
              {m.isActive && <span style={{ marginLeft: 8, fontSize: 11, background: '#dbeafe', color: '#1d4ed8', padding: '2px 6px', borderRadius: 4 }}>Active</span>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {!m.isActive && <button onClick={() => handleActivate(m.id)} style={{ padding: '4px 10px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>Activate</button>}
              <button onClick={() => handleRemove(m.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 18 }} title="Remove">×</button>
            </div>
          </div>
        ))
      }
    </div>
  );
}
