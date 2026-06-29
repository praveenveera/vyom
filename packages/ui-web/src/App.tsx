import { useMemo, useState } from 'react';
import { GarageBuildApiClient } from './api/client';
import { Dashboard } from './pages/Dashboard';
import { Projects } from './pages/Projects';
import { Models } from './pages/Models';
import { Chat } from './pages/Chat';
import { Usage } from './pages/Usage';

type Page = 'dashboard' | 'projects' | 'models' | 'chat' | 'usage';

const NAV_ITEMS: { id: Page; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'chat',      label: 'Chat' },
  { id: 'projects',  label: 'Projects' },
  { id: 'models',    label: 'Models' },
  { id: 'usage',     label: 'Usage' },
];

const DEFAULT_SERVER = 'http://localhost:3000';

export function App() {
  const [page, setPage] = useState<Page>('dashboard');
  const [serverUrl] = useState<string>(() => localStorage.getItem('garagebuild.serverUrl') ?? DEFAULT_SERVER);

  const client = useMemo(() => new GarageBuildApiClient(serverUrl), [serverUrl]);

  return (
    <div style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
      display: 'flex', flexDirection: 'column', minHeight: '100vh',
      background: '#f8fafc',
    }}>
      <header style={{
        background: '#0f172a',
        color: '#f8fafc',
        padding: '0 28px',
        display: 'flex',
        alignItems: 'center',
        gap: 32,
        height: 54,
        borderBottom: '1px solid #1e293b',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: '-0.5px', color: '#f8fafc' }}>
            garagebuild
          </span>
          <span style={{ fontSize: 11, color: '#475569', fontWeight: 500 }}>
            v0.1
          </span>
        </div>

        {/* Nav */}
        <nav style={{ display: 'flex', gap: 2, height: '100%', alignItems: 'stretch' }}>
          {NAV_ITEMS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setPage(id)}
              style={{
                background: 'none',
                color: page === id ? '#f8fafc' : '#64748b',
                border: 'none',
                borderBottom: page === id ? '2px solid #6366f1' : '2px solid transparent',
                padding: '0 14px',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: page === id ? 600 : 400,
                fontFamily: 'inherit',
              }}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main style={{
        flex: 1,
        padding: '32px 28px',
        maxWidth: 960,
        width: '100%',
        margin: '0 auto',
        boxSizing: 'border-box' as const,
      }}>
        {page === 'dashboard' && <Dashboard client={client} />}
        {page === 'chat'      && <Chat      client={client} />}
        {page === 'projects'  && <Projects  client={client} />}
        {page === 'models'    && <Models    client={client} />}
        {page === 'usage'     && <Usage     client={client} />}
      </main>
    </div>
  );
}
