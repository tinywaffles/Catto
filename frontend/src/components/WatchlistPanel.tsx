'use client';

import { useState, useRef } from 'react';
import { Eye, X, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import type { WatchlistEntry, WatchedEntity } from '@/types/watchlist';
import { WATCH_COLORS } from '@/hooks/useWatchlist';

interface Props {
  entries: WatchlistEntry[];
  addEntry: (query: string) => void;
  removeEntry: (id: string) => void;
  watchedEntities: WatchedEntity[];
}

export default function WatchlistPanel({ entries, addEntry, removeEntry, watchedEntities }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Total matched count across all entries
  const totalMatched = watchedEntities.length;

  const handleAdd = () => {
    const q = input.trim();
    if (!q) return;
    addEntry(q);
    setInput('');
    inputRef.current?.focus();
  };

  // Count how many entities matched each entry
  const matchCountById = new Map<string, number>();
  for (const e of watchedEntities) {
    matchCountById.set(e.watchId, (matchCountById.get(e.watchId) ?? 0) + 1);
  }

  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-[var(--text-secondary)] font-mono">
      {/* Header */}
      <button
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-[var(--bg-primary)]/40 transition-colors"
        onClick={() => setCollapsed((v) => !v)}
      >
        <Eye size={11} className="text-amber-400 flex-shrink-0" />
        <span className="text-[9px] font-bold tracking-[0.2em] text-[var(--text-primary)] flex-1 text-left">
          WATCHLIST
        </span>
        {totalMatched > 0 && (
          <span className="text-[8px] px-1.5 py-px bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-sm">
            {totalMatched}
          </span>
        )}
        {entries.length > 0 && totalMatched === 0 && (
          <span className="text-[8px] px-1.5 py-px bg-[var(--bg-primary)] text-[var(--text-muted)] border border-[var(--border-primary)] rounded-sm">
            {entries.length}
          </span>
        )}
        {collapsed ? (
          <ChevronDown size={9} className="text-[var(--text-muted)] flex-shrink-0" />
        ) : (
          <ChevronUp size={9} className="text-[var(--text-muted)] flex-shrink-0" />
        )}
      </button>

      {!collapsed && (
        <div className="border-t border-[var(--border-primary)] pb-2">
          {/* Input row */}
          <div className="flex items-center gap-0 px-3 pt-2.5 pb-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
              }}
              placeholder="callsign · tail no. · vessel · MMSI"
              className="flex-1 bg-[var(--bg-primary)] border border-[var(--border-primary)] border-r-0 px-2 py-1.5 text-[9px] font-mono text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/60 outline-none focus:border-amber-600/60 transition-colors min-w-0"
            />
            <button
              onClick={handleAdd}
              disabled={!input.trim()}
              className="flex items-center justify-center px-2 py-1.5 border border-amber-700/50 bg-amber-950/30 text-amber-400 hover:bg-amber-900/30 hover:border-amber-600/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex-shrink-0"
              aria-label="Add to watchlist"
            >
              <Plus size={11} />
            </button>
          </div>

          {/* Entry list */}
          {entries.length === 0 ? (
            <div className="px-3 py-2 text-[8px] text-[var(--text-muted)]/60 italic">
              no entities tracked
            </div>
          ) : (
            <div className="flex flex-col">
              {entries.map((entry, i) => {
                const color = WATCH_COLORS[i % WATCH_COLORS.length];
                const count = matchCountById.get(entry.id) ?? 0;
                return (
                  <div
                    key={entry.id}
                    className="flex items-center gap-2 px-3 py-1.5 border-t border-[var(--border-primary)]/40 first:border-t-0 hover:bg-[var(--bg-primary)]/30 transition-colors group"
                  >
                    {/* Color dot */}
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    {/* Query label */}
                    <span className="flex-1 text-[10px] font-mono text-[var(--text-primary)] truncate font-semibold tracking-wide uppercase">
                      {entry.query}
                    </span>
                    {/* Match count badge */}
                    <span
                      className={`text-[7px] font-mono px-1 py-px rounded-sm flex-shrink-0 ${
                        count > 0
                          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          : 'text-[var(--text-muted)]/50 border border-[var(--border-primary)]/50'
                      }`}
                    >
                      {count > 0 ? `${count}m` : '—'}
                    </span>
                    {/* Remove button */}
                    <button
                      onClick={() => removeEntry(entry.id)}
                      className="text-[var(--text-muted)]/40 hover:text-red-400 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
                      aria-label={`Remove ${entry.query} from watchlist`}
                    >
                      <X size={9} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
