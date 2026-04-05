'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, Rss } from 'lucide-react';
import type { LiveUAmapIncident } from '@/types/dashboard';
import OllamaButton from '@/components/OllamaButton';

interface RssItem {
  source: string;
  title: string;
  link: string;
  pub_date: string;
  summary: string;
}

interface TelegramPost {
  id?: string | number;
  channel?: string;
  text?: string;
  date?: string;
  timestamp?: string;
  lat?: number;
  lng?: number;
}

interface Props {
  liveuamap?: LiveUAmapIncident[];
  telegramPosts?: TelegramPost[];
}

function relTime(iso: string): string {
  if (!iso) return '';
  try {
    const d = Date.now() - new Date(iso).getTime();
    if (d < 60_000) return 'just now';
    if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`;
    if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`;
    return `${Math.floor(d / 86_400_000)}d ago`;
  } catch { return ''; }
}


function useRss(source: string) {
  const [items, setItems] = useState<RssItem[]>([]);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const r = await fetch(`/api/osint/rss?source=${source}`);
        if (r.ok && active) setItems(await r.json());
      } catch { /* ignore */ }
    };
    void load();
    const t = setInterval(load, 15 * 60 * 1000);
    return () => { active = false; clearInterval(t); };
  }, [source]);
  return items;
}

export default function OsintFeedsPanel({ liveuamap = [], telegramPosts = [] }: Props) {
  const bcItems  = useRss('bellingcat');
  const [bcOpen, setBcOpen] = useState(true);
  const [tgOpen, setTgOpen] = useState(true);

  const luaItems = liveuamap.slice(0, 3);

  // Filter Telegram posts from last 2 hours
  const twoHoursAgo = Date.now() - 2 * 3600 * 1000;
  const recentTg = telegramPosts.filter((p) => {
    const ts = p.date || p.timestamp;
    if (!ts) return true; // include if no timestamp
    try { return new Date(ts).getTime() >= twoHoursAgo; } catch { return true; }
  }).slice(0, 10);

  const tgDigestContext = recentTg.map((p) =>
    `[${p.channel || 'unknown'}] ${p.text || ''}${p.date ? ` (${p.date})` : ''}`
  ).join('\n');

  return (
    <div className="mt-2 flex flex-col gap-3">

      {/* ── Bellingcat ─────────────────────────────────────────────────── */}
      <div>
        <button onClick={() => setBcOpen(o => !o)} className="flex items-center gap-1.5 mb-1.5 w-full">
          <Rss size={9} className="text-rose-400" />
          <span className="text-[9px] font-mono font-bold tracking-[0.15em] text-rose-400/80 uppercase">Bellingcat</span>
          {bcOpen ? <ChevronUp size={8} className="ml-auto text-rose-500/50" /> : <ChevronDown size={8} className="ml-auto text-rose-500/50" />}
        </button>
        {bcOpen && (
          bcItems.length === 0 ? (
            <p className="text-[8px] font-mono text-[var(--text-muted)]/50 pl-1">Loading…</p>
          ) : (
            <div className="flex flex-col gap-1">
              {bcItems.slice(0, 3).map((item, i) => (
                <a
                  key={i}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-1.5 bg-rose-950/10 border border-rose-900/20 px-2 py-1.5 hover:border-rose-500/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-mono text-[var(--text-secondary)] leading-snug line-clamp-2">
                      {item.title}
                    </p>
                    <span className="text-[7.5px] font-mono text-[var(--text-muted)]/60">
                      {relTime(item.pub_date)}
                    </span>
                  </div>
                  <ExternalLink size={8} className="text-rose-500/40 flex-shrink-0 mt-0.5" />
                </a>
              ))}
            </div>
          )
        )}
      </div>

      {/* ── LiveUAMap ──────────────────────────────────────────────────── */}
      {luaItems.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Rss size={9} className="text-cyan-400" />
            <span className="text-[9px] font-mono font-bold tracking-[0.15em] text-cyan-400/80 uppercase">
              LiveUAMap
            </span>
          </div>
          <div className="flex flex-col gap-1">
            {luaItems.map((item) => (
              <a
                key={item.id}
                href={item.link ?? `https://liveuamap.com/en/${item.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-1.5 bg-cyan-950/10 border border-cyan-900/20 px-2 py-1.5 hover:border-cyan-500/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-mono text-[var(--text-secondary)] leading-snug line-clamp-2">
                    {item.title}
                  </p>
                  <span className="text-[7.5px] font-mono text-[var(--text-muted)]/60">
                    {item.region ? `${item.region} · ` : ''}{relTime(item.date)}
                  </span>
                </div>
                <ExternalLink size={8} className="text-cyan-500/40 flex-shrink-0 mt-0.5" />
              </a>
            ))}
          </div>
        </div>
      )}


      {/* ── Telegram Channels ─────────────────────────────────────────── */}
      {(recentTg.length > 0 || telegramPosts.length > 0) && (
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <button onClick={() => setTgOpen(o => !o)} className="flex items-center gap-1.5 flex-1 min-w-0">
              <Rss size={9} className="text-blue-400 flex-shrink-0" />
              <span className="text-[9px] font-mono font-bold tracking-[0.15em] text-blue-400/80 uppercase">
                Telegram Signals
              </span>
              <span className="text-[7px] font-mono text-[var(--text-muted)] ml-1">{recentTg.length} / 2h</span>
              {tgOpen ? <ChevronUp size={8} className="ml-auto text-blue-500/50" /> : <ChevronDown size={8} className="ml-auto text-blue-500/50" />}
            </button>
            <OllamaButton
              label="DIGEST"
              compact
              prompt="Summarise these Telegram signals from the last 2 hours into exactly 3 bullet points. Focus on military movements, conflict events, or security incidents. Be direct and intelligence-style terse."
              context={tgDigestContext || 'No recent Telegram posts available.'}
            />
          </div>
          {tgOpen && (
            <div className="flex flex-col gap-1">
              {recentTg.length === 0 ? (
                <p className="text-[8px] font-mono text-[var(--text-muted)]/50 pl-1">No Telegram signals in last 2h</p>
              ) : (
                recentTg.map((post, i) => (
                  <div
                    key={i}
                    className="flex flex-col gap-0.5 bg-blue-950/10 border border-blue-900/20 px-2 py-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[8px] font-mono font-bold text-blue-400/80 truncate">{post.channel || 'Unknown'}</span>
                      <span className="text-[7px] font-mono text-[var(--text-muted)]/60 flex-shrink-0 ml-1">{relTime(post.date || post.timestamp || '')}</span>
                    </div>
                    {post.text && (
                      <p className="text-[9px] font-mono text-[var(--text-secondary)] leading-snug line-clamp-2">
                        {post.text}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
