'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, GitBranch, TrendingUp } from 'lucide-react';
import { API_BASE } from '@/lib/api';
import OllamaButton from '@/components/OllamaButton';

interface Correlation {
  lat: number | null;
  lng: number | null;
  type: string;
  severity: 'low' | 'medium' | 'high';
  score: number;
  drivers: string[];
  cell_size: number | null;
}

interface Prediction {
  type: string;
  label: string;
  probability: number;
  lat: number | null;
  lng: number | null;
  horizon: string;
  drivers: string[];
  severity: 'low' | 'medium' | 'high';
}

const CORR_LABEL: Record<string, string> = {
  rf_anomaly: 'RF ANOMALY',
  military_buildup: 'MIL BUILDUP',
  infra_cascade: 'INFRA CASCADE',
  maritime_threat: 'MARITIME THREAT',
  cyber_threat: 'CYBER THREAT',
  escalation_alert: 'ESCALATION ALERT',
  signal_amplifier: 'SIGNAL AMPLIFIER',
  watchlist_alert: 'WATCHLIST ALERT',
  breaking_signal: 'BREAKING SIGNAL',
  domestic_cyber_threat: 'DOMESTIC CYBER',
};

const SEV_COLOR: Record<string, string> = {
  high: 'text-red-400',
  medium: 'text-yellow-400',
  low: 'text-slate-400',
};

const SEV_DOT: Record<string, string> = {
  high: 'bg-red-400',
  medium: 'bg-yellow-400',
  low: 'bg-slate-400',
};

function pct(p: number) {
  return `${Math.round(p * 100)}%`;
}

interface CorrelationPanelProps {
  onFlyTo?: (lat: number, lng: number) => void;
}

export default function CorrelationPanel({ onFlyTo }: CorrelationPanelProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'correlations' | 'predictions'>('correlations');
  const [correlations, setCorrelations] = useState<Correlation[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [corrRes, predRes] = await Promise.all([
        fetch(`${API_BASE}/api/correlations`),
        fetch(`${API_BASE}/api/predictions`),
      ]);
      if (corrRes.ok) {
        const data = await corrRes.json();
        setCorrelations(data.correlations || []);
      }
      if (predRes.ok) {
        const data = await predRes.json();
        setPredictions(data.predictions || []);
      }
      setLastUpdated(new Date());
    } catch {
      // silent — backend may be warming up
    }
  }, []);

  useEffect(() => {
    void fetchData();
    const interval = setInterval(fetchData, 60_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleClick = (lat: number | null, lng: number | null) => {
    if (lat != null && lng != null && onFlyTo) {
      onFlyTo(lat, lng);
    }
  };

  const tabBtn = (tab: 'correlations' | 'predictions') =>
    `flex-1 py-0.5 text-[9px] font-mono tracking-widest transition-colors ${
      activeTab === tab
        ? 'bg-cyan-500/10 text-cyan-400 border-b border-cyan-500/50'
        : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
    }`;

  return (
    <div className="bg-[var(--bg-panel)] border border-[var(--border-primary)]">
      {/* Header */}
      <button
        onClick={() => setIsOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-[var(--hover-accent)] transition-colors"
      >
        <div className="flex items-center gap-2">
          <GitBranch size={10} className="text-cyan-500 flex-shrink-0" />
          <span className="text-[10px] font-mono tracking-[0.2em] text-[var(--text-secondary)] uppercase">
            Correlation
          </span>
          <span className="text-[9px] font-mono text-[var(--text-muted)] ml-1">
            {correlations.length}C / {predictions.length}P
          </span>
        </div>
        {isOpen ? <ChevronUp size={10} className="text-[var(--text-muted)]" /> : <ChevronDown size={10} className="text-[var(--text-muted)]" />}
      </button>

      {isOpen && (
        <div>
          {/* Sub-tabs */}
          <div className="flex border-b border-[var(--border-primary)]">
            <button className={tabBtn('correlations')} onClick={() => setActiveTab('correlations')}>
              CORRELATIONS
            </button>
            <button className={tabBtn('predictions')} onClick={() => setActiveTab('predictions')}>
              PREDICTIONS
            </button>
          </div>

          {/* Last updated */}
          {lastUpdated && (
            <div className="px-3 py-1 text-[8px] font-mono text-[var(--text-muted)] border-b border-[var(--border-primary)]">
              UPDATED {lastUpdated.toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Singapore' })} SGT
            </div>
          )}

          {/* Correlations tab */}
          <div className={activeTab === 'correlations' ? '' : 'hidden'}>
            {correlations.length === 0 ? (
              <div className="px-3 py-4 text-center text-[9px] font-mono text-[var(--text-muted)]">
                NO ACTIVE CORRELATIONS
              </div>
            ) : (
              <div className="max-h-52 overflow-y-auto styled-scrollbar">
                {correlations.slice(0, 20).map((c, i) => (
                  <div
                    key={i}
                    className="w-full text-left px-3 py-2 border-b border-[var(--border-primary)] hover:bg-[var(--hover-accent)] transition-colors"
                  >
                    <button
                      onClick={() => handleClick(c.lat, c.lng)}
                      className="w-full text-left"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${SEV_DOT[c.severity]}`} />
                          <span className={`text-[9px] font-mono font-bold tracking-wide truncate ${SEV_COLOR[c.severity]}`}>
                            {CORR_LABEL[c.type] || c.type.toUpperCase()}
                          </span>
                        </div>
                        <span className="text-[8px] font-mono text-[var(--text-muted)] flex-shrink-0">
                          {c.lat != null ? `${c.lat.toFixed(1)},${c.lng?.toFixed(1)}` : 'GLOBAL'}
                        </span>
                      </div>
                      {c.drivers.length > 0 && (
                        <div className="mt-0.5 text-[8px] font-mono text-[var(--text-muted)] truncate">
                          {c.drivers[0]}
                        </div>
                      )}
                    </button>
                    <div className="mt-1">
                      <OllamaButton
                        label="EXPLAIN"
                        compact
                        prompt={`Explain in plain English why this correlation matters for situational awareness: Type="${CORR_LABEL[c.type] || c.type}", Severity="${c.severity}", Drivers=[${c.drivers.join('; ')}]${c.lat != null ? `, Location=(${c.lat.toFixed(2)}, ${c.lng?.toFixed(2)})` : ', Location=GLOBAL'}. Why does this combination of signals indicate a real-world threat? Keep it to 2-3 sentences.`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Predictions tab */}
          <div className={activeTab === 'predictions' ? '' : 'hidden'}>
            {predictions.length === 0 ? (
              <div className="px-3 py-4 text-center text-[9px] font-mono text-[var(--text-muted)]">
                NO ACTIVE PREDICTIONS
              </div>
            ) : (
              <div className="max-h-52 overflow-y-auto styled-scrollbar">
                {predictions.slice(0, 20).map((p, i) => (
                  <button
                    key={i}
                    onClick={() => handleClick(p.lat, p.lng)}
                    className="w-full text-left px-3 py-2 border-b border-[var(--border-primary)] hover:bg-[var(--hover-accent)] transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <TrendingUp size={8} className={`flex-shrink-0 ${SEV_COLOR[p.severity]}`} />
                        <span className="text-[9px] font-mono font-bold tracking-wide text-[var(--text-secondary)] truncate">
                          {p.label}
                        </span>
                      </div>
                      <span className={`text-[9px] font-mono font-bold flex-shrink-0 ${SEV_COLOR[p.severity]}`}>
                        {pct(p.probability)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5 gap-2">
                      <span className="text-[8px] font-mono text-[var(--text-muted)] truncate">
                        {p.drivers[0] || ''}
                      </span>
                      <span className="text-[8px] font-mono text-cyan-700 flex-shrink-0">
                        {p.horizon}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
