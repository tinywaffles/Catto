'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, Activity, Send, AlertTriangle, X, ExternalLink } from 'lucide-react';
import { useDataKey } from '@/hooks/useDataStore';
import type { TelegramPost, SgSecureAlert } from '@/types/dashboard';

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onOpenTracker?: (input: any) => void;
  onFlyTo?: (lat: number, lng: number) => void;
}

const CONFLICT_KEYWORDS = [
  'strike', 'missile', 'shelling', 'explosion', 'attack', 'airstrike',
  'troops', 'killed', 'wounded', 'destroyed', 'offensive', 'drone',
  'artillery', 'himars', 'ceasefire', 'invasion', 'war', 'combat',
  'military operation', 'forces', 'shot down', 'intercepted',
];

function matchKeyword(text: string): string | null {
  const lower = text.toLowerCase();
  return CONFLICT_KEYWORDS.find((kw) => lower.includes(kw)) ?? null;
}

function relTimeIso(iso: string): string {
  if (!iso) return '';
  try {
    const d = Date.now() - new Date(iso).getTime();
    if (d < 60_000)      return 'just now';
    if (d < 3_600_000)   return `${Math.floor(d / 60_000)}m ago`;
    if (d < 86_400_000)  return `${Math.floor(d / 3_600_000)}h ago`;
    return `${Math.floor(d / 86_400_000)}d ago`;
  } catch { return ''; }
}

function fmtTimestamp(iso: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('en-SG', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
      timeZone: 'Asia/Singapore',
    }) + ' SGT';
  } catch { return iso; }
}

const CHANNEL_COLORS: Record<string, string> = {
  intelslava:          'text-blue-400 border-blue-700/50',
  rybar:               'text-red-400 border-red-700/50',
  militarylandnet:     'text-amber-400 border-amber-700/50',
  warmonitor:          'text-orange-400 border-orange-700/50',
  MiddleEastEye:       'text-emerald-400 border-emerald-700/50',
  MENAConflictMonitor: 'text-purple-400 border-purple-700/50',
};

function shortChannel(name: string): string {
  return name
    .replace('MiddleEastEye', 'MEE')
    .replace('MENAConflictMonitor', 'MENA')
    .replace('militarylandnet', 'MILLAND')
    .replace('warmonitor', 'WARMON')
    .replace('intelslava', 'ISLAVA')
    .toUpperCase();
}

function ChannelTag({ name }: { name: string }) {
  const cls = CHANNEL_COLORS[name] ?? 'text-blue-400 border-blue-700/50';
  return <span className={`text-[7px] font-mono px-1 border ${cls}`}>{shortChannel(name)}</span>;
}

// ── Telegram post expand popup ─────────────────────────────────────────────
interface TgPopupProps {
  post: TelegramPost;
  keyword: string;
  onClose: () => void;
}

function TelegramPopup({ post, keyword, onClose }: TgPopupProps) {
  const backdropRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const channelCls = CHANNEL_COLORS[post.channel] ?? 'text-blue-400 border-blue-700/50';

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className="w-[420px] max-w-[90vw] bg-[var(--bg-secondary)] border border-blue-900/50 flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-primary)]/80 bg-blue-950/20">
          <div className="flex items-center gap-2">
            <Send size={11} className="text-blue-400" />
            <span className={`text-[9px] font-mono px-1.5 border ${channelCls}`}>
              {shortChannel(post.channel)}
            </span>
            <span className="text-[8px] font-mono text-amber-400/80 px-1 border border-amber-700/30">
              {keyword.toUpperCase()}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center border border-[var(--border-primary)] hover:border-red-500/50 hover:text-red-400 text-[var(--text-muted)] transition-all hover:bg-red-950/20"
          >
            <X size={11} />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-3 space-y-3 max-h-[60vh] overflow-y-auto styled-scrollbar">
          <p className="text-[11px] font-mono text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">
            {post.text}
          </p>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[var(--border-primary)]/80 flex items-center justify-between">
          <span className="text-[9px] font-mono text-[var(--text-muted)]/60">
            {fmtTimestamp(post.timestamp)}
          </span>
          <a
            href={post.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 text-[9px] font-mono tracking-wide transition-all"
          >
            <ExternalLink size={9} />
            Open in Telegram
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────
export default function CattoIntelPanel({ }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [expandedPost, setExpandedPost] = useState<{ post: TelegramPost; keyword: string } | null>(null);

  const telegramPosts = (useDataKey('telegram_posts') as TelegramPost[] | undefined) ?? [];
  const sgSecure      = (useDataKey('sgsecure_alerts') as SgSecureAlert[] | undefined) ?? [];

  const tgAlerts = telegramPosts
    .map((p) => ({ post: p, keyword: matchKeyword(p.text) }))
    .filter((x): x is { post: TelegramPost; keyword: string } => x.keyword !== null)
    .slice(0, 10);

  const sgAlerts = sgSecure.slice(0, 5);
  const totalCount = tgAlerts.length + sgAlerts.length;
  const badgeColor = totalCount > 0
    ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
    : 'bg-gray-800/40 text-gray-500 border-gray-700/30';

  return (
    <>
      {expandedPost && (
        <TelegramPopup
          post={expandedPost.post}
          keyword={expandedPost.keyword}
          onClose={() => setExpandedPost(null)}
        />
      )}

      <div className="bg-[var(--bg-panel)] border border-[var(--border-primary)] backdrop-blur-sm overflow-hidden">
        {/* Header */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="w-full flex items-center justify-between px-3 py-2 hover:bg-cyan-950/20 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Activity size={10} className="text-cyan-500" />
            <span className="text-[10px] font-mono font-bold tracking-[0.2em] text-cyan-400 uppercase">
              SIGINT
            </span>
            <span className={`text-[8px] font-mono px-1.5 py-0.5 border rounded-sm ${badgeColor}`}>
              {totalCount}
            </span>
          </div>
          {collapsed
            ? <ChevronDown size={10} className="text-cyan-700" />
            : <ChevronUp   size={10} className="text-cyan-700" />}
        </button>

        {!collapsed && (
          <div className="border-t border-[var(--border-primary)] flex flex-col divide-y divide-[var(--border-primary)]/40">

            {totalCount === 0 && (
              <div className="px-3 py-3 text-[9px] font-mono text-[var(--text-muted)] text-center">
                No alerts
              </div>
            )}

            {/* ── Telegram conflict keyword matches ── */}
            {tgAlerts.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-950/20">
                  <Send size={8} className="text-blue-400" />
                  <span className="text-[7.5px] font-mono tracking-[0.15em] text-blue-400/80 uppercase">
                    Telegram Intel
                  </span>
                  <span className="ml-auto text-[7px] font-mono text-blue-500/50">{tgAlerts.length}</span>
                </div>
                {tgAlerts.map(({ post, keyword }) => (
                  <button
                    key={`${post.channel}-${post.message_id}`}
                    onClick={() => setExpandedPost({ post, keyword })}
                    className="w-full flex gap-2 items-start px-3 py-2 hover:bg-blue-950/10 transition-colors border-t border-[var(--border-primary)]/30 text-left"
                  >
                    <span className="block w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0 mt-1" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 mb-0.5 flex-wrap">
                        <ChannelTag name={post.channel} />
                        <span className="text-[7px] font-mono text-amber-400/80 px-1 border border-amber-700/30">
                          {keyword.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-[9px] font-mono text-[var(--text-secondary)] leading-snug line-clamp-2">
                        {post.text.slice(0, 100)}{post.text.length > 100 ? '…' : ''}
                      </p>
                      <span className="text-[7.5px] font-mono text-[var(--text-muted)]/60">
                        {relTimeIso(post.timestamp)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* ── SGSecure alerts ── */}
            {sgAlerts.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 px-3 py-1 bg-red-950/20">
                  <AlertTriangle size={8} className="text-red-400" />
                  <span className="text-[7.5px] font-mono tracking-[0.15em] text-red-400/80 uppercase">
                    SGSecure
                  </span>
                  <span className="ml-auto text-[7px] font-mono text-red-500/50">{sgAlerts.length}</span>
                </div>
                {sgAlerts.map((alert, i) => (
                  <a
                    key={i}
                    href={alert.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex gap-2 items-start px-3 py-2 hover:bg-red-950/10 transition-colors border-t border-[var(--border-primary)]/30"
                  >
                    <span className="block w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0 mt-1" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] font-mono text-[var(--text-secondary)] leading-snug line-clamp-2">
                        {alert.title}
                      </p>
                      <span className="text-[7.5px] font-mono text-[var(--text-muted)]/60">
                        {relTimeIso(alert.date)}
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            )}

          </div>
        )}
      </div>
    </>
  );
}
