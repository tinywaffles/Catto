'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, FileText, Download, Trash2 } from 'lucide-react';

const STORAGE_KEY = 'catto_incident_notes';

export default function IncidentNotepadPanel() {
  const [isMinimized, setIsMinimized] = useState(true);
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(true);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setNotes(stored);
  }, []);

  // Debounce-save on change
  const handleChange = (val: string) => {
    setNotes(val);
    setSaved(false);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, val);
      setSaved(true);
    }, 800);
  };

  const exportNotes = () => {
    if (!notes.trim()) return;
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const content = `CATTO INCIDENT NOTES\nExported: ${ts} SGT+8\n${'─'.repeat(40)}\n\n${notes}\n`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `catto-notes-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearNotes = () => {
    if (!notes.trim()) return;
    if (window.confirm('Clear all incident notes?')) {
      setNotes('');
      localStorage.removeItem(STORAGE_KEY);
      setSaved(true);
    }
  };

  const lineCount = notes ? notes.split('\n').length : 0;
  const charCount = notes.length;

  return (
    <div className="bg-[var(--bg-panel)] border border-[var(--border-primary)] backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsMinimized((m) => !m)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-cyan-950/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <FileText size={10} className="text-cyan-500" />
          <span className="text-[10px] font-mono font-bold tracking-[0.2em] text-cyan-400 uppercase">
            Incident Notepad
          </span>
          {!isMinimized && (
            <span className="text-[7.5px] font-mono text-[var(--text-muted)]">
              {saved ? '· saved' : '· saving…'}
            </span>
          )}
        </div>
        {isMinimized ? <ChevronDown size={10} className="text-cyan-700" /> : <ChevronUp size={10} className="text-cyan-700" />}
      </button>

      {!isMinimized && (
        <div className="px-3 pb-3 space-y-2">
          <textarea
            ref={textareaRef}
            value={notes}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Jot observations, IOCs, timeline notes..."
            className="w-full h-40 bg-[var(--bg-primary)] border border-[var(--border-primary)] px-2 py-2 text-[10px] font-mono text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-cyan-700/60 resize-y min-h-[80px] styled-scrollbar leading-relaxed"
            spellCheck={false}
          />
          <div className="flex items-center justify-between">
            <span className="text-[7.5px] font-mono text-[var(--text-muted)]">
              {lineCount} line{lineCount !== 1 ? 's' : ''} · {charCount} chars
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={clearNotes}
                disabled={!notes.trim()}
                className="flex items-center gap-1 px-2 py-1 text-[8px] font-mono text-red-400/60 hover:text-red-400 border border-red-900/30 hover:border-red-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <Trash2 size={8} />
                Clear
              </button>
              <button
                onClick={exportNotes}
                disabled={!notes.trim()}
                className="flex items-center gap-1 px-2 py-1 text-[8px] font-mono text-cyan-400 hover:text-cyan-300 border border-cyan-900/40 hover:border-cyan-600/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <Download size={8} />
                Export .txt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
