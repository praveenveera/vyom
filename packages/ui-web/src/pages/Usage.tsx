import { useEffect, useState } from 'react';
import type { GarageBuildApiClient } from '../api/client';
import type { UsageSummary, ProviderUsage, Project } from '../api/types';

interface Props {
  client: GarageBuildApiClient;
}

// ── Formatting helpers ────────────────────────────────────────────────────────

function fmtCost(usd: number): string {
  if (usd === 0) return '$0.00';
  if (usd < 0.001) return `$${usd.toFixed(6)}`;
  if (usd < 0.01)  return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(4)}`;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  section: { marginBottom: 32 },
  sectionTitle: { fontSize: 15, fontWeight: 600, color: '#1e293b', marginBottom: 12 },
  cards: { display: 'flex', gap: 16, flexWrap: 'wrap' as const, marginBottom: 8 },
  card: {
    flex: '1 1 160px',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: 10,
    padding: '16px 20px',
  },
  cardLabel: { fontSize: 12, color: '#64748b', fontWeight: 500, marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: '0.04em' },
  cardValue: { fontSize: 26, fontWeight: 700, color: '#1e293b' },
  cardSub: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 14 },
  th: { textAlign: 'left' as const, padding: '8px 12px', background: '#f1f5f9', color: '#475569', fontWeight: 600, fontSize: 12, borderBottom: '1px solid #e2e8f0' },
  td: { padding: '9px 12px', borderBottom: '1px solid #f1f5f9', color: '#1e293b' },
  tdMuted: { padding: '9px 12px', borderBottom: '1px solid #f1f5f9', color: '#94a3b8' },
  badge: (local: boolean): React.CSSProperties => ({
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
    background: local ? '#dcfce7' : '#eff6ff',
    color: local ? '#16a34a' : '#2563eb',
  }),
  empty: { padding: '48px 0', textAlign: 'center' as const, color: '#94a3b8', fontSize: 14, lineHeight: 1.7 },
  error: { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#b91c1c', marginBottom: 16 },
  refreshBtn: {
    float: 'right' as const,
    padding: '4px 12px',
    border: '1px solid #e2e8f0',
    borderRadius: 6,
    background: '#fff',
    color: '#475569',
    cursor: 'pointer',
    fontSize: 13,
  },
  projectRow: { display: 'flex', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid #f1f5f9', fontSize: 14 },
  projectName: { color: '#1e293b', fontWeight: 500 },
  projectCost: { color: '#475569', fontFamily: 'monospace' },
};

// ── Component ─────────────────────────────────────────────────────────────────

interface ProjectCost {
  project: Project;
  summary: UsageSummary;
}

export function Usage({ client }: Props) {
  const [workspace, setWorkspace]     = useState<UsageSummary | null>(null);
  const [projectCosts, setProjectCosts] = useState<ProjectCost[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [wsSummary, projects] = await Promise.all([
        client.getWorkspaceCost(),
        client.listProjects(),
      ]);
      setWorkspace(wsSummary);

      const costs = await Promise.all(
        projects.map(async p => ({
          project: p,
          summary: await client.getProjectCost(p.id),
        })),
      );
      setProjectCosts(costs.filter(c => c.summary.totalTokens > 0));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  if (loading) {
    return <div style={s.empty}>Loading usage data…</div>;
  }

  if (error) {
    return <div style={s.error}>{error}</div>;
  }

  const ws = workspace!;
  const hasData = ws.totalTokens > 0;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1e293b' }}>Usage &amp; Cost</h2>
        <button style={s.refreshBtn} onClick={() => void load()}>Refresh</button>
      </div>

      {!hasData ? (
        <div style={s.empty}>
          No usage data yet.<br />
          Start a conversation in the <strong>Chat</strong> tab to see your token usage and costs here.
        </div>
      ) : (
        <>
          {/* ── Summary cards ───────────────────────────────── */}
          <div style={s.section}>
            <div style={s.cards}>
              <div style={s.card}>
                <div style={s.cardLabel}>Total Cost</div>
                <div style={s.cardValue}>{fmtCost(ws.totalCostUsd)}</div>
                <div style={s.cardSub}>all time</div>
              </div>
              <div style={s.card}>
                <div style={s.cardLabel}>Total Tokens</div>
                <div style={s.cardValue}>{fmtTokens(ws.totalTokens)}</div>
                <div style={s.cardSub}>{fmtTokens(ws.totalInputTokens)} in · {fmtTokens(ws.totalOutputTokens)} out</div>
              </div>
              <div style={s.card}>
                <div style={s.cardLabel}>Cloud Tokens</div>
                <div style={s.cardValue}>{fmtTokens(ws.cloudTokens)}</div>
                <div style={s.cardSub}>billed at provider rates</div>
              </div>
              <div style={s.card}>
                <div style={s.cardLabel}>Local Tokens</div>
                <div style={s.cardValue}>{fmtTokens(ws.localTokens)}</div>
                <div style={s.cardSub}>free · via Ollama</div>
              </div>
            </div>
          </div>

          {/* ── By provider ────────────────────────────────── */}
          {Object.keys(ws.byProvider).length > 0 && (
            <div style={s.section}>
              <div style={s.sectionTitle}>By Provider</div>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Provider</th>
                    <th style={s.th}>Tokens</th>
                    <th style={s.th}>Cost (USD)</th>
                    <th style={s.th}>Type</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(ws.byProvider)
                    .sort((a, b) => b[1].costUsd - a[1].costUsd)
                    .map(([provider, usage]: [string, ProviderUsage]) => {
                      const isLocal = usage.costUsd === 0;
                      return (
                        <tr key={provider}>
                          <td style={s.td}>{provider}</td>
                          <td style={s.td}>{fmtTokens(usage.tokens)}</td>
                          <td style={s.td}>{fmtCost(usage.costUsd)}</td>
                          <td style={s.td}><span style={s.badge(isLocal)}>{isLocal ? 'Local' : 'Cloud'}</span></td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── By model ───────────────────────────────────── */}
          {Object.keys(ws.byModel).length > 0 && (
            <div style={s.section}>
              <div style={s.sectionTitle}>By Model</div>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Model</th>
                    <th style={s.th}>Input Tokens</th>
                    <th style={s.th}>Tokens</th>
                    <th style={s.th}>Cost (USD)</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(ws.byModel)
                    .sort((a, b) => b[1].costUsd - a[1].costUsd)
                    .map(([model, usage]: [string, ProviderUsage]) => (
                      <tr key={model}>
                        <td style={s.td}><code style={{ fontSize: 13 }}>{model}</code></td>
                        <td style={s.tdMuted}>—</td>
                        <td style={s.td}>{fmtTokens(usage.tokens)}</td>
                        <td style={s.td}>{fmtCost(usage.costUsd)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── By project ─────────────────────────────────── */}
          {projectCosts.length > 0 && (
            <div style={s.section}>
              <div style={s.sectionTitle}>By Project</div>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                {projectCosts
                  .sort((a, b) => b.summary.totalCostUsd - a.summary.totalCostUsd)
                  .map(({ project, summary }) => (
                    <div key={project.id} style={s.projectRow}>
                      <div>
                        <div style={s.projectName}>{project.name}</div>
                        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                          {fmtTokens(summary.totalTokens)} tokens
                        </div>
                      </div>
                      <div style={s.projectCost}>{fmtCost(summary.totalCostUsd)}</div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
