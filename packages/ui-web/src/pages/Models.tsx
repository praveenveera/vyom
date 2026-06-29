import { useEffect, useState } from 'react';
import type { GarageBuildApiClient } from '../api/client';
import type { ModelConfig } from '../api/types';

interface Props {
  client: GarageBuildApiClient;
}

const PROVIDERS = [
  {
    id: 'openai',
    name: 'OpenAI',
    color: '#10a37f',
    bg: '#f0fdf4',
    border: '#bbf7d0',
    desc: 'GPT-4o, o1, o3 mini',
    suggestions: ['gpt-4o', 'gpt-4o-mini', 'o1-mini'],
    requiresKey: true,
    requiresUrl: false,
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    color: '#d97706',
    bg: '#fffbeb',
    border: '#fde68a',
    desc: 'Claude Sonnet, Opus, Haiku',
    suggestions: ['claude-sonnet-4-6', 'claude-opus-4-8', 'claude-haiku-4-5-20251001'],
    requiresKey: true,
    requiresUrl: false,
  },
  {
    id: 'ollama',
    name: 'Ollama',
    color: '#6366f1',
    bg: '#eef2ff',
    border: '#c7d2fe',
    desc: 'Local models · free · private',
    suggestions: ['llama3.2', 'mistral', 'deepseek-r1:7b'],
    requiresKey: false,
    requiresUrl: true,
  },
] as const;

type ProviderId = (typeof PROVIDERS)[number]['id'];

function providerInfo(id: string | null) {
  return PROVIDERS.find(p => p.id === id) ?? null;
}

function modelDotColor(m: ModelConfig) {
  const p = providerInfo(m.provider);
  return m.isActive ? (p?.color ?? '#6366f1') : '#cbd5e1';
}

const s = {
  pageTitle: { fontSize: 22, fontWeight: 700, color: '#0f172a', margin: '0 0 4px' },
  pageSubtitle: { fontSize: 14, color: '#64748b', marginTop: 4, marginBottom: 28 },

  providerGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 12,
    marginBottom: 20,
  },
  providerCard: (sel: boolean, color: string, bg: string, border: string): React.CSSProperties => ({
    padding: '16px 18px',
    borderRadius: 12,
    border: `2px solid ${sel ? color : border}`,
    background: sel ? bg : '#fff',
    cursor: 'pointer',
    textAlign: 'left',
  }),
  providerIcon: (color: string): React.CSSProperties => ({
    width: 36, height: 36, borderRadius: 8,
    background: color, color: '#fff',
    fontWeight: 700, fontSize: 16,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  }),
  providerName: { fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 2 },
  providerDesc: { fontSize: 12, color: '#64748b' },

  formCard: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    padding: '20px 24px',
    marginBottom: 28,
  },
  formTitle: { fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 16 },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 },
  fieldLabel: {
    display: 'block', fontSize: 11, fontWeight: 700,
    color: '#64748b', textTransform: 'uppercase' as const,
    letterSpacing: '0.06em', marginBottom: 5,
  },
  input: {
    width: '100%', padding: '8px 12px',
    border: '1px solid #e2e8f0', borderRadius: 8,
    fontSize: 13, color: '#0f172a', background: '#f8fafc',
    boxSizing: 'border-box' as const, outline: 'none',
    fontFamily: 'inherit',
  },
  suggestions: { display: 'flex', gap: 5, flexWrap: 'wrap' as const, marginTop: 6 },
  suggBtn: (active: boolean): React.CSSProperties => ({
    padding: '2px 8px', borderRadius: 4, fontSize: 11,
    border: `1px solid ${active ? '#a5b4fc' : '#e2e8f0'}`,
    background: active ? '#eef2ff' : '#f8fafc',
    color: active ? '#4f46e5' : '#64748b',
    cursor: 'pointer',
  }),
  addBtn: (disabled: boolean): React.CSSProperties => ({
    padding: '9px 22px', borderRadius: 8, border: 'none',
    background: disabled ? '#cbd5e1' : '#6366f1',
    color: '#fff', fontSize: 14, fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
  }),

  sectionTitle: { fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 12 },
  modelCard: (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px', marginBottom: 8,
    borderRadius: 10,
    border: `1px solid ${active ? '#a5b4fc' : '#e2e8f0'}`,
    background: active ? '#eef2ff' : '#fff',
  }),
  modelLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  modelDot: (color: string): React.CSSProperties => ({
    width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0,
  }),
  modelName: { fontSize: 14, fontWeight: 600, color: '#0f172a' },
  modelMeta: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  badge: (color: string, bg: string): React.CSSProperties => ({
    display: 'inline-block', padding: '2px 7px', borderRadius: 4,
    fontSize: 11, fontWeight: 700, color, background: bg, marginLeft: 6,
  }),
  modelActions: { display: 'flex', gap: 8, alignItems: 'center' },
  activateBtn: {
    padding: '5px 12px', fontSize: 12, fontWeight: 600,
    border: '1px solid #a5b4fc', borderRadius: 6,
    background: '#fff', color: '#4f46e5', cursor: 'pointer',
  },
  removeBtn: {
    width: 28, height: 28, border: 'none', borderRadius: 6,
    background: '#fef2f2', color: '#dc2626',
    cursor: 'pointer', fontSize: 14, display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center',
  },
  emptyState: {
    padding: '40px 0', textAlign: 'center' as const,
    color: '#94a3b8', fontSize: 14, lineHeight: 1.7 as const,
  },
  errorBanner: {
    background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
    padding: '10px 14px', fontSize: 13, color: '#b91c1c',
    marginBottom: 16, display: 'flex', justifyContent: 'space-between',
    alignItems: 'center',
  },
  dismissBtn: {
    border: 'none', background: 'none',
    cursor: 'pointer', color: '#b91c1c', fontSize: 16,
  },
};

export function Models({ client }: Props) {
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<ProviderId | null>(null);
  const [form, setForm] = useState({
    modelName: '', displayName: '', apiKey: '',
    baseUrl: 'http://localhost:11434',
  });

  const load = () => {
    client
      .listModels()
      .then(setModels)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load models'));
  };

  useEffect(load, [client]);

  const info = providerInfo(selected);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || form.modelName.trim() === '') return;
    setAdding(true);
    try {
      await client.addModel({
        provider: selected,
        modelName: form.modelName.trim(),
        ...(form.displayName.trim() !== '' && { displayName: form.displayName.trim() }),
        ...(info?.requiresKey && form.apiKey.trim() !== '' && { apiKey: form.apiKey.trim() }),
        ...(info?.requiresUrl && form.baseUrl.trim() !== '' && { baseUrl: form.baseUrl.trim() }),
      });
      setForm({ modelName: '', displayName: '', apiKey: '', baseUrl: 'http://localhost:11434' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add model');
    } finally {
      setAdding(false);
    }
  };

  const handleActivate = async (id: string) => {
    try {
      await client.activateModel(id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to activate model');
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await client.removeModel(id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove model');
    }
  };

  return (
    <div>
      <h2 style={s.pageTitle}>AI Models</h2>
      <p style={s.pageSubtitle}>Configure providers and models for your workspace.</p>

      {error !== null && (
        <div style={s.errorBanner}>
          <span>{error}</span>
          <button style={s.dismissBtn} onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* Provider picker */}
      <div style={s.providerGrid}>
        {PROVIDERS.map(p => (
          <button
            key={p.id}
            onClick={() => setSelected(sel => sel === p.id ? null : p.id)}
            style={s.providerCard(selected === p.id, p.color, p.bg, p.border)}
          >
            <div style={s.providerIcon(p.color)}>{p.name[0]}</div>
            <div style={s.providerName}>{p.name}</div>
            <div style={s.providerDesc}>{p.desc}</div>
          </button>
        ))}
      </div>

      {/* Add model form */}
      {selected !== null && info !== null && (
        <div style={s.formCard}>
          <div style={s.formTitle}>Add {info.name} Model</div>
          <form onSubmit={(e) => { void handleAdd(e); }}>
            <div style={s.formGrid}>
              <div>
                <label style={s.fieldLabel}>Model Name *</label>
                <input
                  value={form.modelName}
                  onChange={e => setForm(f => ({ ...f, modelName: e.target.value }))}
                  placeholder={info.suggestions[0] ?? 'model-name'}
                  style={s.input}
                  required
                />
                <div style={s.suggestions}>
                  {info.suggestions.map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, modelName: m }))}
                      style={s.suggBtn(form.modelName === m)}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={s.fieldLabel}>Display Name</label>
                <input
                  value={form.displayName}
                  onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                  placeholder="Friendly name (optional)"
                  style={s.input}
                />
              </div>
              {info.requiresKey && (
                <div>
                  <label style={s.fieldLabel}>API Key</label>
                  <input
                    type="password"
                    value={form.apiKey}
                    onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))}
                    placeholder="sk-…"
                    style={s.input}
                  />
                </div>
              )}
              {info.requiresUrl && (
                <div>
                  <label style={s.fieldLabel}>Ollama Base URL</label>
                  <input
                    value={form.baseUrl}
                    onChange={e => setForm(f => ({ ...f, baseUrl: e.target.value }))}
                    placeholder="http://localhost:11434"
                    style={s.input}
                  />
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={adding || form.modelName.trim() === ''}
              style={s.addBtn(adding || form.modelName.trim() === '')}
            >
              {adding ? 'Adding…' : 'Add Model'}
            </button>
          </form>
        </div>
      )}

      {/* Model list */}
      <div style={s.sectionTitle}>Configured Models ({models.length})</div>
      {models.length === 0 ? (
        <div style={s.emptyState}>
          No models configured yet.<br />
          Select a provider above to add your first model.
        </div>
      ) : (
        models.map(m => (
          <div key={m.id} style={s.modelCard(m.isActive)}>
            <div style={s.modelLeft}>
              <div style={s.modelDot(modelDotColor(m))} />
              <div>
                <div style={s.modelName}>
                  {m.displayName}
                  {m.isActive && <span style={s.badge('#4f46e5', '#eef2ff')}>Active</span>}
                  {m.isLocal && <span style={s.badge('#15803d', '#dcfce7')}>Local</span>}
                </div>
                <div style={s.modelMeta}>{m.provider} · {m.modelName}</div>
              </div>
            </div>
            <div style={s.modelActions}>
              {!m.isActive && (
                <button onClick={() => { void handleActivate(m.id); }} style={s.activateBtn}>
                  Set Active
                </button>
              )}
              <button
                onClick={() => { void handleRemove(m.id); }}
                style={s.removeBtn}
                title="Remove model"
              >
                ×
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
