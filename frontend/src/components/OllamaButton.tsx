'use client';

import { useState, useCallback, useRef } from 'react';
import { Bot, Loader2, X, ChevronDown, ChevronUp } from 'lucide-react';
import { API_BASE } from '@/lib/api';

interface OllamaButtonProps {
  label: string;
  prompt: string;
  context?: string;
  className?: string;
  compact?: boolean;
}

export default function OllamaButton({ label, prompt, context, className, compact }: OllamaButtonProps) {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  const handleQuery = useCallback(async () => {
    if (loading) {
      abortRef.current?.abort();
      setLoading(false);
      return;
    }

    setLoading(true);
    setResponse(null);
    setOffline(false);
    setExpanded(true);

    abortRef.current = new AbortController();

    try {
      const res = await fetch(`${API_BASE}/api/ollama/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, context }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        setOffline(true);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) { setOffline(true); return; }

      let fullText = '';
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.error === 'ollama_offline' || data.error) {
              setOffline(true);
              reader.cancel();
              return;
            }
            if (data.response) {
              fullText += data.response;
              setResponse(fullText);
            }
          } catch { /* incomplete JSON line — ignore */ }
        }
      }
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        setOffline(true);
      }
    } finally {
      setLoading(false);
    }
  }, [prompt, context, loading]);

  if (offline) {
    return (
      <span className={`inline-flex items-center gap-1 text-[8px] font-mono text-red-400/50 tracking-wide ${className}`}>
        <Bot size={7} />
        AI OFFLINE
      </span>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-1">
        <button
          onClick={handleQuery}
          className={`inline-flex items-center gap-1 px-2 py-0.5 border text-[9px] font-mono tracking-wide transition-colors ${
            loading
              ? 'border-cyan-600/50 text-cyan-500 bg-cyan-950/30'
              : 'border-cyan-800/50 text-cyan-400 hover:bg-cyan-900/20 hover:border-cyan-600/60'
          } ${compact ? 'py-0' : ''}`}
        >
          {loading ? <Loader2 size={8} className="animate-spin flex-shrink-0" /> : <Bot size={8} className="flex-shrink-0" />}
          {loading ? 'STOP' : label}
        </button>
        {response && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
          >
            {expanded ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
          </button>
        )}
        {response && (
          <button
            onClick={() => { setResponse(null); setOffline(false); }}
            className="text-[var(--text-muted)] hover:text-red-400 transition-colors"
          >
            <X size={9} />
          </button>
        )}
      </div>

      {response && expanded && (
        <div className="mt-1.5 p-2 bg-cyan-950/20 border border-cyan-900/30 text-[9px] font-mono text-[var(--text-secondary)] leading-relaxed max-h-40 overflow-y-auto styled-scrollbar whitespace-pre-wrap">
          {response}
          {loading && <span className="animate-pulse text-cyan-500">▊</span>}
        </div>
      )}
    </div>
  );
}


// ---------------------------------------------------------------------------
// OllamaQueryInput — free-text AI query input for sidebar
// ---------------------------------------------------------------------------

interface OllamaQueryInputProps {
  context?: string;
  placeholder?: string;
}

export function OllamaQueryInput({ context, placeholder }: OllamaQueryInputProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || loading) return;

    setLoading(true);
    setResponse(null);
    setOffline(false);
    abortRef.current = new AbortController();

    try {
      const res = await fetch(`${API_BASE}/api/ollama/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: query.trim(), context }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) { setOffline(true); return; }

      const reader = res.body?.getReader();
      if (!reader) { setOffline(true); return; }

      let fullText = '';
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n').filter(Boolean)) {
          try {
            const data = JSON.parse(line);
            if (data.error) { setOffline(true); reader.cancel(); return; }
            if (data.response) { fullText += data.response; setResponse(fullText); }
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') setOffline(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border-t border-[var(--border-primary)] pt-2 pb-1">
      <div className="px-3 flex items-center gap-1 mb-1">
        <Bot size={8} className="text-cyan-500 flex-shrink-0" />
        <span className="text-[8px] font-mono tracking-widest text-[var(--text-muted)] uppercase">
          Ask Catto
        </span>
        {offline && (
          <span className="text-[7px] font-mono text-red-400/60 ml-1">OFFLINE</span>
        )}
      </div>
      <form onSubmit={handleSubmit} className="px-3 flex gap-1">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder || 'Ask about current map data...'}
          disabled={loading}
          className="flex-1 bg-[var(--bg-input,#0a0f1a)] border border-[var(--border-primary)] text-[9px] font-mono text-[var(--text-primary)] placeholder:text-[var(--text-muted)] px-2 py-1 outline-none focus:border-cyan-800/60 transition-colors"
        />
        <button
          type="submit"
          disabled={!query.trim() || loading}
          className="px-2 py-1 bg-cyan-950/40 border border-cyan-800/50 text-[9px] font-mono text-cyan-400 hover:bg-cyan-900/30 disabled:opacity-40 transition-colors flex-shrink-0"
        >
          {loading ? <Loader2 size={8} className="animate-spin" /> : '→'}
        </button>
      </form>
      {response && (
        <div className="mx-3 mt-1.5 p-2 bg-cyan-950/20 border border-cyan-900/30 text-[9px] font-mono text-[var(--text-secondary)] leading-relaxed max-h-36 overflow-y-auto styled-scrollbar whitespace-pre-wrap">
          {response}
          {loading && <span className="animate-pulse text-cyan-500">▊</span>}
        </div>
      )}
    </div>
  );
}
