'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Github,
  MessageSquare,
  Download,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  X,
  Copy,
} from 'lucide-react';
import { API_BASE } from '@/lib/api';
import { controlPlaneFetch } from '@/lib/controlPlane';
import packageJson from '../../package.json';

type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'uptodate'
  | 'error'
  | 'confirming'
  | 'updating'
  | 'restarting'
  | 'update_error'
  | 'docker_update';

const DEFAULT_RELEASES_URL = 'https://github.com/cattoosint/Catto/releases/latest';

export default function TopRightControls() {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle');
  const [latestVersion, setLatestVersion] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState('');
  const [manualUpdateUrl, setManualUpdateUrl] = useState(DEFAULT_RELEASES_URL);
  const [dockerCommands, setDockerCommands] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentVersion = packageJson.version;

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const checkForUpdates = async () => {
    setUpdateStatus('checking');
    try {
      const res = await fetch(
        'https://api.github.com/repos/cattoosint/Catto/releases/latest',
      );
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();

      const latest = data.tag_name?.replace('v', '') || data.name?.replace('v', '');
      const current = currentVersion.replace('v', '');
      const releaseUrl =
        typeof data.html_url === 'string' && data.html_url.trim().length > 0
          ? data.html_url
          : DEFAULT_RELEASES_URL;
      setManualUpdateUrl(releaseUrl);

      if (latest && latest !== current) {
        setLatestVersion(latest);
        setUpdateStatus('available');
      } else {
        setUpdateStatus('uptodate');
        setTimeout(() => setUpdateStatus('idle'), 3000);
      }
    } catch (err) {
      console.error('Update check failed:', err);
      setUpdateStatus('error');
      setTimeout(() => setUpdateStatus('idle'), 3000);
    }
  };

  const startRestartPolling = () => {
    setUpdateStatus('restarting');

    // Poll /api/health until backend comes back
    pollRef.current = setInterval(async () => {
      try {
        const h = await fetch(`${API_BASE}/api/health`);
        if (h.ok) {
          if (pollRef.current) clearInterval(pollRef.current);
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          window.location.reload();
        }
      } catch {
        // Backend still down — keep polling
      }
    }, 3000);

    // Give up after 90 seconds
    timeoutRef.current = setTimeout(() => {
      if (pollRef.current) clearInterval(pollRef.current);
      setErrorMessage('Restart timed out — the app may need to be started manually.');
      setUpdateStatus('update_error');
    }, 90000);
  };

  const triggerUpdate = async () => {
    setUpdateStatus('updating');
    setErrorMessage('');
    try {
      const res = await controlPlaneFetch('/api/system/update', { method: 'POST' });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        status?: string;
        message?: string;
        detail?: string;
        manual_url?: string;
        docker_commands?: string;
      };
      if (typeof data.manual_url === 'string' && data.manual_url.trim().length > 0) {
        setManualUpdateUrl(data.manual_url);
      }
      if (data?.status === 'docker') {
        setDockerCommands(data.docker_commands || 'docker compose pull && docker compose up -d');
        setUpdateStatus('docker_update');
        return;
      }
      if (!res.ok || data?.ok === false || data?.status === 'error') {
        const message = data?.detail || data?.message || 'control_plane_request_failed';
        const error = new Error(message) as Error & { manualUrl?: string };
        error.manualUrl = data?.manual_url;
        throw error;
      }

      startRestartPolling();
    } catch (err) {
      // The update extracts files over the project, which causes the Next.js
      // dev server to hot-reload and drop the proxy connection mid-request.
      // A network error during update likely means it SUCCEEDED and the
      // server is restarting — transition to polling instead of showing failure.
      const message =
        typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message?: string }).message)
          : '';
      const isNetworkDrop = err instanceof TypeError || message === 'Failed to fetch';
      if (isNetworkDrop) {
        startRestartPolling();
      } else {
        const manualUrl =
          typeof err === 'object' && err !== null && 'manualUrl' in err
            ? String((err as { manualUrl?: string }).manualUrl || '')
            : '';
        if (manualUrl) {
          setManualUpdateUrl(manualUrl);
        }
        setErrorMessage(message || 'Unknown error');
        setUpdateStatus('update_error');
      }
    }
  };

  // ── Confirmation Dialog ──
  const renderConfirmDialog = () => (
    <div className="absolute top-full right-0 mt-2 w-72 z-[9999]">
      <div className="bg-[var(--bg-primary)]/95 backdrop-blur-sm border border-cyan-800/60 shadow-[0_4px_30px_rgba(59,130,246,0.15)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-primary)]">
          <span className="text-[10px] font-mono tracking-widest text-cyan-400">
            UPDATE v{currentVersion} → v{latestVersion}
          </span>
          <button
            onClick={() => setUpdateStatus('available')}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X size={12} />
          </button>
        </div>

        {/* Actions */}
        <div className="p-3 flex flex-col gap-2">
          <button
            onClick={triggerUpdate}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-cyan-500/10 border border-cyan-500/40 hover:bg-cyan-500/20 transition-all text-[10px] text-cyan-400 font-mono tracking-widest"
          >
            <Download size={12} />
            AUTO UPDATE
          </button>

          <a
            href={manualUpdateUrl}
            target="_blank"
            rel="noreferrer"
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[var(--bg-secondary)]/50 border border-[var(--border-primary)] hover:border-[var(--text-muted)] transition-all text-[10px] text-[var(--text-muted)] font-mono tracking-widest"
          >
            <ExternalLink size={12} />
            MANUAL DOWNLOAD
          </a>

          <button
            onClick={() => setUpdateStatus('available')}
            className="w-full flex items-center justify-center px-3 py-1.5 text-[9px] text-[var(--text-muted)] font-mono tracking-widest hover:text-[var(--text-secondary)] transition-colors"
          >
            CANCEL
          </button>
        </div>
      </div>
    </div>
  );

  // ── Error Dialog ──
  const renderErrorDialog = () => (
    <div className="absolute top-full right-0 mt-2 w-72 z-[9999]">
      <div className="bg-[var(--bg-primary)]/95 backdrop-blur-sm border border-red-800/60 shadow-[0_4px_30px_rgba(255,0,0,0.1)] overflow-hidden">
        <div className="px-3 py-2 border-b border-red-900/40">
          <span className="text-[10px] font-mono tracking-widest text-red-400">UPDATE FAILED</span>
        </div>
        <div className="p-3 flex flex-col gap-2">
          <p className="text-[9px] font-mono text-[var(--text-muted)] leading-relaxed break-words">
            {errorMessage}
          </p>
          <button
            onClick={() => setUpdateStatus('confirming')}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-cyan-500/10 border border-cyan-500/40 hover:bg-cyan-500/20 transition-all text-[10px] text-cyan-400 font-mono tracking-widest"
          >
            <RefreshCw size={12} />
            TRY AGAIN
          </button>
          <a
            href={manualUpdateUrl}
            target="_blank"
            rel="noreferrer"
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[var(--bg-secondary)]/50 border border-[var(--border-primary)] hover:border-[var(--text-muted)] transition-all text-[10px] text-[var(--text-muted)] font-mono tracking-widest"
          >
            <ExternalLink size={12} />
            MANUAL DOWNLOAD
          </a>
        </div>
      </div>
    </div>
  );

  // ── Docker Update Dialog ──
  const renderDockerDialog = () => (
    <div className="absolute top-full right-0 mt-2 w-80 z-[9999]">
      <div className="bg-[var(--bg-primary)]/95 backdrop-blur-sm border border-cyan-800/60 shadow-[0_4px_30px_rgba(59,130,246,0.15)] overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-primary)]">
          <span className="text-[10px] font-mono tracking-widest text-cyan-400">
            DOCKER UPDATE — v{latestVersion}
          </span>
          <button
            onClick={() => setUpdateStatus('idle')}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X size={12} />
          </button>
        </div>
        <div className="p-3 flex flex-col gap-2">
          <p className="text-[9px] font-mono text-[var(--text-muted)] leading-relaxed">
            Docker containers must be updated by pulling new images.
            Run this on your host machine:
          </p>
          <div className="relative bg-black/40 border border-[var(--border-primary)] p-2 group">
            <code className="text-[9px] font-mono text-green-400 break-all">{dockerCommands}</code>
            <button
              onClick={() => navigator.clipboard.writeText(dockerCommands)}
              className="absolute top-1 right-1 p-1 opacity-0 group-hover:opacity-100 transition-opacity text-[var(--text-muted)] hover:text-cyan-400"
              title="Copy command"
            >
              <Copy size={10} />
            </button>
          </div>
          <a
            href={manualUpdateUrl}
            target="_blank"
            rel="noreferrer"
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[var(--bg-secondary)]/50 border border-[var(--border-primary)] hover:border-[var(--text-muted)] transition-all text-[10px] text-[var(--text-muted)] font-mono tracking-widest"
          >
            <ExternalLink size={12} />
            VIEW RELEASE
          </a>
        </div>
      </div>
    </div>
  );

  // Uniform button style (matches UPDATES button)
  const btnBase = 'flex items-center justify-center gap-1 px-2 py-1.5 bg-[var(--bg-primary)]/70 border border-[var(--border-primary)] hover:border-cyan-500/50 hover:bg-[var(--hover-accent)] transition-all text-[10px] text-[var(--text-secondary)] font-mono cursor-pointer min-w-[100px]';

  return (
    <>
      <div className="relative flex items-center gap-1.5 mb-1 justify-end">
        {/* Discussions link */}
        <a
          href="https://github.com/cattoosint/Catto/discussions"
          target="_blank"
          rel="noreferrer"
          className={btnBase}
        >
          <MessageSquare size={11} className="text-cyan-400" />
          <span className="tracking-wider">DISCUSS</span>
        </a>

        {/* ── Update Available → opens confirmation ── */}
        {updateStatus === 'available' && (
          <button
            onClick={() => setUpdateStatus('confirming')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-green-500/10 backdrop-blur-sm border border-green-500/50 hover:bg-green-500/20 transition-all text-[10px] text-green-400 font-mono cursor-pointer shadow-[0_0_15px_rgba(34,197,94,0.3)]"
          >
            <Download size={12} className="w-3 h-3" />
            <span className="tracking-widest">v{latestVersion} UPDATE!</span>
          </button>
        )}

        {/* ── Confirming → show dialog ── */}
        {updateStatus === 'confirming' && (
          <>
            <button className="flex items-center gap-1.5 px-2.5 py-1.5 bg-green-500/10 backdrop-blur-sm border border-green-500/50 text-[10px] text-green-400 font-mono shadow-[0_0_15px_rgba(34,197,94,0.3)]">
              <Download size={12} className="w-3 h-3" />
              <span className="tracking-widest">v{latestVersion} UPDATE!</span>
            </button>
            {renderConfirmDialog()}
          </>
        )}

        {/* ── Updating → spinner ── */}
        {updateStatus === 'updating' && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-cyan-500/10 backdrop-blur-sm border border-cyan-500/50 text-[10px] text-cyan-400 font-mono">
            <RefreshCw size={12} className="w-3 h-3 animate-spin" />
            <span className="tracking-widest">DOWNLOADING UPDATE...</span>
          </div>
        )}

        {/* ── Restarting → spinner + waiting ── */}
        {updateStatus === 'restarting' && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-cyan-500/10 backdrop-blur-sm border border-cyan-500/50 text-[10px] text-cyan-400 font-mono shadow-[0_0_15px_rgba(59,130,246,0.2)]">
            <RefreshCw size={12} className="w-3 h-3 animate-spin" />
            <span className="tracking-widest">RESTARTING...</span>
          </div>
        )}

        {/* ── Error → show error dialog ── */}
        {updateStatus === 'update_error' && (
          <>
            <button
              onClick={() => setUpdateStatus('confirming')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-500/10 backdrop-blur-sm border border-red-500/50 hover:bg-red-500/20 transition-all text-[10px] text-red-400 font-mono"
            >
              <AlertCircle size={12} className="w-3 h-3" />
              <span className="tracking-widest">UPDATE FAILED</span>
            </button>
            {renderErrorDialog()}
          </>
        )}

        {/* ── Docker update → show pull instructions ── */}
        {updateStatus === 'docker_update' && (
          <>
            <button
              onClick={() => setUpdateStatus('docker_update')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-cyan-500/10 backdrop-blur-sm border border-cyan-500/50 text-[10px] text-cyan-400 font-mono shadow-[0_0_15px_rgba(59,130,246,0.2)]"
            >
              <Download size={12} className="w-3 h-3" />
              <span className="tracking-widest">DOCKER UPDATE</span>
            </button>
            {renderDockerDialog()}
          </>
        )}

        {/* ── Default states: idle / checking / uptodate / check-error ── */}
        {!['available', 'confirming', 'updating', 'restarting', 'update_error', 'docker_update'].includes(
          updateStatus,
        ) && (
          <a
            href="https://github.com/cattoosint/Catto/releases"
            target="_blank"
            rel="noreferrer"
            onClick={updateStatus !== 'checking' ? checkForUpdates : undefined}
            className={`${btnBase} ${updateStatus === 'checking' ? 'opacity-50 pointer-events-none' : ''}`}
          >
            {updateStatus === 'checking' && (
              <Github size={11} className="animate-spin text-cyan-400" />
            )}
            {updateStatus === 'idle' && <Github size={11} className="text-cyan-400" />}
            {updateStatus === 'uptodate' && <CheckCircle2 size={11} className="text-green-400" />}
            {updateStatus === 'error' && <AlertCircle size={11} className="text-red-400" />}

            <span className="tracking-wider">
              {updateStatus === 'checking'
                ? 'CHECKING...'
                : updateStatus === 'uptodate'
                  ? 'UP TO DATE'
                  : updateStatus === 'error'
                    ? 'CHECK FAILED'
                    : 'UPDATES'}
            </span>
          </a>
        )}
      </div>
    </>
  );
}
