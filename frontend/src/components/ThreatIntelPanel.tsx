'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Shield } from 'lucide-react';
import IOCLookupPanel from './IOCLookupPanel';
import CveLookupPanel from './CveLookupPanel';

/**
 * ThreatIntelPanel — merges IOC Lookup and CVE Search into a single
 * collapsible "THREAT INTEL" section with IOC / CVE sub-tabs.
 *
 * Inner panels are rendered as-is — no logic changes. CSS display:none is
 * used (not unmounting) so each panel preserves its own local state when
 * switching tabs.
 */
export default function ThreatIntelPanel() {
  const [isOpen, setIsOpen]       = useState(false);
  const [activeTab, setActiveTab] = useState<'ioc' | 'cve'>('ioc');

  return (
    <div className="bg-[var(--bg-panel)] border border-[var(--border-primary)] overflow-hidden">
      {/* ── Outer section header ── */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-[var(--hover-accent)] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Shield size={11} className="text-cyan-400" />
          <span className="text-[9px] font-mono font-bold tracking-[0.18em] text-[var(--text-primary)] uppercase">
            Threat Intel
          </span>
        </div>
        {isOpen
          ? <ChevronUp   size={11} className="text-[var(--text-muted)]" />
          : <ChevronDown size={11} className="text-[var(--text-muted)]" />}
      </button>

      {/* ── Sub-tabs + content ── */}
      {isOpen && (
        <div>
          {/* Tab switcher */}
          <div className="flex border-b border-[var(--border-primary)]">
            {(['ioc', 'cve'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={[
                  'flex-1 py-1.5 text-[9px] font-mono tracking-[0.15em] uppercase transition-colors',
                  activeTab === tab
                    ? 'text-cyan-400 border-b-2 border-cyan-500 bg-cyan-500/5'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] border-b-2 border-transparent',
                ].join(' ')}
              >
                {tab === 'ioc' ? 'IOC' : 'CVE'}
              </button>
            ))}
          </div>

          {/* Panel content — hidden not unmounted, preserves inner state */}
          <div className={activeTab === 'ioc' ? '' : 'hidden'}>
            <IOCLookupPanel />
          </div>
          <div className={activeTab === 'cve' ? '' : 'hidden'}>
            <CveLookupPanel />
          </div>
        </div>
      )}
    </div>
  );
}
