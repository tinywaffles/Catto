'use client';

import { useState, useRef } from 'react';
import { ChevronDown, ChevronUp, Search, Shield, AlertTriangle, CheckCircle, HelpCircle, X, Loader } from 'lucide-react';

type Verdict = 'MALICIOUS' | 'SUSPICIOUS' | 'CLEAN' | 'UNKNOWN';

interface IOCResult {
  indicator: string;
  type: string;
  verdict: Verdict;
  sources: {
    virustotal: { malicious: number; suspicious: number; total: number } | null;
    otx: { pulseCount: number } | null;
    feodo: { listed: boolean } | null;
    abuseipdb: { score: number; reports: number; country: string | null; isp: string | null } | null;
    intelx: { count: number; found: boolean } | null;
    hibp: { breachCount: number; breaches: { name: string; date: string }[] } | null;
  };
}

const VERDICT_CONFIG: Record<Verdict, { color: string; bg: string; border: string; Icon: typeof Shield }> = {
  MALICIOUS:  { color: 'text-red-400',    bg: 'bg-red-950/40',    border: 'border-red-500/40',    Icon: AlertTriangle },
  SUSPICIOUS: { color: 'text-orange-400', bg: 'bg-orange-950/40', border: 'border-orange-500/40', Icon: AlertTriangle },
  CLEAN:      { color: 'text-green-400',  bg: 'bg-green-950/40',  border: 'border-green-500/40',  Icon: CheckCircle },
  UNKNOWN:    { color: 'text-gray-400',   bg: 'bg-gray-900/40',   border: 'border-gray-600/40',   Icon: HelpCircle },
};

export default function IOCLookupPanel() {
  const [isMinimized, setIsMinimized] = useState(true);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IOCResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const lookup = async () => {
    const q = query.trim();
    if (!q) return;
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/ioc/lookup?q=${encodeURIComponent(q)}`, {
        signal: abortRef.current.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Lookup failed');
      setResult(data as IOCResult);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const clear = () => {
    setQuery('');
    setResult(null);
    setError(null);
    if (abortRef.current) abortRef.current.abort();
  };

  return (
    <div className="bg-[var(--bg-panel)] border border-[var(--border-primary)] backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsMinimized((m) => !m)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-cyan-950/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Shield size={10} className="text-cyan-500" />
          <span className="text-[10px] font-mono font-bold tracking-[0.2em] text-cyan-400 uppercase">
            IOC Lookup
          </span>
        </div>
        {isMinimized ? <ChevronDown size={10} className="text-cyan-700" /> : <ChevronUp size={10} className="text-cyan-700" />}
      </button>

      {!isMinimized && (
        <div className="px-3 pb-3 space-y-2">
          {/* Input row */}
          <div className="flex gap-1.5 mt-1">
            <div className="flex-1 relative">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && lookup()}
                placeholder="IP, domain, hash or URL..."
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] px-2 py-1.5 text-[10px] font-mono text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-cyan-700/60 pr-6"
              />
              {query && (
                <button
                  onClick={clear}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  <X size={9} />
                </button>
              )}
            </div>
            <button
              onClick={lookup}
              disabled={!query.trim() || loading}
              className="px-2.5 py-1.5 bg-cyan-900/40 border border-cyan-700/40 text-cyan-400 hover:bg-cyan-800/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? <Loader size={10} className="animate-spin" /> : <Search size={10} />}
            </button>
          </div>

          {/* Error */}
          {error && (
            <p className="text-[9px] font-mono text-red-400">{error}</p>
          )}

          {/* Loading hint */}
          {loading && (
            <p className="text-[9px] font-mono text-[var(--text-muted)]">Querying VT · OTX · Feodo · AbuseIPDB · IntelX · HIBP...</p>
          )}

          {/* Results */}
          {result && (() => {
            const cfg = VERDICT_CONFIG[result.verdict];
            const VIcon = cfg.Icon;
            return (
              <div className="space-y-2 pt-0.5">
                {/* Verdict */}
                <div className={`flex items-center gap-2 px-2.5 py-2 border ${cfg.bg} ${cfg.border}`}>
                  <VIcon size={11} className={cfg.color} />
                  <div>
                    <div className={`text-[11px] font-mono font-bold ${cfg.color}`}>{result.verdict}</div>
                    <div className="text-[8px] font-mono text-[var(--text-muted)]">
                      {result.type.toUpperCase()} — {result.indicator.length > 36 ? result.indicator.slice(0, 36) + '…' : result.indicator}
                    </div>
                  </div>
                </div>

                {/* Source breakdown */}
                <div className="space-y-1">
                  <div className="text-[7px] font-mono text-[var(--text-muted)] tracking-[0.2em] uppercase">Source Breakdown</div>

                  {/* VirusTotal */}
                  <div className="flex items-center justify-between text-[9px] font-mono px-1">
                    <span className="text-[var(--text-muted)]">VirusTotal</span>
                    {result.sources.virustotal ? (
                      <span className={result.sources.virustotal.malicious > 0 ? 'text-red-400' : 'text-green-400'}>
                        {result.sources.virustotal.malicious}/{result.sources.virustotal.total} engines
                      </span>
                    ) : <span className="text-gray-600">no key</span>}
                  </div>

                  {/* OTX */}
                  <div className="flex items-center justify-between text-[9px] font-mono px-1">
                    <span className="text-[var(--text-muted)]">OTX AlienVault</span>
                    {result.sources.otx ? (
                      <span className={result.sources.otx.pulseCount > 0 ? 'text-orange-400' : 'text-green-400'}>
                        {result.sources.otx.pulseCount} pulse{result.sources.otx.pulseCount !== 1 ? 's' : ''}
                      </span>
                    ) : <span className="text-gray-600">no key</span>}
                  </div>

                  {/* Feodo */}
                  {result.sources.feodo !== null && (
                    <div className="flex items-center justify-between text-[9px] font-mono px-1">
                      <span className="text-[var(--text-muted)]">Feodo C2 List</span>
                      <span className={result.sources.feodo.listed ? 'text-red-400' : 'text-green-400'}>
                        {result.sources.feodo.listed ? 'LISTED' : 'clean'}
                      </span>
                    </div>
                  )}

                  {/* AbuseIPDB */}
                  {result.sources.abuseipdb && (
                    <div className="flex items-center justify-between text-[9px] font-mono px-1">
                      <span className="text-[var(--text-muted)]">AbuseIPDB</span>
                      <span className={result.sources.abuseipdb.score > 25 ? 'text-orange-400' : 'text-green-400'}>
                        {result.sources.abuseipdb.score}% · {result.sources.abuseipdb.reports} reports
                        {result.sources.abuseipdb.country ? ` · ${result.sources.abuseipdb.country}` : ''}
                      </span>
                    </div>
                  )}

                  {/* IntelX */}
                  <div className="flex items-center justify-between text-[9px] font-mono px-1">
                    <span className="text-[var(--text-muted)]">IntelX</span>
                    {result.sources.intelx !== undefined ? (
                      result.sources.intelx ? (
                        <span className={result.sources.intelx.found ? 'text-orange-400' : 'text-green-400'}>
                          {result.sources.intelx.count} result{result.sources.intelx.count !== 1 ? 's' : ''}
                        </span>
                      ) : <span className="text-gray-600">no key</span>
                    ) : <span className="text-gray-600">n/a</span>}
                  </div>

                  {/* HIBP */}
                  {result.sources.hibp !== undefined && result.sources.hibp !== null && (
                    <div className="flex items-center justify-between text-[9px] font-mono px-1">
                      <span className="text-[var(--text-muted)]">HIBP Breaches</span>
                      <span className={result.sources.hibp.breachCount > 0 ? 'text-yellow-400' : 'text-green-400'}>
                        {result.sources.hibp.breachCount > 0
                          ? `${result.sources.hibp.breachCount} breach${result.sources.hibp.breachCount !== 1 ? 'es' : ''} · ${result.sources.hibp.breaches.map((b) => b.name).join(', ')}`
                          : 'no breaches'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
