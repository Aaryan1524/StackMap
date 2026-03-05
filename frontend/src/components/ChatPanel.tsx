import { useEffect, useRef, useState } from 'react';
import { Send, Bot, User, FileCode2, Loader2, MessageSquare } from 'lucide-react';
import type { Message } from '../types';

interface ChatPanelProps {
  messages: Message[];
  isQuerying: boolean;
  onQuery: (question: string) => void;
}

export function ChatPanel({ messages, isQuerying, onQuery }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isQuerying]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = input.trim();
    if (q && !isQuerying) { onQuery(q); setInput(''); }
  };

  return (
    <aside style={styles.panel} className="glass">

      {/* ── Header ── */}
      <div style={styles.header}>
        <MessageSquare size={13} color="var(--cyan)" />
        <span className="mono" style={{ fontSize: 11, color: 'var(--text-2)', letterSpacing: '0.08em' }}>
          QUERY INTERFACE
        </span>
      </div>

      {/* ── Messages ── */}
      <div style={styles.messages}>
        {messages.length === 0 && (
          <div style={styles.emptyState}>
            <Bot size={28} color="var(--text-3)" style={{ marginBottom: 10 }} />
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 4 }}>Ask anything about the codebase</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>e.g. "How does ingestion work?"</div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {/* Role badge */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}>
              {msg.role === 'assistant' && <Bot size={12} color="var(--cyan)" />}
              <span className="mono" style={{
                fontSize: 9,
                color: msg.role === 'user' ? 'var(--text-3)' : 'var(--cyan)',
                letterSpacing: '0.1em',
              }}>
                {msg.role === 'user' ? 'YOU' : 'STACKMAP'}
              </span>
              {msg.role === 'user' && <User size={12} color="var(--text-3)" />}
            </div>

            {/* Bubble */}
            <div style={{
              ...styles.bubble,
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              background: msg.role === 'user'
                ? 'rgba(0,210,255,0.08)'
                : 'rgba(139,92,246,0.06)',
              borderColor: msg.role === 'user'
                ? 'rgba(0,210,255,0.2)'
                : 'rgba(139,92,246,0.2)',
              maxWidth: '90%',
            }}>
              <p style={{ fontSize: 12, lineHeight: 1.65, color: 'var(--text-1)', whiteSpace: 'pre-wrap' }}>
                {msg.content}
              </p>
            </div>

            {/* Sources */}
            {msg.sources && msg.sources.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, paddingLeft: 2 }}>
                {msg.sources.map(s => {
                  const short = s.split('/').slice(-2).join('/');
                  return (
                    <span key={s} style={styles.sourceChip}>
                      <FileCode2 size={9} />
                      <span className="mono">{short}</span>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {isQuerying && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 2 }}>
            <Loader2 size={12} color="var(--cyan)" style={{ animation: 'spin 1s linear infinite' }} />
            <span className="mono" style={{ fontSize: 10, color: 'var(--cyan)' }}>Thinking…</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input ── */}
      <div style={styles.inputArea}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8 }}>
          <textarea
            placeholder="Ask about the codebase…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e as any); } }}
            rows={2}
            style={styles.textarea}
          />
          <button
            type="submit"
            disabled={isQuerying || !input.trim()}
            style={{
              ...styles.sendBtn,
              opacity: isQuerying || !input.trim() ? 0.4 : 1,
              cursor: isQuerying || !input.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            <Send size={14} />
          </button>
        </form>
        <div className="mono" style={{ fontSize: 9, color: 'var(--text-3)', marginTop: 5 }}>
          ↵ send · shift+↵ newline
        </div>
      </div>
    </aside>
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    width: 340,
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    borderLeft: '1px solid var(--border)',
    borderRadius: 0,
    borderTop: 'none',
    borderBottom: 'none',
    borderRight: 'none',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '14px 16px',
    borderBottom: '1px solid var(--border)',
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    padding: '40px 0',
    textAlign: 'center',
  },
  bubble: {
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid',
  },
  sourceChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 7px',
    borderRadius: 4,
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid var(--border)',
    fontSize: 9,
    color: 'var(--text-3)',
  },
  inputArea: {
    padding: '12px 14px',
    borderTop: '1px solid var(--border)',
  },
  textarea: {
    flex: 1,
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-1)',
    fontSize: 12,
    padding: '8px 10px',
    resize: 'none',
    outline: 'none',
    fontFamily: 'Inter, sans-serif',
    lineHeight: 1.5,
  },
  sendBtn: {
    width: 36,
    height: 36,
    alignSelf: 'flex-end',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,210,255,0.12)',
    border: '1px solid rgba(0,210,255,0.3)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--cyan)',
    flexShrink: 0,
  },
};
