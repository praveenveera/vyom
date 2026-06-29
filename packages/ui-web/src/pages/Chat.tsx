import { useEffect, useRef, useState, useCallback } from 'react';
import type { GarageBuildApiClient } from '../api/client';
import type { Project, Session, FileEntry, SessionMessage } from '../api/types';

interface Props {
  client: GarageBuildApiClient;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const TASK_TYPES = [
  { value: 'chat',     label: 'Chat' },
  { value: 'generate', label: 'Generate' },
  { value: 'review',   label: 'Review' },
  { value: 'test',     label: 'Tests' },
  { value: 'refactor', label: 'Refactor' },
  { value: 'explain',  label: 'Explain' },
];

const PLACEHOLDERS: Record<string, string> = {
  chat:     'Ask anything…',
  generate: 'Describe a component or feature to generate…',
  review:   'Paste code to review…',
  test:     'Paste code to write tests for…',
  refactor: 'Paste code to refactor…',
  explain:  'Paste code to explain…',
};

const s = {
  root: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: 'calc(100dvh - 120px)',
    gap: 0,
  },

  // ── Context bar (project + session) ───────────────────────────────────────
  contextBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    flexWrap: 'wrap' as const,
  },
  contextLabel: { fontSize: 12, color: '#94a3b8', fontWeight: 600 },
  select: {
    padding: '5px 10px',
    borderRadius: 7,
    border: '1px solid #e2e8f0',
    background: '#fff',
    fontSize: 13,
    color: '#0f172a',
    outline: 'none',
    cursor: 'pointer',
    minWidth: 140,
  },
  newSessionBtn: {
    padding: '5px 12px',
    borderRadius: 7,
    border: '1px solid #e2e8f0',
    background: '#fff',
    fontSize: 12,
    color: '#475569',
    cursor: 'pointer',
    fontWeight: 600,
  },

  // ── Mode bar ───────────────────────────────────────────────────────────────
  toolbar: { display: 'flex', gap: 4, marginBottom: 10 },
  modeBtn: (active: boolean): React.CSSProperties => ({
    padding: '5px 12px',
    borderRadius: 6,
    border: '1px solid',
    borderColor: active ? '#6366f1' : '#e2e8f0',
    background: active ? '#6366f1' : '#fff',
    color: active ? '#fff' : '#475569',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: active ? 600 : 400,
  }),

  // ── Main split ─────────────────────────────────────────────────────────────
  split: { display: 'flex', flex: 1, gap: 12, overflow: 'hidden' },

  // ── Chat column ────────────────────────────────────────────────────────────
  chatCol: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
    minWidth: 0,
  },
  messageList: {
    flex: 1,
    overflowY: 'auto' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 10,
    paddingBottom: 4,
  },
  bubble: (role: 'user' | 'assistant'): React.CSSProperties => ({
    maxWidth: '82%',
    alignSelf: role === 'user' ? 'flex-end' : 'flex-start',
    background: role === 'user' ? '#6366f1' : '#f1f5f9',
    color: role === 'user' ? '#fff' : '#0f172a',
    padding: '10px 14px',
    borderRadius: role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
    fontSize: 14,
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word' as const,
  }),
  cursor: {
    display: 'inline-block',
    width: 2, height: '1em',
    background: '#6366f1',
    marginLeft: 2,
    verticalAlign: 'text-bottom',
  },
  emptyChat: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column' as const,
    gap: 8,
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center' as const,
  },
  emptyChatHint: { fontSize: 12, color: '#cbd5e1' },

  // ── Error / notice banners ────────────────────────────────────────────────
  errorBanner: {
    background: '#fef2f2', border: '1px solid #fecaca',
    borderRadius: 8, padding: '8px 12px',
    fontSize: 13, color: '#b91c1c', marginTop: 6,
  },
  filesBanner: {
    background: '#f0fdf4', border: '1px solid #bbf7d0',
    borderRadius: 8, padding: '8px 12px',
    fontSize: 12, color: '#15803d', marginTop: 6,
  },

  // ── Input row ──────────────────────────────────────────────────────────────
  inputRow: {
    display: 'flex', gap: 8,
    paddingTop: 10, borderTop: '1px solid #e2e8f0', marginTop: 6,
  },
  textarea: {
    flex: 1, resize: 'none' as const,
    border: '1px solid #e2e8f0', borderRadius: 8,
    padding: '10px 12px', fontSize: 14,
    fontFamily: 'inherit', outline: 'none',
    minHeight: 68, maxHeight: 160,
  },
  sendBtn: (disabled: boolean): React.CSSProperties => ({
    padding: '0 20px', borderRadius: 8, border: 'none',
    background: disabled ? '#94a3b8' : '#6366f1',
    color: '#fff', cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: 14, fontWeight: 600,
    alignSelf: 'flex-end', height: 38,
  }),

  // ── File panel ─────────────────────────────────────────────────────────────
  filePanel: {
    width: 240,
    display: 'flex',
    flexDirection: 'column' as const,
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 10,
    overflow: 'hidden',
    flexShrink: 0,
  },
  filePanelHeader: {
    padding: '10px 12px',
    borderBottom: '1px solid #f1f5f9',
    fontSize: 12, fontWeight: 700,
    color: '#475569', textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  fileList: {
    flex: 1, overflowY: 'auto' as const, padding: '6px 0',
  },
  fileRow: (selected: boolean): React.CSSProperties => ({
    padding: '4px 12px',
    fontSize: 12,
    cursor: 'pointer',
    background: selected ? '#eef2ff' : 'none',
    color: selected ? '#4f46e5' : '#475569',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  }),
  dirRow: {
    padding: '4px 12px',
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: 600,
    userSelect: 'none' as const,
  },
  fileContent: {
    borderTop: '1px solid #f1f5f9',
    padding: '8px 10px',
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#475569',
    overflowY: 'auto' as const,
    maxHeight: 180,
    background: '#f8fafc',
    whiteSpace: 'pre' as const,
    overflowX: 'auto' as const,
  },
  refreshBtn: {
    border: 'none', background: 'none',
    cursor: 'pointer', color: '#94a3b8', fontSize: 14, padding: 0,
  },
};

function fileDepth(path: string): number {
  return path.split('/').length - 1;
}

export function Chat({ client }: Props) {
  // Context
  const [projects, setProjects]           = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [sessions, setSessions]           = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');

  // Chat
  const [taskType, setTaskType]           = useState('chat');
  const [input, setInput]                 = useState('');
  const [messages, setMessages]           = useState<Message[]>([]);
  const [streaming, setStreaming]         = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [notice, setNotice]               = useState<string | null>(null);

  // Files
  const [files, setFiles]                 = useState<FileEntry[]>([]);
  const [selectedFile, setSelectedFile]   = useState<string | null>(null);
  const [fileContent, setFileContent]     = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);

  // ── Load projects ──────────────────────────────────────────────────────────
  useEffect(() => {
    client.listProjects()
      .then(setProjects)
      .catch(() => setProjects([]));
  }, [client]);

  // ── Load sessions when project changes ─────────────────────────────────────
  useEffect(() => {
    if (!selectedProjectId) {
      setSessions([]);
      setSelectedSessionId('');
      return;
    }
    client.listSessions(selectedProjectId)
      .then(ss => {
        setSessions(ss);
        if (ss.length > 0) setSelectedSessionId(ss[0]!.id);
        else setSelectedSessionId('');
      })
      .catch(() => { setSessions([]); setSelectedSessionId(''); });
  }, [client, selectedProjectId]);

  // ── Load message history when session changes ──────────────────────────────
  useEffect(() => {
    if (!selectedProjectId || !selectedSessionId) {
      setMessages([]);
      return;
    }
    client.getSession(selectedProjectId, selectedSessionId)
      .then(s => {
        setMessages(
          s.messages
            .filter((m): m is SessionMessage & { role: 'user' | 'assistant' } =>
              m.role === 'user' || m.role === 'assistant',
            )
            .map(m => ({ role: m.role, content: m.content })),
        );
      })
      .catch(() => setMessages([]));
  }, [client, selectedProjectId, selectedSessionId]);

  // ── Load file tree when project changes ───────────────────────────────────
  const refreshFiles = useCallback(() => {
    if (!selectedProjectId) { setFiles([]); return; }
    client.listFiles(selectedProjectId)
      .then(setFiles)
      .catch(() => setFiles([]));
  }, [client, selectedProjectId]);

  useEffect(() => { refreshFiles(); }, [refreshFiles]);

  // ── New session ────────────────────────────────────────────────────────────
  const createNewSession = async () => {
    if (!selectedProjectId) return;
    const s = await client.createSession(selectedProjectId);
    setSessions(prev => [s, ...prev]);
    setSelectedSessionId(s.id);
    setMessages([]);
  };

  // ── Send ───────────────────────────────────────────────────────────────────
  const send = async () => {
    const text = input.trim();
    if (!text || streaming) return;

    setInput('');
    setError(null);
    setNotice(null);

    // Auto-create a session if a project is selected but none exists
    let activeSessionId = selectedSessionId;
    if (selectedProjectId && !activeSessionId) {
      try {
        const newSession = await client.createSession(selectedProjectId);
        setSessions(prev => [newSession, ...prev]);
        setSelectedSessionId(newSession.id);
        activeSessionId = newSession.id;
      } catch {
        // continue without session
      }
    }

    const userMsg: Message = { role: 'user', content: text };
    const assistantPlaceholder: Message = { role: 'assistant', content: '' };
    setMessages(prev => [...prev, userMsg, assistantPlaceholder]);
    setStreaming(true);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 0);

    await client.streamAgent(
      {
        type: taskType,
        description: text,
        ...(activeSessionId && { sessionId: activeSessionId }),
        ...(selectedProjectId && { projectId: selectedProjectId }),
      },
      {
        onChunk: ({ accumulated }) => {
          setMessages(prev => {
            const next = [...prev];
            next[next.length - 1] = { role: 'assistant', content: accumulated };
            return next;
          });
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 0);
        },
        onDone: (filesWritten) => {
          setStreaming(false);
          if (filesWritten && filesWritten.length > 0) {
            setNotice(`${filesWritten.length} file${filesWritten.length > 1 ? 's' : ''} written: ${filesWritten.join(', ')}`);
            refreshFiles();
          }
        },
        onError: (msg) => {
          setError(msg);
          setStreaming(false);
          setMessages(prev => prev.slice(0, -1));
        },
      },
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  // ── File click ─────────────────────────────────────────────────────────────
  const openFile = async (path: string) => {
    if (selectedFile === path) {
      setSelectedFile(null);
      setFileContent(null);
      return;
    }
    setSelectedFile(path);
    try {
      const content = await client.readFile(selectedProjectId, path);
      setFileContent(content);
    } catch {
      setFileContent('(unable to read file)');
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={s.root}>
      {/* Context bar */}
      <div style={s.contextBar}>
        <span style={s.contextLabel}>Project</span>
        <select
          value={selectedProjectId}
          onChange={e => { setSelectedProjectId(e.target.value); setMessages([]); }}
          style={s.select}
        >
          <option value="">— none —</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        {selectedProjectId && (
          <>
            <span style={s.contextLabel}>Session</span>
            <select
              value={selectedSessionId}
              onChange={e => setSelectedSessionId(e.target.value)}
              style={s.select}
            >
              <option value="">— new —</option>
              {sessions.map(s => (
                <option key={s.id} value={s.id}>
                  {s.title ?? s.id.slice(0, 8)}
                </option>
              ))}
            </select>
            <button onClick={() => { void createNewSession(); }} style={s.newSessionBtn}>
              + New
            </button>
          </>
        )}
      </div>

      {/* Mode bar */}
      <div style={s.toolbar}>
        {TASK_TYPES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setTaskType(value)}
            style={s.modeBtn(taskType === value)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Split: messages + file panel */}
      <div style={s.split}>
        {/* Chat column */}
        <div style={s.chatCol}>
          {messages.length === 0 ? (
            <div style={s.emptyChat}>
              <div>Start a conversation</div>
              <div style={s.emptyChatHint}>
                {selectedProjectId
                  ? 'Messages are saved to the selected session.'
                  : 'Select a project to persist chat history.'}
              </div>
              <div style={s.emptyChatHint}>Enter to send · Shift+Enter for new line</div>
            </div>
          ) : (
            <div style={s.messageList}>
              {messages.map((msg, i) => (
                <div key={i} style={s.bubble(msg.role)}>
                  {msg.content}
                  {streaming && msg.role === 'assistant' && i === messages.length - 1 && (
                    <span style={s.cursor} />
                  )}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}

          {error !== null && (
            <div style={s.errorBanner}>
              {error.includes('No model configured')
                ? 'No AI model configured. Go to the Models page to add one.'
                : `Error: ${error}`}
            </div>
          )}

          {notice !== null && (
            <div style={s.filesBanner}>{notice}</div>
          )}

          <div style={s.inputRow}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={PLACEHOLDERS[taskType] ?? 'Type a message…'}
              style={s.textarea}
              disabled={streaming}
            />
            <button
              onClick={() => void send()}
              disabled={streaming || !input.trim()}
              style={s.sendBtn(streaming || !input.trim())}
            >
              {streaming ? '…' : 'Send'}
            </button>
          </div>
        </div>

        {/* File panel (only when a project is selected) */}
        {selectedProjectId && (
          <div style={s.filePanel}>
            <div style={s.filePanelHeader}>
              <span>Files</span>
              <button onClick={refreshFiles} style={s.refreshBtn} title="Refresh">↻</button>
            </div>
            <div style={s.fileList}>
              {files.length === 0 ? (
                <div style={{ padding: '12px', fontSize: 12, color: '#cbd5e1' }}>
                  No files yet. Use Generate mode to create them.
                </div>
              ) : (
                files.map(f => f.isDirectory ? (
                  <div key={f.path} style={{ ...s.dirRow, paddingLeft: 12 + fileDepth(f.path) * 10 }}>
                    {f.name}/
                  </div>
                ) : (
                  <div
                    key={f.path}
                    style={{ ...s.fileRow(selectedFile === f.path), paddingLeft: 12 + fileDepth(f.path) * 10 }}
                    onClick={() => { void openFile(f.path); }}
                    title={f.path}
                  >
                    {f.name}
                  </div>
                ))
              )}
            </div>
            {fileContent !== null && (
              <div style={s.fileContent}>{fileContent}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
