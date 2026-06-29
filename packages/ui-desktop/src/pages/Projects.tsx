import { useEffect, useState } from 'react';
import type { GarageBuildApiClient } from '../api/client';
import type { Project } from '../api/types';
import { ProjectCard } from '../components/ProjectCard';

interface Props {
  client: GarageBuildApiClient;
}

const FRAMEWORKS = ['react', 'vue', 'angular', 'nextjs', 'svelte'] as const;

export function Projects({ client }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', framework: 'react', path: '' });

  const load = () => {
    client.listProjects().then(setProjects).catch((e: unknown) => {
      setError(e instanceof Error ? e.message : 'Failed to load projects');
    });
  };

  useEffect(load, [client]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.name.trim() === '' || form.path.trim() === '') return;
    setCreating(true);
    try {
      await client.createProject({ name: form.name.trim(), framework: form.framework, path: form.path.trim() });
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
      <h2>Projects</h2>
      {error !== null && <p style={{ color: '#ef4444' }}>{error}</p>}

      <form onSubmit={(e) => { void handleCreate(e); }} style={{ marginBottom: 24, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          placeholder="Project name"
          value={form.name}
          onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
          style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, flex: '1 1 160px' }}
          required
        />
        <select
          value={form.framework}
          onChange={(e) => setForm(f => ({ ...f, framework: e.target.value }))}
          style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6 }}
        >
          {FRAMEWORKS.map(fw => <option key={fw} value={fw}>{fw}</option>)}
        </select>
        <input
          placeholder="/path/to/project"
          value={form.path}
          onChange={(e) => setForm(f => ({ ...f, path: e.target.value }))}
          style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, flex: '2 1 240px' }}
          required
        />
        <button
          type="submit"
          disabled={creating}
          style={{ padding: '6px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          {creating ? 'Creating…' : 'Create'}
        </button>
      </form>

      {projects.length === 0
        ? <p style={{ color: '#9ca3af' }}>No projects yet.</p>
        : projects.map(p => <ProjectCard key={p.id} project={p} onDelete={(id) => { void handleDelete(id); }} />)
      }
    </div>
  );
}
