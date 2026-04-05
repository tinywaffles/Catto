'use client';

import { useState, useEffect, useRef } from 'react';
import { X, FileText } from 'lucide-react';

interface Props {
  lat: number;
  lng: number;
  x: number;
  y: number;
  onRegionDossier: (coords: { lat: number; lng: number }) => void;
  onClose: () => void;
}

export default function MapContextMenu({ lat, lng, x, y, onRegionDossier, onClose }: Props) {
  const [placeName, setPlaceName] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Reverse geocode on mount
  useEffect(() => {
    fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}&local_only=1`)
      .then((r) => r.json())
      .then((d) => {
        const name =
          d?.country ||
          d?.display_name?.split(',').slice(-2).join(',').trim() ||
          null;
        setPlaceName(name);
      })
      .catch(() => {});
  }, [lat, lng]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 100);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', handler);
    };
  }, [onClose]);

  // Clamp menu position
  const clampedX = Math.min(x, window.innerWidth - 188);
  const clampedY = Math.min(y, window.innerHeight - 120);

  return (
    <div
      ref={menuRef}
      className="fixed z-[500] bg-[#06090f]/98 border border-cyan-900/60 backdrop-blur-md font-mono shadow-xl"
      style={{ left: clampedX, top: clampedY, width: 180 }}
    >
      {/* Coordinates header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-cyan-900/40">
        <span className="text-[7.5px] text-gray-400 tracking-widest">
          {lat.toFixed(4)}°N {lng.toFixed(4)}°E
        </span>
        {placeName && (
          <span className="text-[7.5px] text-gray-300 ml-2 truncate max-w-[80px]">{placeName}</span>
        )}
        <button onClick={onClose} className="text-gray-500 hover:text-gray-300 ml-1 flex-shrink-0">
          <X size={9} />
        </button>
      </div>

      {/* Menu options */}
      <div className="py-1">
        <button
          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-cyan-950/40 transition-colors text-left"
          onClick={() => { onRegionDossier({ lat, lng }); onClose(); }}
        >
          <FileText size={9} className="text-cyan-400 flex-shrink-0" />
          <span className="text-[9px] text-gray-200 tracking-wide">REGION DOSSIER</span>
        </button>
      </div>
    </div>
  );
}
