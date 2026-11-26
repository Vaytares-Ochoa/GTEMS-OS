import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, Square, Repeat, Shuffle, Volume2, Maximize } from 'lucide-react';
import { apiFetch, getRawFileUrl } from '../../lib/apiClient';
import type { FileEntry } from '../../lib/types';

interface MediaPlayerAppProps {
  mode: 'audio' | 'video';
  initialPath?: string;
}

export const MediaPlayerApp: React.FC<MediaPlayerAppProps> = ({ mode, initialPath }) => {
  const [playlist, setPlaylist] = useState<FileEntry[]>([]);
  const [activePath, setActivePath] = useState(
    initialPath || (mode === 'audio' ? '/Música/Aurora_Chime.wav' : '')
  );
  const [playing, setPlaying] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [speed, setSpeed] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const mediaRef = useRef<HTMLAudioElement & HTMLVideoElement | null>(null);

  useEffect(() => {
    const dir = mode === 'audio' ? '/Música' : '/Vídeos';
    apiFetch<{ entries: FileEntry[] }>(`/api/fs/list?path=${encodeURIComponent(dir)}`)
      .then((res) => {
        const filtered = res.entries.filter(
          (e) => !e.isDirectory && e.appId === (mode === 'audio' ? 'music-player' : 'video-player')
        );
        setPlaylist(filtered);
        if (!activePath && filtered.length > 0) {
          setActivePath(filtered[0].path);
        }
      })
      .catch(() => {});
  }, [mode]);

  useEffect(() => {
    if (mediaRef.current) {
      mediaRef.current.volume = volume;
      mediaRef.current.playbackRate = speed;
    }
  }, [volume, speed, activePath]);

  const togglePlay = () => {
    const el = mediaRef.current;
    if (!el || !activePath) return;
    if (el.paused) {
      void el.play();
      setPlaying(true);
    } else {
      el.pause();
      setPlaying(false);
    }
  };

  const stop = () => {
    const el = mediaRef.current;
    if (!el) return;
    el.pause();
    el.currentTime = 0;
    setPlaying(false);
  };

  const handleEnded = () => {
    if (repeat && mediaRef.current) {
      mediaRef.current.currentTime = 0;
      void mediaRef.current.play();
      return;
    }
    if (playlist.length > 1) {
      const idx = playlist.findIndex((p) => p.path === activePath);
      const nextIdx = shuffle
        ? Math.floor(Math.random() * playlist.length)
        : (idx + 1) % playlist.length;
      setActivePath(playlist[nextIdx].path);
    } else {
      setPlaying(false);
    }
  };

  return (
    <div className="h-full flex flex-col p-5 gap-4 text-[var(--gtems-text)]">
      {mode === 'video' ? (
        <div className="flex-1 min-h-0 rounded-2xl bg-black flex items-center justify-center overflow-hidden">
          {activePath ? (
            <video
              ref={mediaRef as React.RefObject<HTMLVideoElement>}
              src={getRawFileUrl(activePath)}
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
              onEnded={handleEnded}
              className="w-full h-full object-contain"
            />
          ) : (
            <p className="text-xs text-white/70">No hay archivos de vídeo en /Vídeos. Abre un vídeo desde GTEMS Explorer.</p>
          )}
        </div>
      ) : (
        <div className="p-5 rounded-2xl border border-[var(--gtems-border)] bg-[#DDF5EC]/55 dark:bg-[#398F91]/15">
          <div className="text-xs text-[var(--gtems-text-muted)]">Pista actual</div>
          <div className="font-display font-bold text-base mt-0.5 truncate">
            {activePath ? activePath.split('/').pop() : 'Sin archivo seleccionado'}
          </div>
          {activePath && (
            <audio
              ref={mediaRef as React.RefObject<HTMLAudioElement>}
              src={getRawFileUrl(activePath)}
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
              onEnded={handleEnded}
            />
          )}
        </div>
      )}

      {/* Progress & Controls */}
      <div className="space-y-3">
        <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
          <span>{currentTime.toFixed(1)}s</span>
          <input
            type="range"
            min={0}
            max={Math.max(1, duration)}
            step={0.1}
            value={currentTime}
            onChange={(e) => {
              const t = Number(e.target.value);
              if (mediaRef.current) mediaRef.current.currentTime = t;
              setCurrentTime(t);
            }}
            className="flex-1 accent-[#398F91]"
          />
          <span>{duration.toFixed(1)}s</span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button type="button" onClick={togglePlay} disabled={!activePath} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#398F91] text-white text-xs font-semibold disabled:opacity-40">
              {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span>{playing ? 'Pausar' : 'Reproducir'}</span>
            </button>
            <button type="button" onClick={stop} aria-label="Detener" className="p-2 rounded-xl border border-[var(--gtems-border)]">
              <Square className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => setRepeat((r) => !r)} aria-label="Repetir" className={`p-2 rounded-xl border ${repeat ? 'bg-[#398F91] text-white border-[#398F91]' : 'border-[var(--gtems-border)]'}`}>
              <Repeat className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => setShuffle((s) => !s)} aria-label="Aleatorio" className={`p-2 rounded-xl border ${shuffle ? 'bg-[#398F91] text-white border-[#398F91]' : 'border-[var(--gtems-border)]'}`}>
              <Shuffle className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <label className="flex items-center gap-1.5">
              <Volume2 className="w-4 h-4" />
              <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="w-20 accent-[#398F91]" />
            </label>
            <select aria-label="Velocidad" value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="px-2 py-1 rounded-lg border border-[var(--gtems-border)] bg-white dark:bg-slate-800">
              <option value={0.5}>0.5x</option>
              <option value={1}>1.0x</option>
              <option value={1.5}>1.5x</option>
              <option value={2}>2.0x</option>
            </select>
            {mode === 'video' && (
              <button
                type="button"
                aria-label="Pantalla completa"
                onClick={() => mediaRef.current?.requestFullscreen?.()}
                className="p-2 rounded-xl border border-[var(--gtems-border)]"
              >
                <Maximize className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Playlist */}
      <div className="flex-1 min-h-[100px] overflow-y-auto aurora-scroll border border-[var(--gtems-border)] rounded-xl p-2 space-y-1">
        {playlist.length === 0 ? (
          <div className="p-3 text-xs text-[var(--gtems-text-muted)]">Lista vacía en {mode === 'audio' ? '/Música' : '/Vídeos'}.</div>
        ) : (
          playlist.map((item) => (
            <button
              key={item.path}
              type="button"
              onClick={() => setActivePath(item.path)}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs flex justify-between ${
                activePath === item.path ? 'bg-[#398F91] text-white font-semibold' : 'hover:bg-[#398F91]/10'
              }`}
            >
              <span className="truncate">{item.name}</span>
              <span className="font-mono">{(item.size / 1024).toFixed(1)} KB</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
};
