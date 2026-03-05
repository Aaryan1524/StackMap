import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { GraphView } from './components/GraphView';
import { ChatPanel } from './components/ChatPanel';
import type { GraphData, Message } from './types';
import './index.css';

const API = 'http://localhost:8000';

export default function App() {
  const [repos, setRepos] = useState<string[]>([]);
  const [activeRepo, setActiveRepo] = useState<string | null>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [isIngesting, setIsIngesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isQuerying, setIsQuerying] = useState(false);

  /* ── Ingest ── */
  const handleIngest = async (url: string) => {
    setIsIngesting(true);
    setError(null);
    try {
      const res = await fetch(`${API}/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_url: url }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(body.detail ?? res.statusText);
      }
      setRepos(prev => prev.includes(url) ? prev : [...prev, url]);
      setActiveRepo(url);
      await loadGraph();
    } catch (err: any) {
      setError(err.message ?? 'Ingest failed');
    } finally {
      setIsIngesting(false);
    }
  };

  /* ── Load Graph ── */
  const loadGraph = async () => {
    try {
      const res = await fetch(`${API}/graph`);
      if (!res.ok) return;
      const data: GraphData = await res.json();
      setGraphData(data);
    } catch (err) {
      console.error('Graph fetch failed:', err);
    }
  };

  /* ── Select Repo ── */
  const handleSelectRepo = async (repo: string) => {
    setActiveRepo(repo);
    await loadGraph();
  };

  /* ── Query ── */
  const handleQuery = async (question: string) => {
    setMessages(prev => [...prev, { role: 'user', content: question }]);
    setIsQuerying(true);
    try {
      const res = await fetch(`${API}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.answer,
        sources: data.sources,
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '⚠ Failed to get a response. Is the backend running?',
      }]);
    } finally {
      setIsQuerying(false);
    }
  };

  return (
    <div style={styles.app}>
      {/* Top bar */}
      <header style={styles.topbar}>
        <div style={styles.topbarDot} />
        <span className="mono" style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.12em' }}>
          STACKMAP · VISUAL CODEBASE INTELLIGENCE
        </span>
        {activeRepo && (
          <span className="mono" style={{ fontSize: 10, color: 'var(--cyan)', marginLeft: 'auto' }}>
            /{activeRepo.replace('https://github.com/', '')}
          </span>
        )}
      </header>

      {/* Error banner */}
      {error && (
        <div style={styles.errorBanner}>
          <span className="mono" style={{ fontSize: 11 }}>⚠ {error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: 'var(--amber)', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>✕</button>
        </div>
      )}

      {/* Main 3-panel layout */}
      <div style={styles.main}>
        <Sidebar
          repos={repos}
          activeRepo={activeRepo}
          isIngesting={isIngesting}
          onIngest={handleIngest}
          onSelectRepo={handleSelectRepo}
        />
        <GraphView graphData={graphData} />
        <ChatPanel
          messages={messages}
          isQuerying={isQuerying}
          onQuery={handleQuery}
        />
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  app: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg)',
    overflow: 'hidden',
  },
  topbar: {
    height: 36,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '0 16px',
    borderBottom: '1px solid var(--border)',
    background: 'rgba(9,13,24,0.9)',
    flexShrink: 0,
  },
  topbarDot: {
    width: 5,
    height: 5,
    borderRadius: '50%',
    background: 'var(--cyan)',
    boxShadow: '0 0 8px var(--cyan)',
    animation: 'pulse 3s ease-in-out infinite',
  },
  errorBanner: {
    padding: '8px 16px',
    background: 'rgba(245,158,11,0.1)',
    borderBottom: '1px solid rgba(245,158,11,0.3)',
    color: 'var(--amber)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
  },
  main: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
};
