import type { Project } from '../api/types';

interface Props {
  project: Project;
  onDelete: (id: string) => void;
}

export function ProjectCard({ project, onDelete }: Props) {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 16px', marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <strong>{project.name}</strong>
          <span style={{ marginLeft: 8, fontSize: 12, color: '#6b7280', textTransform: 'capitalize' }}>{project.framework}</span>
        </div>
        <button
          onClick={() => onDelete(project.id)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 18 }}
          title="Delete"
        >×</button>
      </div>
      <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>{project.path}</div>
    </div>
  );
}
