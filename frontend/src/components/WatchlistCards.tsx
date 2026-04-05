'use client';

import { useState, useRef, useEffect } from 'react';
import { Plane, Ship, MapPin, X, ChevronUp } from 'lucide-react';
import type { WatchedEntity } from '@/types/watchlist';

// Speed threshold above which an entity is considered "moving"
const MOVING_THRESHOLD_KT = 1.5;
// Speed delta that triggers a motion alert (sudden acceleration)
const SPEED_DELTA_ALERT_KT = 15;

interface Props {
  entities: WatchedEntity[];
  onFlyTo: (lat: number, lng: number) => void;
  onRemoveEntry: (watchId: string) => void;
}

function FlightRow({ label, value, dim }: { label: string; value: string; dim?: boolean }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[7px] font-mono text-[var(--text-muted)] tracking-[0.15em] w-7 flex-shrink-0">{label}</span>
      <span className={`text-[9px] font-mono ${dim ? 'text-[var(--text-muted)]' : 'text-[var(--text-primary)]'} truncate`}>
        {value}
      </span>
    </div>
  );
}

function EntityCard({
  entity,
  onFlyTo,
  onClose,
  onRemoveEntry,
}: {
  entity: WatchedEntity;
  onFlyTo: (lat: number, lng: number) => void;
  onClose: () => void;
  onRemoveEntry: (watchId: string) => void;
}) {
  const isFlight = entity.entityType === 'flight';

  return (
    <div
      className="w-52 bg-[#06090f]/95 border border-[var(--border-primary)] backdrop-blur-md overflow-hidden"
      style={{ borderLeftColor: entity.color, borderLeftWidth: 2 }}
    >
      {/* Header */}
      <div className="flex items-start gap-2 px-2.5 pt-2 pb-1.5">
        <div className="flex-shrink-0 mt-0.5" style={{ color: entity.color }}>
          {isFlight ? <Plane size={10} /> : <Ship size={10} />}
        </div>
        <div className="flex flex-col gap-0 flex-1 min-w-0">
          <span className="text-[10px] font-mono font-bold text-[var(--text-primary)] truncate tracking-wider">
            {entity.label}
          </span>
          {entity.subLabel && (
            <span className="text-[8px] font-mono text-[var(--text-muted)] truncate">
              {entity.subLabel}
            </span>
          )}
        </div>
        {/* Collapse button */}
        <button
          onClick={onClose}
          className="text-[var(--text-muted)]/40 hover:text-[var(--text-muted)] transition-colors flex-shrink-0 mt-0.5"
          aria-label="Collapse"
        >
          <ChevronUp size={9} />
        </button>
        {/* Remove button */}
        <button
          onClick={() => onRemoveEntry(entity.watchId)}
          className="text-[var(--text-muted)]/40 hover:text-red-400 transition-colors flex-shrink-0 mt-0.5"
          aria-label={`Remove ${entity.label} from watchlist`}
        >
          <X size={9} />
        </button>
      </div>

      {/* Divider */}
      <div className="h-px bg-[var(--border-primary)]/60 mx-2" />

      {/* Stats */}
      <div className="px-2.5 py-1.5 flex flex-col gap-0.5">
        {isFlight ? (
          <>
            {entity.altitude !== undefined && (
              <FlightRow label="ALT" value={`${entity.altitude.toLocaleString()}ft`} />
            )}
            {entity.speed !== undefined && (
              <div className="flex gap-3">
                <FlightRow label="SPD" value={`${Math.round(entity.speed)}kt`} />
                {entity.heading !== undefined && (
                  <FlightRow label="HDG" value={`${Math.round(entity.heading)}°`} />
                )}
              </div>
            )}
            {entity.registration && entity.registration !== entity.label && (
              <FlightRow label="REG" value={entity.registration} dim />
            )}
          </>
        ) : (
          <>
            {entity.speed !== undefined && (
              <div className="flex gap-3">
                <FlightRow label="SOG" value={`${entity.speed.toFixed(1)}kt`} />
                {entity.heading !== undefined && (
                  <FlightRow label="COG" value={`${Math.round(entity.heading)}°`} />
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Route */}
      {(entity.origin || entity.destination) && (
        <>
          <div className="h-px bg-[var(--border-primary)]/60 mx-2" />
          <div className="px-2.5 py-1.5">
            <div className="flex items-center gap-1 text-[9px] font-mono text-[var(--text-muted)]">
              {entity.origin && (
                <span className="text-[var(--text-secondary)] font-semibold truncate max-w-[4rem]">
                  {entity.origin}
                </span>
              )}
              {entity.origin && (entity.destination || entity.etaStr) && (
                <span className="text-[var(--text-muted)]/50 flex-shrink-0">→</span>
              )}
              {entity.destination && (
                <span className="text-[var(--text-secondary)] font-semibold truncate max-w-[4rem]">
                  {entity.destination}
                </span>
              )}
              {entity.etaStr && (
                <>
                  <span className="text-[var(--text-muted)]/50 flex-shrink-0 ml-auto">ETA</span>
                  <span className="text-amber-400 font-semibold flex-shrink-0">{entity.etaStr}</span>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* Position */}
      <div className="h-px bg-[var(--border-primary)]/60 mx-2" />
      <div className="px-2.5 py-1 text-[7px] font-mono text-[var(--text-muted)]/60">
        {entity.lat.toFixed(3)}°, {entity.lng.toFixed(3)}°
      </div>

      {/* Fly-to button */}
      <div className="px-2 pb-2">
        <button
          onClick={() => onFlyTo(entity.lat, entity.lng)}
          className="w-full flex items-center justify-center gap-1 py-1 border border-[var(--border-primary)]/60 hover:border-amber-600/50 text-[var(--text-muted)] hover:text-amber-400 transition-colors text-[8px] font-mono tracking-wider"
        >
          <MapPin size={8} />
          FLY TO
        </button>
      </div>
    </div>
  );
}

export default function WatchlistCards({ entities, onFlyTo, onRemoveEntry }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Set of watchIds that have an unacknowledged motion alert
  const [motionAlerts, setMotionAlerts] = useState<Set<string>>(new Set());
  // Previous snapshot: watchId → { speed, lat, lng, seen }
  const prevSnap = useRef<Map<string, { speed: number; lat: number; lng: number }>>(new Map());

  useEffect(() => {
    const prev = prevSnap.current;
    const newAlerts: string[] = [];

    for (const entity of entities) {
      const id = entity.watchId;
      const curSpeed = entity.speed ?? 0;
      const snap = prev.get(id);

      if (snap) {
        const wasStationary = snap.speed < MOVING_THRESHOLD_KT;
        const isMoving = curSpeed >= MOVING_THRESHOLD_KT;
        const bigDelta = curSpeed - snap.speed >= SPEED_DELTA_ALERT_KT;

        if ((wasStationary && isMoving) || bigDelta) {
          newAlerts.push(id);
        }
      }
      // Update snapshot
      prev.set(id, { speed: curSpeed, lat: entity.lat, lng: entity.lng });
    }

    // Remove stale entries from snapshot
    for (const id of prev.keys()) {
      if (!entities.find((e) => e.watchId === id)) prev.delete(id);
    }

    if (newAlerts.length > 0) {
      setMotionAlerts((prev) => {
        const next = new Set(prev);
        newAlerts.forEach((id) => next.add(id));
        return next;
      });
    }
  }, [entities]);

  const acknowledgeAlert = (id: string) => {
    setMotionAlerts((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  if (entities.length === 0) return null;

  const expandedEntity = entities.find((e) => e.watchId === expandedId) ?? null;

  return (
    <div className="fixed bottom-10 right-[22.5rem] z-[205] flex flex-col items-end gap-1 pointer-events-auto">
      {/* Expanded card — floats above the tab bar */}
      {expandedEntity && (
        <div className="mb-1">
          <EntityCard
            key={`${expandedEntity.watchId}-card`}
            entity={expandedEntity}
            onFlyTo={onFlyTo}
            onClose={() => setExpandedId(null)}
            onRemoveEntry={(id) => {
              setExpandedId(null);
              onRemoveEntry(id);
            }}
          />
        </div>
      )}

      {/* Tab bar — one pill per watched entity */}
      <div className="flex flex-wrap justify-end gap-1 max-w-[480px]">
        {entities.map((entity) => {
          const isFlight = entity.entityType === 'flight';
          const isExpanded = expandedId === entity.watchId;
          const hasAlert = motionAlerts.has(entity.watchId);

          return (
            <div
              key={entity.watchId}
              className="relative flex items-center gap-1 pl-2 pr-1 h-6 bg-[#06090f]/90 border backdrop-blur-md cursor-pointer select-none transition-all"
              style={{
                borderColor: hasAlert
                  ? 'rgba(239,68,68,0.7)'
                  : isExpanded
                    ? entity.color
                    : 'rgba(255,255,255,0.08)',
                borderLeftColor: entity.color,
                borderLeftWidth: 2,
                boxShadow: hasAlert
                  ? '0 0 8px rgba(239,68,68,0.5)'
                  : isExpanded
                    ? `0 0 8px ${entity.color}40`
                    : 'none',
              }}
              onClick={() => {
                acknowledgeAlert(entity.watchId);
                setExpandedId(isExpanded ? null : entity.watchId);
              }}
            >
              {/* Motion alert dot */}
              {hasAlert && (
                <span
                  className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 animate-ping"
                  style={{ zIndex: 1 }}
                />
              )}
              {hasAlert && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500" />
              )}
              <span style={{ color: entity.color }} className="flex-shrink-0">
                {isFlight ? <Plane size={8} /> : <Ship size={8} />}
              </span>
              <span
                className={`text-[8px] font-mono tracking-wider truncate max-w-[6rem] ${
                  hasAlert ? 'text-red-300' : 'text-[var(--text-primary)]'
                }`}
              >
                {entity.label}
              </span>
              {/* Remove from watchlist — separate from expand click */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (expandedId === entity.watchId) setExpandedId(null);
                  acknowledgeAlert(entity.watchId);
                  onRemoveEntry(entity.watchId);
                }}
                className="text-[var(--text-muted)]/30 hover:text-red-400 transition-colors flex-shrink-0 ml-0.5"
                aria-label={`Remove ${entity.label}`}
              >
                <X size={7} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
