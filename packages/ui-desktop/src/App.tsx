import { useMemo, useState } from 'react';
import { GarageBuildApiClient } from './api/client';
import { Dashboard } from './pages/Dashboard';
import { Projects } from './pages/Projects';
import { Models } from './pages/Models';
import { ServerControls } from './components/ServerControls';
import { useServer } from './hooks/useServer';

type Page = 'dashboard' | 'projects' | 'models';

const NAV: { id: Page; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'projects', label: 'Projects' },
  { id: 'models', label: 'Models' },
];

const DEFAULT_SERVER_URL = 'http://localhost:3000';

export function App() {
  const [page, setPage] = useState<Page>('dashboard');
  const server = useServer();

  const client = useMemo(
    () => new GarageBuildApiClient(localStorage.getItem('garagebuild.serverUrl') ?? DEFAULT_SERVER_URL),
    [],
  );

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <header style={{ background: '#1e293b', color: '#f8fafc', padding: '0 24px', display: 'flex', alignItems: 'center', gap: 32, height: 52 }}>
        <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.5px' }}>GarageBuild</span>
        <nav style={{ display: 'flex', gap: 4 }}>
          {NAV.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setPage(id)}
              style={{ background: page === id ? '#334155' : 'none', color: '#f8fafc', border: 'none', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main style={{ flex: 1, padding: 32, maxWidth: 960, width: '100%', margin: '0 auto' }}>
        <ServerControls server={server} />
        {page === 'dashboard' && <Dashboard client={client} />}
        {page === 'projects' && <Projects client={client} />}
        {page === 'models' && <Models client={client} />}
      </main>
    </div>
  );
}
