'use client';

import { useEffect, useCallback } from 'react';
import {
  X, Clock, AlertTriangle, Plane, Ship, Globe, Radio,
  ExternalLink, Download, MapPin,
} from 'lucide-react';
import type { Situation, SituationType } from '@/hooks/useSituationDetector';
import type { PatternAlert, PatternAlertType, PatternEvidence } from '@/types/dashboard';

// ── Public type consumed by SituationPopup + CattoIntelPanel ─────────────────
export type CrisisInput =
  | { source: 'situation'; data: Situation }
  | { source: 'pattern'; data: PatternAlert };

interface Props {
  input: CrisisInput;
  onClose: () => void;
  onFlyTo?: (lat: number, lng: number) => void;
}

// ── Colours ───────────────────────────────────────────────────────────────────
const SIT_COLORS: Record<SituationType, { text: string; border: string; bg: string }> = {
  'MULTI-DOMAIN ALERT':  { text: 'text-red-400',    border: 'border-red-500/40',    bg: 'bg-red-500/10'    },
  'CONFLICT ESCALATION': { text: 'text-orange-400', border: 'border-orange-500/40', bg: 'bg-orange-500/10' },
  'MILITARY ACTIVITY':   { text: 'text-yellow-400', border: 'border-yellow-500/40', bg: 'bg-yellow-500/10' },
  'CIVIL UNREST':        { text: 'text-amber-400',  border: 'border-amber-500/40',  bg: 'bg-amber-500/10'  },
};

const PAT_COLORS: Record<PatternAlertType, { text: string; border: string; bg: string }> = {
  AIS_DARK:     { text: 'text-cyan-400',   border: 'border-cyan-500/40',   bg: 'bg-cyan-500/10'   },
  MILITARY_GRID:{ text: 'text-yellow-400', border: 'border-yellow-500/40', bg: 'bg-yellow-500/10' },
  MULTI_DOMAIN: { text: 'text-red-400',    border: 'border-red-500/40',    bg: 'bg-red-500/10'    },
};

const DOMAIN_ICON: Record<PatternEvidence['domain'], React.ComponentType<{ size?: number; className?: string }>> = {
  maritime: Ship,
  aviation: Plane,
  conflict: AlertTriangle,
  cyber:    Radio,
  internet: Globe,
};

const DOMAIN_COLOR: Record<PatternEvidence['domain'], string> = {
  maritime: 'text-blue-400',
  aviation: 'text-yellow-400',
  conflict: 'text-red-400',
  cyber:    'text-cyan-400',
  internet: 'text-orange-400',
};

const DOMAIN_BORDER: Record<PatternEvidence['domain'], string> = {
  maritime: 'border-blue-500/50',
  aviation: 'border-yellow-500/50',
  conflict: 'border-red-500/50',
  cyber:    'border-cyan-500/50',
  internet: 'border-orange-500/50',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtTs(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC',
  }) + ' UTC';
}

function relTime(ts: number): string {
  const d = Date.now() - ts;
  if (d < 60_000) return 'just now';
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`;
  return `${Math.floor(d / 3_600_000)}h ${Math.floor((d % 3_600_000) / 60_000)}m ago`;
}

function exportJson(input: CrisisInput) {
  const id = input.source === 'situation' ? input.data.id : input.data.id;
  const blob = new Blob([JSON.stringify(input.source === 'situation' ? input.data : input.data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `catto-crisis-${id}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Timeline entry ────────────────────────────────────────────────────────────
interface TimelineEntry {
  domain: PatternEvidence['domain'];
  label: string;
  detail?: string;
  ts?: number;
  url?: string;
  anchor?: boolean;
}

function buildSituationTimeline(data: Situation): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  for (const e of data.details.conflictEvents) {
    entries.push({
      domain: 'conflict',
      label: e.title,
      detail: e.tone !== undefined ? `tone ${e.tone.toFixed(1)}` : undefined,
      ts: e.date ? new Date(e.date).getTime() : undefined,
      url: e.url,
    });
  }
  for (const f of data.details.militaryFlights) {
    entries.push({
      domain: 'aviation',
      label: f.callsign || '—',
      detail: [f.military_type?.toUpperCase(), f.force, f.country].filter(Boolean).join(' · '),
    });
  }
  for (const n of data.details.newsItems) {
    entries.push({
      domain: 'internet',
      label: n.name,
      detail: n.topHeadline,
      url: n.url,
    });
  }
  entries.sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0));
  entries.push({ domain: 'conflict', label: 'Situation first detected', ts: data.firstDetected, anchor: true });
  return entries;
}

function buildPatternTimeline(data: PatternAlert): TimelineEntry[] {
  const entries: TimelineEntry[] = data.evidence.map((e) => ({
    domain: e.domain,
    label: e.label,
    detail: e.detail,
    ts: e.ts,
  }));
  entries.sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0));
  entries.push({ domain: 'conflict', label: 'Pattern first detected', ts: data.detectedAt, anchor: true });
  return entries;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function CrisisTracker({ input, onClose, onFlyTo }: Props) {
  const handleKey = useCallback(
    (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); },
    [onClose],
  );
  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  const isSit = input.source === 'situation';
  const title  = isSit ? input.data.region              : input.data.title;
  const badge  = isSit ? input.data.type                : input.data.type.replace('_', ' ');
  const colors = isSit ? SIT_COLORS[input.data.type]    : PAT_COLORS[input.data.type];
  const detectedAt = isSit ? input.data.firstDetected   : input.data.detectedAt;
  const lat    = isSit ? input.data.center[0]           : input.data.lat;
  const lng    = isSit ? input.data.center[1]           : input.data.lng;
  const summary = isSit
    ? `${input.data.signalCount} signals · ${input.data.details.conflictCount} conflict · ${input.data.details.militaryCount} military · ${input.data.details.newsCount} news`
    : input.data.summary;

  const timeline = isSit
    ? buildSituationTimeline(input.data)
    : buildPatternTimeline(input.data);

  // Domain summary counts
  const domainCounts = timeline.reduce<Partial<Record<PatternEvidence['domain'], number>>>((acc, e) => {
    if (!e.anchor) acc[e.domain] = (acc[e.domain] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-[500] flex flex-col bg-[#04060d]/97 backdrop-blur-xl font-mono overflow-hidden">

      {/* ── TOP BAR ── */}
      <div className={`flex items-center gap-3 px-6 py-3 border-b ${colors.border} flex-shrink-0`}>
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-[9px] tracking-[0.2em] text-[var(--text-muted)] uppercase flex-1 min-w-0">
          <span>CATTO INTEL</span>
          <span className="opacity-40">›</span>
          <span className={`px-1.5 py-0.5 border ${colors.border} ${colors.bg} ${colors.text} font-bold`}>
            {badge}
          </span>
          <span className="opacity-40">›</span>
          <span className="text-[var(--text-secondary)] truncate">{title}</span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {onFlyTo && (
            <button
              onClick={() => { onFlyTo(lat, lng); onClose(); }}
              className="flex items-center gap-1 px-3 py-1.5 border border-cyan-800/50 text-cyan-400 hover:border-cyan-500/50 text-[9px] tracking-wider transition-colors"
            >
              <MapPin size={9} />
              VIEW ON MAP
            </button>
          )}
          <button
            onClick={() => exportJson(input)}
            className="flex items-center gap-1 px-3 py-1.5 border border-gray-700/50 text-gray-400 hover:border-gray-500/50 text-[9px] tracking-wider transition-colors"
          >
            <Download size={9} />
            EXPORT
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            aria-label="Close crisis tracker"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">

        {/* LEFT — Summary panel */}
        <div className={`lg:w-72 flex-shrink-0 border-b lg:border-b-0 lg:border-r ${colors.border} p-5 flex flex-col gap-4 overflow-y-auto styled-scrollbar`}>

          {/* Alert header */}
          <div>
            <div className={`text-[22px] font-bold ${colors.text} leading-tight mb-1`}>{title}</div>
            <div className="text-[10px] text-[var(--text-muted)] leading-snug">{summary}</div>
          </div>

          {/* Metadata */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-[9px]">
              <Clock size={9} className="text-[var(--text-muted)]" />
              <span className="text-[var(--text-muted)]">Detected</span>
              <span className="text-[var(--text-secondary)]">{fmtTs(detectedAt)}</span>
            </div>
            <div className="text-[9px] text-[var(--text-muted)] pl-[17px]">{relTime(detectedAt)}</div>
            <div className="flex items-center gap-2 text-[9px] mt-0.5">
              <MapPin size={9} className="text-[var(--text-muted)]" />
              <span className="text-[var(--text-muted)]">{lat.toFixed(2)}°, {lng.toFixed(2)}°</span>
            </div>
          </div>

          {/* Domain breakdown */}
          <div>
            <div className="text-[8px] tracking-[0.2em] text-[var(--text-muted)] uppercase mb-2">Signal Domains</div>
            <div className="flex flex-col gap-1.5">
              {(Object.entries(domainCounts) as [PatternEvidence['domain'], number][]).map(([domain, count]) => {
                const Icon = DOMAIN_ICON[domain];
                return (
                  <div key={domain} className="flex items-center gap-2 text-[9px]">
                    <Icon size={9} className={DOMAIN_COLOR[domain]} />
                    <span className={`${DOMAIN_COLOR[domain]} uppercase tracking-wider w-16`}>{domain}</span>
                    <span className="text-[var(--text-muted)]">{count} event{count !== 1 ? 's' : ''}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Severity */}
          <div className={`px-3 py-2 border ${colors.border} ${colors.bg} mt-auto`}>
            <div className="text-[8px] text-[var(--text-muted)] tracking-[0.2em] uppercase mb-0.5">Severity</div>
            <div className={`text-[13px] font-bold ${colors.text}`}>
              {isSit ? input.data.type : input.data.severity}
            </div>
          </div>
        </div>

        {/* RIGHT — Timeline */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 py-3 border-b border-white/5 flex-shrink-0">
            <span className="text-[9px] tracking-[0.25em] text-[var(--text-muted)] uppercase">
              Event Timeline — {timeline.filter(e => !e.anchor).length} entries
            </span>
          </div>
          <div className="flex-1 overflow-y-auto styled-scrollbar px-6 py-4">
            <div className="flex flex-col gap-0 relative">
              {/* Vertical spine */}
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-white/5" />

              {timeline.map((entry, i) => {
                const Icon = DOMAIN_ICON[entry.domain];
                const color = DOMAIN_COLOR[entry.domain];
                return (
                  <div key={i} className={`relative flex gap-4 ${entry.anchor ? 'mt-4 opacity-40' : 'py-2.5'} border-b border-white/4 last:border-0`}>
                    {/* Dot on spine */}
                    <div className="flex-shrink-0 flex flex-col items-center pt-0.5">
                      <div className={`w-3.5 h-3.5 rounded-full border ${entry.anchor ? 'border-white/20 bg-transparent' : `${DOMAIN_BORDER[entry.domain]} ${colors.bg}`} flex items-center justify-center z-10`}>
                        <Icon size={7} className={color} />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pb-0.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[8px] uppercase tracking-[0.15em] ${color} font-bold`}>{entry.domain}</span>
                            {entry.anchor && <span className="text-[7px] text-[var(--text-muted)] border border-white/10 px-1">ANCHOR</span>}
                          </div>
                          <div className={`text-[10px] ${entry.anchor ? 'text-[var(--text-muted)]' : 'text-[var(--text-primary)]'} leading-snug`}>
                            {entry.url ? (
                              <a href={entry.url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 flex items-center gap-1">
                                <span className="truncate">{entry.label}</span>
                                <ExternalLink size={8} className="flex-shrink-0 opacity-60" />
                              </a>
                            ) : entry.label}
                          </div>
                          {entry.detail && (
                            <div className="text-[8.5px] text-[var(--text-muted)] leading-tight mt-0.5">{entry.detail}</div>
                          )}
                        </div>
                        {entry.ts && (
                          <div className="flex-shrink-0 text-right">
                            <div className="text-[8px] text-[var(--text-muted)] tabular-nums">{fmtTs(entry.ts)}</div>
                            <div className="text-[7px] text-[var(--text-muted)]/50">{relTime(entry.ts)}</div>
                          </div>
                        )}
                        {!entry.ts && !entry.anchor && (
                          <span className="text-[7px] text-cyan-600 border border-cyan-800/40 px-1 flex-shrink-0 self-start">LIVE</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
