'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, ExternalLink } from 'lucide-react';
import { subscribeToast, type ToastMessage } from '@/lib/toastBus';

interface ActiveToast extends ToastMessage {
  shownAt: number;
}

const DISMISS_MS = 10_000;

export default function ToastNotifications() {
  const [toasts, setToasts] = useState<ActiveToast[]>([]);

  // Subscribe to incoming toast events
  useEffect(() => {
    return subscribeToast((msg) => {
      setToasts((prev) => {
        // Deduplicate by id
        if (prev.some((t) => t.id === msg.id)) return prev;
        return [...prev, { ...msg, shownAt: Date.now() }];
      });
    });
  }, []);

  // Auto-dismiss after DISMISS_MS
  useEffect(() => {
    if (toasts.length === 0) return;
    const interval = setInterval(() => {
      const now = Date.now();
      setToasts((prev) => prev.filter((t) => now - t.shownAt < DISMISS_MS));
    }, 500);
    return () => clearInterval(interval);
  }, [toasts.length]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <div className="absolute top-4 right-6 z-[9500] flex flex-col gap-2 pointer-events-none w-80">
      <AnimatePresence>
        {toasts.map((toast) => {
          const isCritical = toast.severity === 'CRITICAL';
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 60, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 60, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className={`pointer-events-auto font-mono border shadow-lg backdrop-blur-sm ${
                isCritical
                  ? 'bg-red-950/90 border-red-500/60 shadow-red-900/40'
                  : 'bg-orange-950/90 border-orange-500/50 shadow-orange-900/30'
              }`}
            >
              <div className="flex items-start gap-2 p-3">
                <AlertTriangle
                  size={14}
                  className={`mt-0.5 flex-shrink-0 ${isCritical ? 'text-red-400 animate-pulse' : 'text-orange-400'}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span
                      className={`text-[8px] font-bold tracking-widest uppercase ${
                        isCritical ? 'text-red-400' : 'text-orange-400'
                      }`}
                    >
                      {toast.severity} · {toast.source}
                    </span>
                    <button
                      onClick={() => dismiss(toast.id)}
                      className={`flex-shrink-0 transition-colors ${
                        isCritical
                          ? 'text-red-500 hover:text-red-300'
                          : 'text-orange-500 hover:text-orange-300'
                      }`}
                    >
                      <X size={11} />
                    </button>
                  </div>
                  <div className="text-[11px] text-white leading-snug line-clamp-2">
                    {toast.title}
                  </div>
                  {toast.link && (
                    <a
                      href={toast.link}
                      target="_blank"
                      rel="noreferrer"
                      className={`mt-1 inline-flex items-center gap-1 text-[8px] transition-colors ${
                        isCritical
                          ? 'text-red-400 hover:text-red-300'
                          : 'text-orange-400 hover:text-orange-300'
                      }`}
                    >
                      <ExternalLink size={8} /> VIEW
                    </a>
                  )}
                </div>
              </div>
              {/* Progress bar */}
              <motion.div
                className={`h-[2px] ${isCritical ? 'bg-red-500' : 'bg-orange-500'}`}
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: DISMISS_MS / 1000, ease: 'linear' }}
                style={{ transformOrigin: 'left' }}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
