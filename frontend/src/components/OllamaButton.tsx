'use client';

import { useState, useCallback, useRef } from 'react';
import { Bot, Loader2, X, ChevronDown, ChevronUp, Globe } from 'lucide-react';
import { API_BASE } from '@/lib/api';

interface OllamaButtonProps {
  label: string;
  prompt: string;
  context?: string;
  className?: string;
  compact?: boolean;
  /** When true, response panel floats above the button instead of below */
  popupUp?: boolean;
}

export default function OllamaButton({ label, prompt, context, className, compact, popupUp }: OllamaButtonProps) {
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

  const responsePanel = response && expanded ? (
    <div className="p-2 bg-[#060a12] border border-cyan-900/50 text-[9px] font-mono text-[var(--text-secondary)] leading-relaxed max-h-40 overflow-y-auto styled-scrollbar whitespace-pre-wrap shadow-xl">
      {response}
      {loading && <span className="animate-pulse text-cyan-500">▊</span>}
    </div>
  ) : null;

  return (
    <div className={`${popupUp ? 'relative' : ''} ${className ?? ''}`}>
      {/* When popupUp, show response panel above */}
      {popupUp && responsePanel && (
        <div className="absolute bottom-full left-0 mb-1.5 w-72 z-50 shadow-xl">
          {responsePanel}
        </div>
      )}

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

      {/* When not popupUp, show response panel below as normal */}
      {!popupUp && responsePanel && (
        <div className="mt-1.5">
          {responsePanel}
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
  large?: boolean;
}

export function OllamaQueryInput({ context, placeholder, large }: OllamaQueryInputProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [webSearch, setWebSearch] = useState(true);
  const [webSearching, setWebSearching] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || loading) return;

    setLoading(true);
    setResponse(null);
    setOffline(false);
    setWebSearching(false);
    abortRef.current = new AbortController();

    try {
      const res = await fetch(`${API_BASE}/api/ollama/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: query.trim(), context, web_search: webSearch }),
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
            if (data.status === 'web_search_complete') { setWebSearching(false); continue; }
            if (data.error) { setOffline(true); reader.cancel(); return; }
            if (data.response) { fullText += data.response; setResponse(fullText); }
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') setOffline(true);
    } finally {
      setLoading(false);
      setWebSearching(false);
    }
  };

  const px = large ? 'px-3' : 'px-3';
  const inputCls = large
    ? 'flex-1 bg-[#060a12] border border-cyan-900/50 text-[11px] font-mono text-[var(--text-primary)] placeholder:text-[var(--text-muted)] px-3 py-2 outline-none focus:border-cyan-600/60 transition-colors'
    : 'flex-1 bg-[var(--bg-input,#0a0f1a)] border border-[var(--border-primary)] text-[9px] font-mono text-[var(--text-primary)] placeholder:text-[var(--text-muted)] px-2 py-1 outline-none focus:border-cyan-800/60 transition-colors';
  const btnCls = large
    ? 'px-3 py-2 bg-cyan-950/40 border border-cyan-800/50 text-[11px] font-mono text-cyan-400 hover:bg-cyan-900/30 disabled:opacity-40 transition-colors flex-shrink-0'
    : 'px-2 py-1 bg-cyan-950/40 border border-cyan-800/50 text-[9px] font-mono text-cyan-400 hover:bg-cyan-900/30 disabled:opacity-40 transition-colors flex-shrink-0';
  const responseCls = large
    ? 'mt-2 p-3 bg-[#060a12] border border-cyan-900/50 text-[10px] font-mono text-[var(--text-secondary)] leading-relaxed max-h-48 overflow-y-auto styled-scrollbar whitespace-pre-wrap'
    : 'mt-1.5 p-2 bg-[#060a12] border border-cyan-900/30 text-[9px] font-mono text-[var(--text-secondary)] leading-relaxed max-h-36 overflow-y-auto styled-scrollbar whitespace-pre-wrap';

  return (
    <div className={`${large ? 'p-3' : 'border-t border-[var(--border-primary)] pt-2 pb-1'}`}>
      {/* Header row */}
      <div className={`${px} flex items-center justify-between gap-1.5 ${large ? 'mb-2' : 'mb-1'}`}>
        <div className="flex items-center gap-1.5">
          <Bot size={large ? 13 : 8} className="text-cyan-500 flex-shrink-0" />
          <span className={`${large ? 'text-[12px]' : 'text-[8px]'} font-mono tracking-widest text-cyan-400 uppercase font-bold`}>
            Ask Catto
          </span>
          {offline && (
            <span className={`${large ? 'text-[9px]' : 'text-[7px]'} font-mono text-red-400/70 ml-1`}>AI OFFLINE</span>
          )}
          {webSearching && (
            <span className="text-[9px] font-mono text-emerald-400 flex items-center gap-1 animate-pulse">
              <Globe size={9} className="animate-spin" /> SEARCHING WEB...
            </span>
          )}
        </div>
        {/* Web search toggle */}
        <button
          type="button"
          onClick={() => setWebSearch((v) => !v)}
          title={webSearch ? 'Web search ON — Catto will search the internet' : 'Web search OFF — Catto uses only local data'}
          className={`flex items-center gap-1 px-1.5 py-0.5 border text-[8px] font-mono transition-colors ${
            webSearch
              ? 'border-emerald-600/60 text-emerald-400 bg-emerald-950/30'
              : 'border-[var(--border-primary)] text-[var(--text-muted)] hover:border-cyan-800/50'
          }`}
        >
          <Globe size={8} />
          WEB
        </button>
      </div>

      {/* Input row */}
      <form onSubmit={handleSubmit} className={`${px} flex gap-1.5`}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder || (webSearch ? 'Ask anything — Catto will search the web...' : 'Ask about current map data...')}
          disabled={loading}
          className={inputCls}
        />
        <button
          type="submit"
          disabled={!query.trim() || loading}
          className={btnCls}
        >
          {loading ? <Loader2 size={large ? 12 : 8} className="animate-spin" /> : '→'}
        </button>
      </form>

      {/* Response */}
      {response && (
        <div className={`${px} ${responseCls.startsWith('mt') ? '' : 'mt-2'} ${responseCls}`}>
          {response}
          {loading && <span className="animate-pulse text-cyan-500">▊</span>}
        </div>
      )}
    </div>
  );
}
