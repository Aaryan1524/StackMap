import { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { GraphView, type GraphViewHandle } from './components/GraphView';
import { ChatPanel } from './components/ChatPanel';
import type { GraphData, Message } from './types';
import './index.css';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export default function App() {
  const [repos, setRepos] = useState<string[]>([]);
  const [activeRepo, setActiveRepo] = useState<string | null>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [isIngesting, setIsIngesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isQuerying, setIsQuerying] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showChat, setShowChat] = useState(true);
  const [graphLimit, setGraphLimit] = useState(2000);
  const graphViewRef = useRef<GraphViewHandle>(null);

  const findNodeForSource = (source: string): string | null => {
    if (!graphData) return null;
    const src = source.replace(/\\/g, '/');
    // 1. Suffix match — most precise
    let match = graphData.nodes.find(n => {
      if (!n.id.startsWith('file:')) return false;
      return src.endsWith(n.id.slice(5).replace(/\\/g, '/'));
    });
    // 2. Fallback: match by filename alone
    if (!match) {
      const filename = src.split('/').pop() ?? '';
      match = graphData.nodes.find(n => {
        if (!n.id.startsWith('file:')) return false;
        return (n.id.split('/').pop() ?? '') === filename;
      });
    }
    return match?.id ?? null;
  };

  const handleSourceClick = (source: string) => {
    const nodeId = findNodeForSource(source);
    if (nodeId) graphViewRef.current?.focusNode(nodeId);
  };

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

  const loadGraph = async (limit = graphLimit) => {
    try {
      const res = await fetch(`${API}/graph?limit=${limit}`);
      if (!res.ok) return;
      const data: GraphData = await res.json();
      setGraphData(data);
    } catch { /* silent */ }
  };

  const handleSelectRepo = async (repo: string) => {
    setActiveRepo(repo);
    await loadGraph();
  };

  const handleLimitChange = async (limit: number) => {
    setGraphLimit(limit);
    await loadGraph(limit);
  };

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
      if (data.sources?.length > 0) {
        // Score each source by how well its filename matches keywords in the question
        const qNorm = question.toLowerCase().replace(/[^a-z0-9]/g, '');
        const sorted = [...data.sources].sort((a: string, b: string) => {
          const stem = (s: string) => (s.split('/').pop() ?? '').toLowerCase().replace(/\.[^.]+$/, '').replace(/[^a-z0-9]/g, '');
          const scoreA = qNorm.includes(stem(a)) ? 1 : 0;
          const scoreB = qNorm.includes(stem(b)) ? 1 : 0;
          return scoreB - scoreA;
        });
        for (const source of sorted) {
          const nodeId = findNodeForSource(source);
          if (nodeId) { graphViewRef.current?.focusNode(nodeId); break; }
        }
      }
    } catch (err: any) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `⚠ ${err?.message ?? 'Failed to get a response. Is the backend running?'}`,
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
        {/* Sidebar with slide transition */}
        <div style={{
          width: showSidebar ? 260 : 0,
          height: '100%',
          overflow: 'hidden',
          transition: 'width 0.25s ease',
          flexShrink: 0,
        }}>
          <div style={{ width: 260, height: '100%' }}>
            <Sidebar
              repos={repos}
              activeRepo={activeRepo}
              isIngesting={isIngesting}
              onIngest={handleIngest}
              onSelectRepo={handleSelectRepo}
              graphLimit={graphLimit}
              onLimitChange={handleLimitChange}
            />
          </div>
        </div>

        {/* Graph + toggle buttons */}
        <div style={{ flex: 1, height: '100%', position: 'relative', overflow: 'hidden' }}>
          <GraphView ref={graphViewRef} graphData={graphData} />

          {/* Left toggle */}
          <button
            onClick={() => setShowSidebar(v => !v)}
            style={{ ...styles.toggleBtn, left: 8 }}
            title={showSidebar ? 'Hide sidebar' : 'Show sidebar'}
          >
            {showSidebar ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
          </button>

          {/* Right toggle */}
          <button
            onClick={() => setShowChat(v => !v)}
            style={{ ...styles.toggleBtn, right: 8 }}
            title={showChat ? 'Hide chat' : 'Show chat'}
          >
            {showChat ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* Chat panel with slide transition */}
        <div style={{
          width: showChat ? 340 : 0,
          height: '100%',
          overflow: 'hidden',
          transition: 'width 0.25s ease',
          flexShrink: 0,
        }}>
          <div style={{ width: 340, height: '100%' }}>
            <ChatPanel
              messages={messages}
              isQuerying={isQuerying}
              onQuery={handleQuery}
              onSourceClick={handleSourceClick}
            />
          </div>
        </div>
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
    background: 'var(--bg-panel)',
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
  toggleBtn: {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    zIndex: 20,
    width: 24,
    height: 48,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(13,13,13,0.9)',
    border: '1px solid rgba(0,210,255,0.2)',
    borderRadius: 6,
    color: 'var(--cyan)',
    cursor: 'pointer',
    backdropFilter: 'blur(12px)',
    transition: 'border-color 0.15s, background 0.15s',
  },
};
