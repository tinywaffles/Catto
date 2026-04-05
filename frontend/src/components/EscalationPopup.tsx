'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { AlertTriangle, X, MapPin, BellOff } from 'lucide-react';
import { API_BASE } from '@/lib/api';

export interface EscalationEvent {
  id: string;
  type: string;
  label: string;
  lat: number | null;
  lng: number | null;
  drivers: string[];
  severity: 'high';
  confidence: number;
  timestamp: number;
}

interface Props {
  event: EscalationEvent;
  onEscalate: (lat: number, lng: number) => void;
  onDismiss: (id: string) => void;
  onDnd: () => void;
}

const TYPE_COLOR: Record<string, string> = {
  multi_source_conflict: 'text-red-400 border-red-500/50',
  conflict_escalation: 'text-orange-400 border-orange-500/50',
  coordinated_military: 'text-yellow-400 border-yellow-500/50',
  watchlist_breach: 'text-rose-400 border-rose-500/50',
  maritime_threat_elevated: 'text-cyan-400 border-cyan-500/50',
  escalation_alert: 'text-orange-400 border-orange-500/50',
  signal_amplifier: 'text-purple-400 border-purple-500/50',
  breaking_signal: 'text-amber-400 border-amber-500/50',
};

const TYPE_LABEL: Record<string, string> = {
  multi_source_conflict: 'MULTI-SOURCE CONFLICT SIGNAL',
  conflict_escalation: 'CONFLICT ESCALATION DETECTED',
  coordinated_military: 'COORDINATED MILITARY ACTIVITY',
  watchlist_breach: 'WATCHLIST BREACH',
  maritime_threat_elevated: 'ELEVATED MARITIME THREAT',
  escalation_alert: 'ESCALATION ALERT',
  signal_amplifier: 'SIGNAL AMPLIFIER',
  breaking_signal: 'BREAKING SIGNAL',
};

export default function EscalationPopup({ event, onEscalate, onDismiss, onDnd }: Props) {
  const [countdown, setCountdown] = useState(10);
  const [canDismiss, setCanDismiss] = useState(false);
  const [aiAssessment, setAiAssessment] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const aiStartedRef = useRef(false);

  // Countdown — dismissable after 10 seconds
  useEffect(() => {
    if (countdown <= 0) { setCanDismiss(true); return; }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // Trigger Ollama AI assessment after 15 seconds
  useEffect(() => {
    const t = setTimeout(() => {
      if (aiStartedRef.current) return;
      aiStartedRef.current = true;
      setAiLoading(true);

      const prompt = `You are a geopolitical analyst. A high-confidence alert just fired: "${TYPE_LABEL[event.type] || event.type}". Triggers: ${event.drivers.join('; ')}${event.lat != null ? `. Location: ${event.lat.toFixed(2)}, ${event.lng?.toFixed(2)}` : ' (global)'}. Provide a one-paragraph assessment of what this means operationally and what to watch for. Be direct and intelligence-style terse.`;

      fetch(`${API_BASE}/api/ollama/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
        .then(async (res) => {
          if (!res.ok) throw new Error('offline');
          const reader = res.body?.getReader();
          if (!reader) throw new Error('no stream');
          let text = '';
          const decoder = new TextDecoder();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            for (const line of decoder.decode(value, { stream: true }).split('\n').filter(Boolean)) {
              try {
                const d = JSON.parse(line);
                if (d.response) { text += d.response; setAiAssessment(text); }
                if (d.error) throw new Error('ai_error');
              } catch { /* skip parse errors */ }
            }
          }
        })
        .catch(() => {
          // Fallback: rule-based summary
          setAiAssessment(
            `${TYPE_LABEL[event.type] || event.type} detected. Key indicators: ${event.drivers.slice(0, 2).join(', ')}. Confidence: ${Math.round(event.confidence * 100)}%. Monitor situation for further escalation.`
          );
        })
        .finally(() => setAiLoading(false));
    }, 15_000);

    return () => clearTimeout(t);
  }, [event]);

  const colorClass = TYPE_COLOR[event.type] || 'text-red-400 border-red-500/50';
  const label = TYPE_LABEL[event.type] || event.type.toUpperCase().replace(/_/g, ' ');

  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center pointer-events-none">
      <div
        className={`pointer-events-auto w-[480px] max-w-[90vw] bg-[#060a12]/98 border-2 ${colorClass.split(' ')[1] || 'border-red-500/50'} backdrop-blur-md shadow-[0_0_60px_rgba(255,50,50,0.15)] font-mono`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-3 border-b border-current/20 ${colorClass.split(' ')[1] || 'border-red-500/20'}`}>
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className={`${colorClass.split(' ')[0]} animate-pulse flex-shrink-0`} />
            <span className={`text-[11px] font-bold tracking-[0.2em] ${colorClass.split(' ')[0]}`}>
              {label}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-[var(--text-muted)] font-mono">
              CONF: {Math.round(event.confidence * 100)}%
            </span>
            {canDismiss ? (
              <button
                onClick={() => onDismiss(event.id)}
                className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
              >
                <X size={12} />
              </button>
            ) : (
              <span className={`text-[9px] font-mono font-bold ${colorClass.split(' ')[0]}`}>
                {countdown}s
              </span>
            )}
          </div>
        </div>

        {/* Drivers */}
        <div className="px-4 py-3 flex flex-col gap-1.5">
          {event.drivers.map((d, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className={`text-[9px] font-bold ${colorClass.split(' ')[0]} flex-shrink-0`}>▸</span>
              <span className="text-[9px] text-[var(--text-secondary)]">{d}</span>
            </div>
          ))}

          {event.lat != null && (
            <div className="flex items-center gap-1.5 mt-1 text-[8px] text-[var(--text-muted)]">
              <MapPin size={8} className="flex-shrink-0" />
              {event.lat.toFixed(3)}°, {event.lng?.toFixed(3)}°
            </div>
          )}
        </div>

        {/* AI Assessment */}
        {(aiLoading || aiAssessment) && (
          <div className="mx-4 mb-3 p-2.5 bg-cyan-950/20 border border-cyan-900/30">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[8px] font-bold text-cyan-400 tracking-widest">CATTO ASSESSMENT</span>
              {aiLoading && (
                <div className="w-2 h-2 border border-cyan-500 border-t-transparent rounded-full animate-spin" />
              )}
            </div>
            <p className="text-[9px] text-[var(--text-secondary)] leading-relaxed">
              {aiAssessment || 'Analysing…'}
              {aiLoading && <span className="animate-pulse text-cyan-500">▊</span>}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-0 border-t border-[var(--border-primary)]">
          {event.lat != null && (
            <button
              onClick={() => onEscalate(event.lat!, event.lng!)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[9px] font-bold tracking-[0.15em] border-r border-[var(--border-primary)] transition-colors ${colorClass.split(' ')[0]} hover:bg-white/5`}
            >
              <MapPin size={10} />
              ESCALATE — SHOW ME
            </button>
          )}
          <button
            disabled={!canDismiss}
            onClick={() => onDismiss(event.id)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-[9px] font-bold tracking-[0.15em] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <X size={10} />
            DISMISS {!canDismiss && `(${countdown}s)`}
          </button>
          <button
            onClick={onDnd}
            title="Do Not Disturb — suppress all popups for 1 hour"
            className="px-3 flex items-center justify-center border-l border-[var(--border-primary)] text-[var(--text-muted)] hover:text-amber-400 hover:bg-amber-950/10 transition-colors"
          >
            <BellOff size={10} />
          </button>
        </div>
      </div>
    </div>
  );
}


// ---------------------------------------------------------------------------
// Hook: useEscalationMonitor — detects HIGH-confidence correlations and queues
// ---------------------------------------------------------------------------

const SUPPRESSION_MS = 30 * 60 * 1000; // 30 minutes
const DND_MS = 60 * 60 * 1000; // 1 hour

function suppressionKey(type: string, lat: number | null, lng: number | null): string {
  const cell = lat != null ? `${Math.floor(lat / 2)},${Math.floor((lng ?? 0) / 2)}` : 'global';
  return `esc_suppress:${type}:${cell}`;
}

function isSupressed(type: string, lat: number | null, lng: number | null): boolean {
  if (typeof window === 'undefined') return false;
  const key = suppressionKey(type, lat, lng);
  const dnd = localStorage.getItem('esc_dnd');
  if (dnd && Date.now() < Number(dnd)) return true;
  const ts = localStorage.getItem(key);
  return ts ? Date.now() < Number(ts) + SUPPRESSION_MS : false;
}

function markSuppressed(type: string, lat: number | null, lng: number | null) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(suppressionKey(type, lat, lng), String(Date.now()));
}

function setDnd() {
  if (typeof window === 'undefined') return;
  localStorage.setItem('esc_dnd', String(Date.now() + DND_MS));
}

// HIGH-confidence escalation trigger types from correlation engine
const ESCALATION_TYPES = new Set([
  'military_buildup',
  'escalation_alert',
  'watchlist_alert',
  'breaking_signal',
  'signal_amplifier',
  'maritime_threat',
  'domestic_cyber_threat',
]);

export function useEscalationMonitor(
  correlations: Array<{ type: string; severity: string; lat: number | null; lng: number | null; drivers: string[]; score: number }>,
  onEvent: (e: EscalationEvent) => void,
) {
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    for (const c of correlations) {
      if (c.severity !== 'high') continue;
      if (!ESCALATION_TYPES.has(c.type)) continue;
      if (isSupressed(c.type, c.lat, c.lng)) continue;

      const id = `${c.type}:${c.lat?.toFixed(1)}:${c.lng?.toFixed(1)}`;
      if (seenRef.current.has(id)) continue;
      seenRef.current.add(id);

      onEvent({
        id,
        type: c.type,
        label: c.type,
        lat: c.lat,
        lng: c.lng,
        drivers: c.drivers,
        severity: 'high',
        confidence: c.score / 100,
        timestamp: Date.now(),
      });
    }
  }, [correlations, onEvent]);
}

export { markSuppressed, setDnd };
