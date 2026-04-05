'use client';

import { useState, useRef } from 'react';
import { ChevronDown, ChevronUp, Search, Loader, ExternalLink } from 'lucide-react';

interface CveResult {
  cveId: string;
  description: string;
  cvssScore: number | null;
  severity: string | null;
  vectorString: string | null;
  products: string[];
  references: { url: string; tags: string[] }[];
  cisaKev: {
    listed: boolean;
    dateAdded?: string;
    dueDate?: string;
    requiredAction?: string;
    vendorProject?: string;
    product?: string;
  };
  published: string | null;
  lastModified: string | null;
}

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: 'text-red-400',
  HIGH:     'text-orange-400',
  MEDIUM:   'text-yellow-400',
  LOW:      'text-green-400',
  NONE:     'text-gray-500',
};

export default function CveLookupPanel() {
  const [isMinimized, setIsMinimized] = useState(true);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CveResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const lookup = async () => {
    const q = query.trim().toUpperCase();
    if (!q) return;
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/cve/lookup?cve=${encodeURIComponent(q)}`, {
        signal: abortRef.current.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Lookup failed');
      setResult(data as CveResult);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[var(--bg-panel)] border border-[var(--border-primary)] backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsMinimized((m) => !m)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-cyan-950/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Search size={10} className="text-cyan-500" />
          <span className="text-[10px] font-mono font-bold tracking-[0.2em] text-cyan-400 uppercase">
            CVE Search
          </span>
        </div>
        {isMinimized ? <ChevronDown size={10} className="text-cyan-700" /> : <ChevronUp size={10} className="text-cyan-700" />}
      </button>

      {!isMinimized && (
        <div className="px-3 pb-3 space-y-2">
          {/* Input */}
          <div className="flex gap-1.5 mt-1">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && lookup()}
              placeholder="CVE-2024-12345"
              className="flex-1 bg-[var(--bg-primary)] border border-[var(--border-primary)] px-2 py-1.5 text-[10px] font-mono text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-cyan-700/60 uppercase"
            />
            <button
              onClick={lookup}
              disabled={!query.trim() || loading}
              className="px-2.5 py-1.5 bg-cyan-900/40 border border-cyan-700/40 text-cyan-400 hover:bg-cyan-800/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? <Loader size={10} className="animate-spin" /> : <Search size={10} />}
            </button>
          </div>

          {error && <p className="text-[9px] font-mono text-red-400">{error}</p>}
          {loading && <p className="text-[9px] font-mono text-[var(--text-muted)]">Querying NVD · CISA KEV...</p>}

          {result && (
            <div className="space-y-2 pt-0.5">
              {/* Header row */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold text-cyan-300">{result.cveId}</span>
                <div className="flex items-center gap-2">
                  {result.cvssScore !== null && (
                    <span className={`text-[10px] font-mono font-bold ${SEVERITY_COLOR[result.severity ?? 'NONE'] ?? 'text-gray-400'}`}>
                      CVSS {result.cvssScore.toFixed(1)}
                    </span>
                  )}
                  {result.severity && (
                    <span className={`text-[7px] font-mono px-1.5 py-0.5 border ${
                      result.severity === 'CRITICAL' ? 'bg-red-950/50 border-red-500/40 text-red-400' :
                      result.severity === 'HIGH'     ? 'bg-orange-950/50 border-orange-500/40 text-orange-400' :
                      result.severity === 'MEDIUM'   ? 'bg-yellow-950/50 border-yellow-500/40 text-yellow-400' :
                                                       'bg-gray-900/50 border-gray-600/40 text-gray-400'
                    }`}>
                      {result.severity}
                    </span>
                  )}
                </div>
              </div>

              {/* CISA KEV badge */}
              {result.cisaKev.listed && (
                <div className="flex items-center gap-2 px-2 py-1.5 bg-red-950/30 border border-red-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                  <div>
                    <div className="text-[8px] font-mono font-bold text-red-400 tracking-wider">CISA KEV — KNOWN EXPLOITED</div>
                    {result.cisaKev.dueDate && (
                      <div className="text-[7.5px] font-mono text-red-300/70">Patch due: {result.cisaKev.dueDate}</div>
                    )}
                    {result.cisaKev.requiredAction && (
                      <div className="text-[7.5px] font-mono text-red-300/60 mt-0.5 leading-relaxed">{result.cisaKev.requiredAction}</div>
                    )}
                  </div>
                </div>
              )}

              {/* Description */}
              <div>
                <div className="text-[7px] font-mono text-[var(--text-muted)] tracking-[0.2em] uppercase mb-1">Description</div>
                <p className="text-[9px] font-mono text-[var(--text-secondary)] leading-relaxed line-clamp-4">
                  {result.description}
                </p>
              </div>

              {/* Affected products */}
              {result.products.length > 0 && (
                <div>
                  <div className="text-[7px] font-mono text-[var(--text-muted)] tracking-[0.2em] uppercase mb-1">Affected Products</div>
                  <div className="flex flex-wrap gap-1">
                    {result.products.map((p, i) => (
                      <span key={i} className="text-[7.5px] font-mono px-1.5 py-0.5 bg-cyan-950/30 border border-cyan-900/30 text-cyan-300/70">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Vector string */}
              {result.vectorString && (
                <div className="text-[7.5px] font-mono text-[var(--text-muted)] break-all">{result.vectorString}</div>
              )}

              {/* References */}
              {result.references.length > 0 && (
                <div>
                  <div className="text-[7px] font-mono text-[var(--text-muted)] tracking-[0.2em] uppercase mb-1">References</div>
                  <div className="space-y-0.5">
                    {result.references.map((ref, i) => (
                      <a
                        key={i}
                        href={ref.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[8px] font-mono text-cyan-500 hover:text-cyan-300 truncate"
                      >
                        <ExternalLink size={7} className="flex-shrink-0" />
                        <span className="truncate">{ref.url}</span>
                        {ref.tags.includes('Patch') && (
                          <span className="ml-1 text-green-400/70 flex-shrink-0">[patch]</span>
                        )}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Dates */}
              <div className="flex gap-4 text-[7.5px] font-mono text-[var(--text-muted)]">
                {result.published && <span>Published: {result.published.slice(0, 10)}</span>}
                {result.lastModified && <span>Modified: {result.lastModified.slice(0, 10)}</span>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
