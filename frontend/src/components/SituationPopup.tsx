'use client';

import { useState } from 'react';
import { X, AlertTriangle, MapPin, ChevronDown, ChevronUp, ExternalLink, Activity } from 'lucide-react';
import { useSituationDetector } from '@/hooks/useSituationDetector';
import type { SituationType, SituationDetails } from '@/hooks/useSituationDetector';
import type { CrisisInput } from '@/components/CrisisTracker';

interface Props {
  onFlyTo: (lat: number, lng: number) => void;
  onOpenTracker?: (input: CrisisInput) => void;
}

const TYPE_COLORS: Record<SituationType, { text: string; border: string; dot: string; divider: string }> = {
  'MULTI-DOMAIN ALERT':  { text: 'text-red-400',    border: 'border-red-500/40',    dot: 'bg-red-500',    divider: 'border-red-500/20'    },
  'CONFLICT ESCALATION': { text: 'text-orange-400', border: 'border-orange-500/40', dot: 'bg-orange-500', divider: 'border-orange-500/20' },
  'MILITARY ACTIVITY':   { text: 'text-yellow-400', border: 'border-yellow-500/40', dot: 'bg-yellow-500', divider: 'border-yellow-500/20' },
  'CIVIL UNREST':        { text: 'text-amber-400',  border: 'border-amber-500/40',  dot: 'bg-amber-500',  divider: 'border-amber-500/20'  },
};

const MILITARY_TYPE_LABEL: Record<string, string> = {
  fighter: 'FIGHTER', bomber: 'BOMBER', tanker: 'TANKER',
  recon: 'RECON', cargo: 'CARGO', heli: 'HELI', default: 'MIL',
};

function readDismissed(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem('catto:dismissed-situations');
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function writeDismissed(set: Set<string>) {
  try {
    localStorage.setItem('catto:dismissed-situations', JSON.stringify([...set]));
  } catch { /* ignore */ }
}

// ── WHY detail panel ─────────────────────────────────────────────────────────

function SignalBlock({
  label,
  count,
  threshold,
  spiked,
  children,
}: {
  label: string;
  count: number;
  threshold: number;
  spiked: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <span className={`text-[8px] font-mono font-bold tracking-[0.15em] ${spiked ? 'text-red-400' : 'text-[var(--text-muted)]'}`}>
          {label}
        </span>
        <span className="text-[8px] font-mono text-[var(--text-muted)]">
          {count} / {threshold} threshold
        </span>
        {spiked && (
          <span className="text-[7px] font-mono px-1 py-px bg-red-500/15 text-red-400 border border-red-500/30">
            SPIKE
          </span>
        )}
      </div>
      <div className="flex flex-col gap-0.5 pl-2">
        {children}
      </div>
    </div>
  );
}

function WhyPanel({ details, colors }: { details: SituationDetails; colors: typeof TYPE_COLORS[SituationType] }) {
  return (
    <div className={`border-t ${colors.divider} pt-2.5 pb-1 flex flex-col gap-2.5`}>

      {/* GDELT conflict events */}
      <SignalBlock
        label="CONFLICT EVENTS"
        count={details.conflictCount}
        threshold={details.thresholds.conflict}
        spiked={details.spikes.conflict}
      >
        {details.conflictEvents.length === 0 ? (
          <span className="text-[9px] font-mono text-[var(--text-muted)]/50 italic">no events in window</span>
        ) : (
          details.conflictEvents.map((e, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <span className="text-[var(--text-muted)]/40 text-[9px] font-mono mt-px">▸</span>
              <div className="flex flex-col gap-0 min-w-0">
                {e.url ? (
                  <a
                    href={e.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[9px] font-mono text-[var(--text-secondary)] hover:text-blue-400 leading-tight truncate flex items-center gap-1"
                  >
                    <span className="truncate">{e.title}</span>
                    <ExternalLink size={7} className="flex-shrink-0 opacity-60" />
                  </a>
                ) : (
                  <span className="text-[9px] font-mono text-[var(--text-secondary)] leading-tight truncate">{e.title}</span>
                )}
                <div className="flex items-center gap-1.5">
                  {e.date && (
                    <span className="text-[7px] font-mono text-[var(--text-muted)]/60">
                      {new Date(e.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  {e.tone !== undefined && (
                    <span className={`text-[7px] font-mono ${e.tone < -5 ? 'text-red-400/70' : e.tone < 0 ? 'text-amber-400/70' : 'text-green-400/70'}`}>
                      tone {e.tone.toFixed(1)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        {details.conflictCount > details.conflictEvents.length && (
          <span className="text-[7px] font-mono text-[var(--text-muted)]/50 pl-3">
            +{details.conflictCount - details.conflictEvents.length} more
          </span>
        )}
      </SignalBlock>

      {/* Military aircraft */}
      <SignalBlock
        label="MILITARY AIRCRAFT"
        count={details.militaryCount}
        threshold={details.thresholds.military}
        spiked={details.spikes.military}
      >
        {details.militaryFlights.length === 0 ? (
          <span className="text-[9px] font-mono text-[var(--text-muted)]/50 italic">no tracked aircraft</span>
        ) : (
          <div className="flex flex-wrap gap-x-2 gap-y-0.5">
            {details.militaryFlights.map((f, i) => (
              <div key={i} className="flex items-center gap-1">
                <span className="text-[9px] font-mono text-[var(--text-secondary)] font-semibold">
                  {f.callsign}
                </span>
                {f.military_type && f.military_type !== 'default' && (
                  <span className="text-[7px] font-mono text-[var(--text-muted)]/70 px-0.5 border border-[var(--text-muted)]/20">
                    {MILITARY_TYPE_LABEL[f.military_type] ?? f.military_type.toUpperCase()}
                  </span>
                )}
                {f.force && (
                  <span className="text-[7px] font-mono text-[var(--text-muted)]/60">{f.force}</span>
                )}
              </div>
            ))}
          </div>
        )}
        {details.militaryCount > details.militaryFlights.length && (
          <span className="text-[7px] font-mono text-[var(--text-muted)]/50 pl-3">
            +{details.militaryCount - details.militaryFlights.length} more
          </span>
        )}
      </SignalBlock>

      {/* News volume */}
      <SignalBlock
        label="NEWS VOLUME"
        count={details.newsCount}
        threshold={details.thresholds.news}
        spiked={details.spikes.news}
      >
        {details.newsItems.length === 0 ? (
          <span className="text-[9px] font-mono text-[var(--text-muted)]/50 italic">no clusters</span>
        ) : (
          details.newsItems.map((n, i) => (
            <div key={i} className="flex items-start gap-1.5 min-w-0">
              <span className="text-[var(--text-muted)]/40 text-[9px] font-mono mt-px flex-shrink-0">▸</span>
              <div className="flex flex-col gap-0 min-w-0">
                <div className="flex items-center gap-1 min-w-0">
                  <span className="text-[9px] font-mono text-[var(--text-secondary)] font-semibold truncate">{n.name}</span>
                  {n.url && (
                    <a href={n.url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 text-[var(--text-muted)]/50 hover:text-blue-400">
                      <ExternalLink size={7} />
                    </a>
                  )}
                </div>
                {n.topHeadline && (
                  <span className="text-[8px] font-mono text-[var(--text-muted)]/70 leading-tight line-clamp-2">{n.topHeadline}</span>
                )}
              </div>
            </div>
          ))
        )}
        {details.newsCount > details.newsItems.length && (
          <span className="text-[7px] font-mono text-[var(--text-muted)]/50 pl-3">
            +{details.newsCount - details.newsItems.length} more clusters
          </span>
        )}
      </SignalBlock>

    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SituationPopup({ onFlyTo, onOpenTracker }: Props) {
  const { situations } = useSituationDetector();
  const [dismissed, setDismissed] = useState<Set<string>>(readDismissed);
  const [whyOpenId, setWhyOpenId] = useState<string | null>(null);

  const active = situations.filter((s) => !dismissed.has(s.id));
  const current = active[0] ?? null;

  const dismiss = (id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      writeDismissed(next);
      return next;
    });
    if (whyOpenId === id) setWhyOpenId(null);
  };

  if (!current) return null;

  const colors = TYPE_COLORS[current.type];
  const whyOpen = whyOpenId === current.id;

  const elapsed = Date.now() - current.firstDetected;
  const firstDetectedStr =
    elapsed < 60_000      ? 'just now'
    : elapsed < 3_600_000 ? `${Math.floor(elapsed / 60_000)}m ago`
    :                       `${Math.floor(elapsed / 3_600_000)}h ago`;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[210] pointer-events-auto">
      <div
        className={`flex flex-col bg-[#06090f]/95 border ${colors.border} backdrop-blur-md w-[400px] max-w-[calc(100vw-2rem)]`}
      >
        {/* ── Header row ── */}
        <div className="flex items-center gap-3 px-4 py-3">
          {/* Pulse dot + icon */}
          <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
            <span className={`w-2 h-2 rounded-full ${colors.dot} animate-pulse`} />
            <AlertTriangle size={11} className={colors.text} />
          </div>

          {/* Content */}
          <div className="flex flex-col gap-0.5 flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className={`text-[9px] font-mono font-bold tracking-[0.18em] ${colors.text}`}>
                {current.type}
              </span>
              <button
                onClick={() => dismiss(current.id)}
                className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] flex-shrink-0 ml-1"
                aria-label="Dismiss"
              >
                <X size={11} />
              </button>
            </div>

            <span className="text-[12px] font-mono text-[var(--text-primary)] font-semibold truncate">
              {current.region}
            </span>

            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[9px] font-mono text-[var(--text-muted)]">
                {current.signalCount} signals
              </span>
              <span className="text-[var(--text-muted)] text-[9px]">·</span>
              <span className="text-[9px] font-mono text-[var(--text-muted)]">
                {firstDetectedStr}
              </span>
              {active.length > 1 && (
                <>
                  <span className="text-[var(--text-muted)] text-[9px]">·</span>
                  <span className="text-[8px] font-mono text-[var(--text-muted)]/60">
                    +{active.length - 1} more
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* TRACK button */}
            {onOpenTracker && (
              <button
                onClick={() => onOpenTracker({ source: 'situation', data: current })}
                className="flex items-center gap-1 px-2 py-1.5 border border-purple-800/50 text-purple-400 hover:border-purple-500/50 hover:text-purple-300 transition-colors"
                aria-label="Open crisis tracker"
              >
                <Activity size={9} />
                <span className="text-[8px] font-mono tracking-wider">TRACK</span>
              </button>
            )}
            {/* WHY button */}
            <button
              onClick={() => setWhyOpenId(whyOpen ? null : current.id)}
              className={`flex items-center gap-1 px-2 py-1.5 border transition-colors ${
                whyOpen
                  ? `${colors.border} ${colors.text} bg-white/5`
                  : 'border-[var(--text-muted)]/30 text-[var(--text-muted)] hover:border-[var(--text-muted)]/60 hover:text-[var(--text-secondary)]'
              }`}
              aria-label="Show signal breakdown"
              aria-expanded={whyOpen}
            >
              <span className="text-[8px] font-mono tracking-wider">WHY</span>
              {whyOpen
                ? <ChevronUp size={9} />
                : <ChevronDown size={9} />
              }
            </button>

            {/* VIEW button */}
            <button
              onClick={() => {
                onFlyTo(current.center[0], current.center[1]);
                dismiss(current.id);
              }}
              className="flex items-center gap-1 px-2 py-1.5 border border-cyan-800/50 text-cyan-400 hover:border-cyan-500/50 hover:text-cyan-300 transition-colors"
              aria-label="View on map"
            >
              <MapPin size={10} />
              <span className="text-[8px] font-mono tracking-wider">VIEW</span>
            </button>
          </div>
        </div>

        {/* ── WHY detail panel (collapsible) ── */}
        {whyOpen && (
          <div className="px-4 pb-3">
            <WhyPanel details={current.details} colors={colors} />
          </div>
        )}
      </div>
    </div>
  );
}
