'use client';

import { useState, useEffect, useRef } from 'react';
import { X, RefreshCw, Clock } from 'lucide-react';
import { useDataKeys } from '@/hooks/useDataStore';
import type { NewsArticle, GdeltConflictEvent, OtxPulse, CisaKevEntry } from '@/types/dashboard';

const MODEL = 'llama3.1:8b';
const LAST_SESSION_KEY = 'catto:last-session';
const MIN_AWAY_MS = 30 * 60 * 1000; // 30 minutes

const KEYS = ['news', 'gdelt_conflict', 'otx_pulses', 'cisa_kev'] as const;

function formatDuration(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function SessionDeltaBriefing() {
  const [visible, setVisible] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [awayDuration, setAwayDuration] = useState(0);
  const generated = useRef(false);
  const lastSessionMs = useRef(0);

  const { news, gdelt_conflict, otx_pulses, cisa_kev } = useDataKeys(KEYS);

  // Check session gap on mount
  useEffect(() => {
    const now = Date.now();
    const raw = localStorage.getItem(LAST_SESSION_KEY);
    const last = raw ? parseInt(raw, 10) : 0;
    const away = now - last;

    // Always update session timestamp
    localStorage.setItem(LAST_SESSION_KEY, String(now));

    if (last > 0 && away >= MIN_AWAY_MS) {
      lastSessionMs.current = last;
      setAwayDuration(away);
      setVisible(true);
    }
  }, []);

  // Generate once data arrives
  useEffect(() => {
    if (!visible || generated.current) return;
    const newsArr = (news as NewsArticle[] | undefined) ?? [];
    if (newsArr.length === 0) return;

    generated.current = true;
    generate();
  }, [visible, news]); // eslint-disable-line react-hooks/exhaustive-deps

  async function generate() {
    setLoading(true);
    setError(null);

    const since = lastSessionMs.current;
    const away = awayDuration;
    const sinceDate = new Date(since).toUTCString();
    const nowDate = new Date().toUTCString();

    // ── Regional news — filter to gap window ────────────────────────────────
    let regionalLines = '- Unable to fetch';
    try {
      const rRes = await fetch('/api/regional-news');
      if (rRes.ok) {
        const rData = await rRes.json() as { source?: string; title?: string; published?: string }[];
        const gapItems = rData.filter(
          (a) => !a.published || new Date(a.published).getTime() > since,
        );
        regionalLines = (gapItems.length > 0 ? gapItems : rData)
          .slice(0, 15)
          .map((a) => `- [${a.source ?? '?'}] ${a.title}${a.published ? ` (${new Date(a.published).toUTCString()})` : ''}`)
          .join('\n') || '- No regional news';
      }
    } catch { /* silent */ }

    // Events that occurred during the gap
    const newsArr = (news as NewsArticle[] | undefined) ?? [];
    const newNews = newsArr
      .filter((n) => n.pub_date && new Date(n.pub_date).getTime() > since)
      .sort((a, b) => (b.risk_score ?? 0) - (a.risk_score ?? 0))
      .slice(0, 10)
      .map((n) => `- ${n.title}`)
      .join('\n') || '- No new articles';

    const gdelt = (gdelt_conflict as GdeltConflictEvent[] | undefined) ?? [];
    const newConflict = gdelt
      .filter((e) => e.date && new Date(e.date).getTime() > since)
      .sort((a, b) => (a.tone ?? 0) - (b.tone ?? 0))
      .slice(0, 6)
      .map((e) => `- ${e.title}`)
      .join('\n') || '- No new conflict events';

    const otx = (otx_pulses as OtxPulse[] | undefined) ?? [];
    const newOtx = otx
      .filter((p) => new Date(p.modified || p.created).getTime() > since)
      .slice(0, 3)
      .map((p) => `- ${p.name}${p.malware_families?.length ? ` [${p.malware_families[0].display_name}]` : ''}`)
      .join('\n');

    const kev = (cisa_kev as CisaKevEntry[] | undefined) ?? [];
    const newKev = kev
      .filter((k) => new Date(k.dateAdded).getTime() > since)
      .slice(0, 3)
      .map((k) => `- ${k.cveID} ${k.vulnerabilityName} (${k.vendorProject})`)
      .join('\n');

    const cyberLines = [newOtx, newKev].filter(Boolean).join('\n') || '- None';

    const prompt = `You are a watch officer handing over a shift. The analyst was away for ${formatDuration(away)} (from ${sinceDate} to ${nowDate}). STRICT RULES: (1) Use ONLY the data provided below — never use training knowledge or fabricate events. (2) Prefix ongoing active conflicts with [ONGOING]. (3) Prefix new or breaking events with [ACTIVE]. (4) If multiple signals point to the same region, flag it as [DEVELOPING]. (5) Report only what changed or escalated during the gap. 3-4 sentences. No preamble, no headers.

NEW CONFLICT EVENTS WHILE AWAY (worst tone first):
${newConflict}

BREAKING NEWS WHILE AWAY (by risk score):
${newNews}

REGIONAL INTEL FEED — TOP 15 HEADLINES DURING GAP (source + timestamp):
${regionalLines}

NEW CYBER THREATS DURING GAP:
${cyberLines}

Deliver the catch-up briefing using only the data above. Flag [ONGOING], [ACTIVE], [DEVELOPING] explicitly.`;

    try {
      const res = await fetch('/api/ollama/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, model: MODEL }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { response?: string; error?: string };
      if (data.error) throw new Error(data.error);
      setText((data.response ?? '').trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }

  if (!visible) return null;

  return (
    <div className="bg-[#0d0a04]/95 border border-amber-600/50 font-mono flex-shrink-0">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-amber-600/30">
        <Clock size={9} className="text-amber-400 flex-shrink-0" />
        <span className="text-[8.5px] font-bold tracking-[0.18em] text-amber-300 flex-1 uppercase">
          Away {formatDuration(awayDuration)} — Catch-up
        </span>
        {loading && <RefreshCw size={8} className="text-amber-400 animate-spin" />}
        <button
          onClick={() => setVisible(false)}
          className="text-amber-400/50 hover:text-amber-300 flex-shrink-0"
        >
          <X size={9} />
        </button>
      </div>

      <div className="px-3 py-2.5">
        <div className="max-h-[200px] overflow-y-auto styled-scrollbar pr-1">
          {loading && !text && (
            <div className="flex items-center gap-2">
              <RefreshCw size={8} className="text-amber-400 animate-spin flex-shrink-0" />
              <span className="text-[8px] text-gray-400">Generating catch-up briefing…</span>
            </div>
          )}
          {error && (
            <p className="text-[8px] text-red-400">{error}</p>
          )}
          {text && (
            <p className="text-[8.5px] text-gray-200 leading-relaxed">{text}</p>
          )}
        </div>
      </div>
    </div>
  );
}
