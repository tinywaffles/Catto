'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Shield, Train, Radio, Plane, Globe } from 'lucide-react';
import { useDataKeys } from '@/hooks/useDataStore';

interface TickerItem {
  id: string;
  label: string;
  text: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  icon: 'alert' | 'shield' | 'train' | 'cyber' | 'plane' | 'globe';
}

const SEV_COLORS: Record<string, string> = {
  CRITICAL: 'text-red-400',
  HIGH: 'text-orange-400',
  MEDIUM: 'text-yellow-400',
  LOW: 'text-cyan-400',
};

export default function AlertTicker() {
  const data = useDataKeys([
    'sgsecure_alerts',
    'scdf_incidents',
    'mrt_alerts',
    'singcert_advisories',
    'otx_pulses',
    'adsb_military_flights',
    'notam_entries',
    'feodo_c2',
  ] as const);

  const items = useMemo<TickerItem[]>(() => {
    const out: TickerItem[] = [];

    for (const a of (data.sgsecure_alerts ?? []).slice(0, 5)) {
      const al = a as unknown as Record<string, unknown>;
      out.push({
        id: `sg-${String(al.url ?? al.title ?? out.length)}`,
        label: 'SGSECURE',
        text: String(al.title ?? 'Security Alert'),
        severity: String(al.severity ?? 'LOW').toUpperCase() as TickerItem['severity'],
        icon: 'shield',
      });
    }

    for (const s of (data.scdf_incidents ?? []).slice(0, 5)) {
      const sc = s as unknown as Record<string, unknown>;
      out.push({
        id: `scdf-${String(sc.url ?? sc.title ?? out.length)}`,
        label: 'SCDF',
        text: String(sc.title ?? 'Incident'),
        severity: 'LOW',
        icon: 'alert',
      });
    }

    for (const m of (data.mrt_alerts ?? []).slice(0, 3)) {
      const ma = m as unknown as Record<string, unknown>;
      out.push({
        id: `mrt-${String(ma.created_date ?? out.length)}`,
        label: 'MRT DISRUPTION',
        text: String(ma.message ?? 'Train service disruption'),
        severity: 'HIGH',
        icon: 'train',
      });
    }

    for (const c of (data.singcert_advisories ?? []).slice(0, 5)) {
      const ca = c as unknown as Record<string, unknown>;
      out.push({
        id: `cert-${String(ca.advisory_id ?? ca.url ?? out.length)}`,
        label: 'SINGCERT',
        text: String(ca.title ?? 'Security Advisory'),
        severity: (String(ca.severity ?? 'LOW').toUpperCase()) as TickerItem['severity'],
        icon: 'cyber',
      });
    }

    for (const p of (data.otx_pulses ?? []).slice(0, 5)) {
      const pulse = p as unknown as Record<string, unknown>;
      out.push({
        id: `otx-${String(pulse.id ?? out.length)}`,
        label: 'OTX',
        text: String(pulse.name ?? 'Threat Intelligence'),
        severity: 'HIGH',
        icon: 'globe',
      });
    }

    for (const f of (data.adsb_military_flights ?? []).slice(0, 5)) {
      const fl = f as unknown as Record<string, unknown>;
      out.push({
        id: `mil-${String(fl.hex ?? out.length)}`,
        label: 'MIL AIR',
        text: `${String(fl.flight ?? fl.hex ?? 'Unknown')}${fl.t ? ` [${fl.t}]` : ''} — ${fl.alt_baro != null ? `${fl.alt_baro}ft` : 'unknown alt'}`,
        severity: 'MEDIUM',
        icon: 'plane',
      });
    }

    for (const n of (data.notam_entries ?? []).slice(0, 5)) {
      const nt = n as unknown as Record<string, unknown>;
      out.push({
        id: `notam-${String(nt.id ?? out.length)}`,
        label: 'NOTAM',
        text: `${String(nt.location ?? '')} — ${String(nt.notam_text ?? 'Airspace Notice').slice(0, 80)}`,
        severity: nt.type === 'TFR' || nt.type === 'RESTRICTED' ? 'HIGH' : 'LOW',
        icon: 'plane',
      });
    }

    for (const fc of (data.feodo_c2 ?? []).slice(0, 4)) {
      const f2 = fc as unknown as Record<string, unknown>;
      out.push({
        id: `feodo-${String(f2.ip_address ?? out.length)}`,
        label: 'C2 ACTIVE',
        text: `${String(f2.ip_address ?? '')}${f2.as_name ? ` (${f2.as_name})` : ''}${f2.country ? ` [${f2.country}]` : ''}`,
        severity: f2.status === 'online' ? 'CRITICAL' : 'LOW',
        icon: 'globe',
      });
    }

    return out;
  }, [
    data.sgsecure_alerts,
    data.scdf_incidents,
    data.mrt_alerts,
    data.singcert_advisories,
    data.otx_pulses,
    data.adsb_military_flights,
    data.notam_entries,
    data.feodo_c2,
  ]);

  const getIcon = (icon: TickerItem['icon'], sev: TickerItem['severity']) => {
    const cls = `flex-shrink-0 ${SEV_COLORS[sev] ?? 'text-cyan-400'}`;
    if (icon === 'train') return <Train size={10} className={cls} />;
    if (icon === 'shield') return <Shield size={10} className={cls} />;
    if (icon === 'cyber') return <Radio size={10} className={cls} />;
    if (icon === 'plane') return <Plane size={10} className={cls} />;
    if (icon === 'globe') return <Globe size={10} className={cls} />;
    return <AlertTriangle size={10} className={cls} />;
  };

  // Standby items shown when no live data is available yet
  const standbyItems: TickerItem[] = [
    { id: 'standby-1', label: 'GTI', text: 'MONITORING — Cyber threat feeds initialising', severity: 'LOW', icon: 'cyber' },
    { id: 'standby-2', label: 'GTI', text: 'MONITORING — Conflict intelligence feeds initialising', severity: 'LOW', icon: 'globe' },
    { id: 'standby-3', label: 'GTI', text: 'MONITORING — Singapore security feeds initialising', severity: 'LOW', icon: 'shield' },
  ];

  const displayItems = items.length > 0 ? items : standbyItems;

  // Duplicate list for seamless infinite scroll
  const doubled = [...displayItems, ...displayItems];

  const duration = Math.max(60, displayItems.length * 12);

  return (
    <div className="w-full h-7 bg-[#050505]/95 border-t border-red-900/30 flex items-center overflow-hidden pointer-events-none backdrop-blur-xl">
      {/* ALERT label */}
      <div className="flex-shrink-0 px-3 flex items-center gap-1.5 border-r border-red-800/40 h-full bg-red-950/30">
        <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
        <span className="text-[8px] font-mono font-bold tracking-[0.2em] text-red-400 uppercase">
          ALERTS
        </span>
      </div>

      {/* Scrolling content */}
      <motion.div
        className="flex items-center whitespace-nowrap will-change-transform pl-4"
        animate={{ x: ['0%', '-50%'] }}
        transition={{ ease: 'linear', duration, repeat: Infinity }}
      >
        {doubled.map((item, i) => (
          <div
            key={`${item.id}-${i}`}
            className="flex items-center gap-2 shrink-0 mx-5"
          >
            {getIcon(item.icon, item.severity)}
            <span className={`text-[8px] font-mono font-bold tracking-widest ${SEV_COLORS[item.severity] ?? 'text-cyan-400'}`}>
              [{item.label}]
            </span>
            <span className="text-[10px] font-mono text-[var(--text-primary,#e2e8f0)]">
              {item.text}
            </span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
