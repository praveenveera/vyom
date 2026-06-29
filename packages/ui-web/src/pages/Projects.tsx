import { useEffect, useState } from 'react';
import type { GarageBuildApiClient } from '../api/client';
import type { Project } from '../api/types';

interface Props {
  client: GarageBuildApiClient;
}

const FRAMEWORKS = ['react', 'vue', 'angular', 'nextjs', 'svelte', 'node', 'other'] as const;

const FW_COLORS: Record<string, [string, string]> = {
  react:   ['#0369a1', '#f0f9ff'],
  vue:     ['#16a34a', '#f0fdf4'],
  angular: ['#dc2626', '#fef2f2'],
  nextjs:  ['#0f172a', '#f1f5f9'],
  svelte:  ['#c2410c', '#fff7ed'],
  node:    ['#15803d', '#f0fdf4'],
  other:   ['#475569', '#f1f5f9'],
};

function fwColor(fw: string): [string, string] {
  return FW_COLORS[fw] ?? ['#475569', '#f1f5f9'];
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  } catch {
    return iso;
  }
}

const s = {
  pageTitle: { fontSize: 22, fontWeight: 700, color: '#0f172a', margin: '0 0 4px' },
  pageSubtitle: { fontSize: 14, color: '#64748b', marginTop: 4, marginBottom: 28 },

  formCard: {
    background: '#fff', border: '1px solid #e2e8f0',
    borderRadius: 12, padding: '20px 24px', marginBottom: 28,
  },
  formTitle: { fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 16 },
  formRow: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr 2fr',
    gap: 10, marginBottom: 14,
  },
  fieldLabel: {
    display: 'block', fontSize: 11, fontWeight: 700,
    color: '#64748b', textTransform: 'uppercase' as const,
    letterSpacing: '0.06em', marginBottom: 5,
  },
  input: {
    width: '100%', padding: '8px 12px',
    border: '1px solid #e2e8f0', borderRadius: 8,
    fontSize: 13, color: '#0f172a', background: '#f8fafc',
    boxSizing: 'border-box' as const, outline: 'none', fontFamily: 'inherit',
  },
  select: {
    width: '100%', padding: '8px 12px',
    border: '1px solid #e2e8f0', borderRadius: 8,
    fontSize: 13, color: '#0f172a', background: '#f8fafc',
    outline: 'none', fontFamily: 'inherit',
  },
  createBtn: (disabled: boolean): React.CSSProperties => ({
    padding: '9px 22px', borderRadius: 8, border: 'none',
    background: disabled ? '#cbd5e1' : '#6366f1',
    color: '#fff', fontSize: 14, fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
  }),

  sectionHeader: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 14,
  },
  sectionTitle: { fontSize: 14, fontWeight: 700, color: '#0f172a' },
  projectCount: { fontSize: 13, color: '#94a3b8' },

  projectGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 12,
  },
  projectCard: {
    background: '#fff', border: '1px solid #e2e8f0',
    borderRadius: 12, padding: '16px 18px',
    display: 'flex', flexDirection: 'column' as const, gap: 10,
  },
  projectHeader: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'flex-start', gap: 8,
  },
  projectName: { fontSize: 15, fontWeight: 700, color: '#0f172a', wordBreak: 'break-word' as const },
  deleteBtn: {
    width: 26, height: 26, border: 'none', borderRadius: 6,
    background: '#fef2f2', color: '#dc2626',
    cursor: 'pointer', fontSize: 14, flexShrink: 0,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  },
  projectPath: {
    fontSize: 12, color: '#94a3b8', fontFamily: 'monospace',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
  },
  projectFooter: {
    display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', paddingTop: 6,
    borderTop: '1px solid #f1f5f9',
  },
  fwBadge: (color: string, bg: string): React.CSSProperties => ({
    display: 'inline-block', padding: '3px 8px', borderRadius: 4,
    fontSize: 11, fontWeight: 700, color, background: bg,
  }),
  projectDate: { fontSize: 11, color: '#cbd5e1' },

  emptyState: {
    padding: '48px 0', textAlign: 'center' as const,
    color: '#94a3b8', fontSize: 14, lineHeight: 1.7 as const,
  },
  errorBanner: {
    background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
    padding: '10px 14px', fontSize: 13, color: '#b91c1c',
    marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  dismissBtn: {
    border: 'none', background: 'none', cursor: 'pointer', color: '#b91c1c', fontSize: 16,
  },
};

export function Projects({ client }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', framework: 'react', path: '' });

  const load = () => {
    client
      .listProjects()
      .then(setProjects)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load projects'));
  };

  useEffect(load, [client]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.name.trim() === '' || form.path.trim() === '') return;
    setCreating(true);
    try {
      await client.createProject({
        name: form.name.trim(),
        framework: form.framework,
        path: form.path.trim(),
      });
      setForm({ name: '', framework: 'react', path: '' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await client.deleteProject(id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete project');
    }
  };

  return (
    <div>
      <h2 style={s.pageTitle}>Projects</h2>
      <p style={s.pageSubtitle}>Manage the codebases GarageBuild assists with.</p>

      {error !== null && (
        <div style={s.errorBanner}>
          <span>{error}</span>
          <button style={s.dismissBtn} onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* Create form */}
      <div style={s.formCard}>
        <div style={s.formTitle}>New Project</div>
        <form onSubmit={(e) => { void handleCreate(e); }}>
          <div style={s.formRow}>
            <div>
              <label style={s.fieldLabel}>Name *</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="My awesome app"
                style={s.input}
                required
              />
            </div>
            <div>
              <label style={s.fieldLabel}>Framework</label>
              <select
                value={form.framework}
                onChange={e => setForm(f => ({ ...f, framework: e.target.value }))}
                style={s.select}
              >
                {FRAMEWORKS.map(fw => (
                  <option key={fw} value={fw}>{fw}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={s.fieldLabel}>Path *</label>
              <input
                value={form.path}
                onChange={e => setForm(f => ({ ...f, path: e.target.value }))}
                placeholder="/path/to/project"
                style={s.input}
                required
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={creating || form.name.trim() === '' || form.path.trim() === ''}
            style={s.createBtn(creating || form.name.trim() === '' || form.path.trim() === '')}
          >
            {creating ? 'Creating…' : 'Create Project'}
          </button>
        </form>
      </div>

      {/* Project grid */}
      <div style={s.sectionHeader}>
        <div style={s.sectionTitle}>Your Projects</div>
        <div style={s.projectCount}>{projects.length} project{projects.length !== 1 ? 's' : ''}</div>
      </div>

      {projects.length === 0 ? (
        <div style={s.emptyState}>
          No projects yet.<br />
          Add a project above to get started.
        </div>
      ) : (
        <div style={s.projectGrid}>
          {projects.map(p => {
            const [color, bg] = fwColor(p.framework);
            return (
              <div key={p.id} style={s.projectCard}>
                <div style={s.projectHeader}>
                  <div style={s.projectName}>{p.name}</div>
                  <button
                    onClick={() => { void handleDelete(p.id); }}
                    style={s.deleteBtn}
                    title="Delete project"
                  >
                    ×
                  </button>
                </div>
                <div style={s.projectPath} title={p.path}>{p.path}</div>
                <div style={s.projectFooter}>
                  <span style={s.fwBadge(color, bg)}>{p.framework}</span>
                  <span style={s.projectDate}>{fmtDate(p.createdAt)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
