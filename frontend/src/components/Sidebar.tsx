import { useState } from 'react';
import { GitBranch, Loader2, Search, Hexagon, ChevronRight } from 'lucide-react';

interface SidebarProps {
  repos: string[];
  activeRepo: string | null;
  isIngesting: boolean;
  onIngest: (url: string) => void;
  onSelectRepo: (repo: string) => void;
}

export function Sidebar({ repos, activeRepo, isIngesting, onIngest, onSelectRepo }: SidebarProps) {
  const [url, setUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (trimmed) { onIngest(trimmed); setUrl(''); }
  };

  return (
    <aside style={styles.sidebar} className="glass">

      {/* ── Logo ── */}
      <div style={styles.logoArea}>
        <div style={styles.logoIcon}>
          <Hexagon size={18} strokeWidth={1.5} color="var(--cyan)" />
        </div>
        <div>
          <div style={styles.logoText}>
            <span style={{ color: 'var(--cyan)' }}>STACK</span>
            <span style={{ color: 'var(--text-1)' }}>MAP</span>
          </div>
          <div className="mono" style={{ fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.1em' }}>
            CODEBASE INTELLIGENCE
          </div>
        </div>
      </div>

      {/* ── Divider ── */}
      <div style={styles.divider} />

      {/* ── Ingest Form ── */}
      <div style={styles.section}>
        <div className="label" style={{ marginBottom: 10 }}>Analyze Repository</div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={styles.inputWrapper}>
            <Search size={12} color="var(--text-3)" style={{ flexShrink: 0 }} />
            <input
              type="text"
              placeholder="https://github.com/user/repo"
              value={url}
              onChange={e => setUrl(e.target.value)}
              style={styles.input}
              className="mono"
            />
          </div>
          <button
            type="submit"
            disabled={isIngesting || !url.trim()}
            style={{
              ...styles.btn,
              opacity: isIngesting || !url.trim() ? 0.5 : 1,
              cursor: isIngesting || !url.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            {isIngesting ? (
              <>
                <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                ANALYZING…
              </>
            ) : (
              'ANALYZE'
            )}
          </button>
        </form>
      </div>

      <div style={styles.divider} />

      {/* ── Repos List ── */}
      <div style={{ ...styles.section, flex: 1, overflowY: 'auto' }}>
        <div className="label" style={{ marginBottom: 10 }}>
          Analyzed&nbsp;
          <span style={{ color: 'var(--cyan)', fontVariantNumeric: 'tabular-nums' }}>
            [{repos.length}]
          </span>
        </div>

        {repos.length === 0 ? (
          <div style={styles.emptyState}>
            <GitBranch size={22} color="var(--text-3)" style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>No repos yet</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {repos.map(repo => {
              const name = repo.replace('https://github.com/', '');
              const active = repo === activeRepo;
              return (
                <button
                  key={repo}
                  onClick={() => onSelectRepo(repo)}
                  style={{
                    ...styles.repoItem,
                    background: active ? 'rgba(0,210,255,0.07)' : 'transparent',
                    borderColor: active ? 'rgba(0,210,255,0.3)' : 'transparent',
                    color: active ? 'var(--cyan)' : 'var(--text-2)',
                  }}
                >
                  <span
                    style={{
                      width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                      background: active ? 'var(--cyan)' : 'var(--text-3)',
                      boxShadow: active ? '0 0 6px var(--cyan)' : 'none',
                    }}
                  />
                  <span className="mono" style={{ fontSize: 11, flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {name}
                  </span>
                  {active && <ChevronRight size={11} />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div style={styles.footer}>
        <div style={styles.statusDot} />
        <span className="mono" style={{ fontSize: 10, color: 'var(--text-3)' }}>API CONNECTED</span>
      </div>
    </aside>
  );
}

/* ─── Styles ── */
const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: 260,
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    flexShrink: 0,
    borderRight: '1px solid var(--border)',
    borderRadius: 0,
    borderTop: 'none',
    borderBottom: 'none',
    borderLeft: 'none',
  },
  logoArea: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '20px 18px 16px',
  },
  logoIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    border: '1px solid rgba(0,210,255,0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,210,255,0.05)',
    boxShadow: '0 0 12px rgba(0,210,255,0.1)',
    flexShrink: 0,
  },
  logoText: {
    fontFamily: "'JetBrains Mono', monospace",
    fontWeight: 700,
    fontSize: 15,
    letterSpacing: '0.05em',
  },
  divider: {
    height: 1,
    background: 'var(--border)',
    margin: '0 0',
  },
  section: {
    padding: '14px 16px',
  },
  inputWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '7px 10px',
    transition: 'border-color 0.2s',
  },
  input: {
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: 'var(--text-1)',
    fontSize: 11,
    width: '100%',
  },
  btn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    background: 'rgba(0,210,255,0.12)',
    border: '1px solid rgba(0,210,255,0.3)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--cyan)',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.1em',
    padding: '8px 14px',
    transition: 'all 0.2s',
  },
  repoItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '7px 8px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid transparent',
    cursor: 'pointer',
    width: '100%',
    transition: 'all 0.15s',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 0',
  },
  footer: {
    padding: '12px 16px',
    borderTop: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    gap: 7,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: 'var(--green)',
    boxShadow: '0 0 6px var(--green)',
    animation: 'pulse 2s ease-in-out infinite',
  },
};
