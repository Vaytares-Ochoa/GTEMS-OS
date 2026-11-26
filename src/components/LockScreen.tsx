import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';
import { apiFetch, setAuthToken } from '../lib/apiClient';
import { formatLongDateInZone, formatTimeInZone, t } from '../lib/i18n';
import type { SystemNotification, UserProfile, WallpaperFitMode } from '../lib/types';

interface LockScreenProps {
  wallpaper: string;
  wallpaperFit?: WallpaperFitMode;
  language?: string;
  timezone?: string;
  notifications: SystemNotification[];
  onUnlock: (user: UserProfile) => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({
  wallpaper,
  wallpaperFit = 'cover',
  language = 'es-HN',
  timezone = 'America/Tegucigalpa',
  notifications,
  onUnlock,
}) => {
  const [now, setNow] = useState(new Date());
  const [showAuth, setShowAuth] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!showAuth && !e.metaKey && !e.ctrlKey && !e.altKey) {
        setShowAuth(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showAuth]);

  const timeStr = formatTimeInZone(now, language, timezone);
  const dateStr = formatLongDateInZone(now, language, timezone);

  const fitClass =
    wallpaperFit === 'contain'
      ? 'object-contain bg-slate-950'
      : wallpaperFit === 'fill'
      ? 'object-fill'
      : wallpaperFit === 'center'
      ? 'object-none'
      : 'object-cover';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError(t(language, 'lock.emptyPassword', 'Introduce tu contraseña.'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch<{ token: string; user: UserProfile }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
      setAuthToken(res.token);
      setPassword('');
      onUnlock(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Credenciales inválidas.');
    } finally {
      setSubmitting(false);
    }
  };

  const visibleNotifications = notifications.slice(0, 3);

  return (
    <main
      data-testid="lock-screen"
      onClick={() => {
        if (!showAuth) setShowAuth(true);
      }}
      className="relative w-full h-full overflow-hidden select-none cursor-pointer"
    >
      <img
        src={wallpaper}
        alt="Fondo de bloqueo de GTEMS OS"
        referrerPolicy="no-referrer"
        className={`absolute inset-0 w-full h-full ${fitClass} transition-all duration-300 ${
          showAuth ? 'scale-105 blur-md brightness-90' : 'scale-100'
        }`}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/30 via-transparent to-slate-950/45" />

      <div className="relative z-10 h-full w-full flex flex-col items-center justify-between py-16 px-6 text-white">
        {/* Strictly ONLY Clock, Date, and Notifications before interaction */}
        <div className="flex flex-col items-center text-center mt-4">
          <time className="font-display text-7xl md:text-8xl font-semibold tracking-tight tabular-nums drop-shadow-sm">
            {timeStr}
          </time>
          <p className="mt-2 text-lg md:text-xl font-medium capitalize text-white/90 drop-shadow-sm">
            {dateStr}
          </p>
        </div>

        {showAuth ? (
          <form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl aurora-glass shadow-2xl p-6 text-[var(--gtems-text)] cursor-default"
          >
            <label htmlFor="gtems-lock-password" className="block text-sm font-medium mb-2">
              {t(language, 'lock.passwordLabel', 'Contraseña del sistema')}
            </label>
            <div className="relative flex items-center">
              <input
                id="gtems-lock-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                placeholder={t(language, 'lock.passwordPlaceholder', 'Contraseña')}
                className="w-full pr-11 pl-3.5 py-2.5 rounded-xl bg-[var(--gtems-surface-solid)] border border-[var(--gtems-border)] focus:outline-none focus:ring-2 focus:ring-[var(--gtems-accent)] text-sm"
              />
              <button
                type="button"
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2.5 p-1.5 rounded-lg text-[var(--gtems-text-muted)] hover:text-[var(--gtems-text)]"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {error && (
              <p role="alert" className="mt-2.5 text-xs font-medium text-red-600 dark:text-red-400">
                {error}
              </p>
            )}

            <div className="mt-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowAuth(false);
                  setError(null);
                  setPassword('');
                }}
                className="px-3 py-2 rounded-xl text-xs font-medium text-[var(--gtems-text-muted)] hover:bg-black/5 dark:hover:bg-white/5"
              >
                {t(language, 'lock.back', 'Volver')}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--gtems-accent)] text-white text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-60 whitespace-nowrap"
              >
                <span>{submitting ? t(language, 'lock.verifying', 'Verificando...') : t(language, 'lock.unlock', 'Iniciar sesión')}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        ) : (
          <div className="w-full max-w-md space-y-2.5">
            {visibleNotifications.map((n) => (
              <div
                key={n.id}
                className="rounded-xl bg-slate-950/45 backdrop-blur-xl border border-white/20 px-4 py-3 text-left"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[#BCEBDD]">{n.title}</span>
                  <span className="text-[11px] text-white/70 tabular-nums">
                    {formatTimeInZone(new Date(n.timestamp), language, timezone)}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-white/90 line-clamp-2">{n.body}</p>
              </div>
            ))}
          </div>
        )}

        <div className="h-4" />
      </div>
    </main>
  );
};
