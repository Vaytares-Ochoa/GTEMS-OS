import { useEffect, useState } from 'react';
import { Power } from 'lucide-react';
import { apiFetch, setAuthToken } from './lib/apiClient';
import { DEFAULT_PERSONALIZATION, GTEMS_IDENTITY } from './lib/gtemsIdentity';
import { applyThemeAndPreferencesToDom } from './lib/themes';
import { applyLanguageToDom } from './lib/i18n';
import type { DesktopPersonalization, SystemNotification, SystemStateSummary, UserProfile } from './lib/types';
import { InstallerWizard } from './components/InstallerWizard';
import { LockScreen } from './components/LockScreen';
import { DesktopShell } from './components/DesktopShell';
import { GtemsLogo } from './components/icons/GtemsIcons';

type BootPhase = 'booting' | 'installer' | 'locked' | 'desktop' | 'powered-off';

interface BootStatusResp {
  installed: boolean;
  hasUsers: boolean;
  hasAdminPasscodeEnv: boolean;
  personalization: DesktopPersonalization;
  notifications: SystemNotification[];
  language?: string;
  timezone?: string;
}

export default function App() {
  const [phase, setPhase] = useState<BootPhase>('booting');
  const [bootInfo, setBootInfo] = useState<BootStatusResp | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [systemState, setSystemState] = useState<SystemStateSummary | null>(null);

  const activePersonalization = systemState?.personalization || bootInfo?.personalization || DEFAULT_PERSONALIZATION;
  const activeLanguage = systemState?.language || bootInfo?.language || 'es-HN';
  const activeTimezone = systemState?.timezone || bootInfo?.timezone || 'America/Tegucigalpa';

  useEffect(() => {
    applyThemeAndPreferencesToDom(activePersonalization);
  }, [activePersonalization]);

  useEffect(() => {
    applyLanguageToDom(activeLanguage);
  }, [activeLanguage]);

  const loadBootStatus = async () => {
    const status = await apiFetch<BootStatusResp>('/api/system/boot-status');
    setBootInfo(status);

    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      const live = await apiFetch<{ token: string; user: UserProfile }>('/api/auth/live-session', {
        method: 'POST',
      });
      setAuthToken(live.token);
      setCurrentUser(live.user);
      const fullState = await apiFetch<SystemStateSummary>('/api/system/state');
      setSystemState(fullState);
      setPhase('desktop');
      return;
    }

    if (status.installed || status.hasUsers || status.hasAdminPasscodeEnv) {
      setPhase('locked');
    } else {
      setPhase('installer');
    }
  };

  useEffect(() => {
    void loadBootStatus();
  }, []);

  const enterDesktopWithAuth = async (user: UserProfile) => {
    setCurrentUser(user);
    const fullState = await apiFetch<SystemStateSummary>('/api/system/state');
    setSystemState(fullState);
    setPhase('desktop');
  };

  const enterLiveDesktop = async () => {
    const fullState = await apiFetch<SystemStateSummary>('/api/system/state');
    setCurrentUser({
      id: 'live-session',
      username: 'gtems-live',
      displayName: 'Sesión Live GTEMS OS',
      role: 'admin',
      createdAt: new Date().toISOString(),
    });
    setSystemState(fullState);
    setPhase('desktop');
  };

  if (phase === 'booting') {
    return (
      <main className="w-full h-full bg-[#0B161E] text-[#F5FCFA] flex flex-col items-center justify-center gap-4">
        <GtemsLogo className="w-16 h-16" />
        <div className="font-display text-xl font-bold">{GTEMS_IDENTITY.name}</div>
        <div className="text-xs text-[#79D9CE]">Inicializando kernel y servicios del sistema...</div>
      </main>
    );
  }

  if (phase === 'powered-off') {
    return (
      <main
        data-testid="powered-off-screen"
        className="w-full h-full bg-[#070E14] text-[#F5FCFA] flex flex-col items-center justify-center gap-5 p-6"
      >
        <GtemsLogo className="w-14 h-14 opacity-80" />
        <div className="text-center space-y-1">
          <h1 className="font-display text-lg font-semibold">{GTEMS_IDENTITY.name} apagado</h1>
          <p className="text-xs text-slate-400">
            El estado del sistema y las cuentas se conservan en almacenamiento persistente.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadBootStatus()}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#398F91] hover:bg-[#2d7678] text-white text-sm font-semibold"
        >
          <Power className="w-4 h-4" />
          <span>Encender equipo</span>
        </button>
      </main>
    );
  }

  if (phase === 'installer') {
    return (
      <InstallerWizard
        onInstalled={(user) => void enterDesktopWithAuth(user)}
        onTryLive={() => void enterLiveDesktop()}
      />
    );
  }

  if (phase === 'locked') {
    return (
      <LockScreen
        wallpaper={activePersonalization.lockWallpaper || DEFAULT_PERSONALIZATION.lockWallpaper}
        wallpaperFit={activePersonalization.lockWallpaperFit || 'cover'}
        language={activeLanguage}
        timezone={activeTimezone}
        notifications={systemState?.notifications || bootInfo?.notifications || []}
        onUnlock={(user) => void enterDesktopWithAuth(user)}
      />
    );
  }

  if (phase === 'desktop' && currentUser && systemState) {
    return (
      <DesktopShell
        currentUser={currentUser}
        systemState={systemState}
        onSystemStateChange={setSystemState}
        onLock={() => {
          setAuthToken(null);
          setPhase('locked');
        }}
        onLogout={() => {
          setAuthToken(null);
          setCurrentUser(null);
          setPhase(systemState.installed ? 'locked' : 'installer');
        }}
        onPowerOff={() => {
          setAuthToken(null);
          setCurrentUser(null);
          setPhase('powered-off');
        }}
        onReboot={() => {
          setAuthToken(null);
          setCurrentUser(null);
          void loadBootStatus();
        }}
        onReinstall={() => {
          setAuthToken(null);
          setCurrentUser(null);
          setSystemState(null);
          setPhase('installer');
        }}
      />
    );
  }

  return null;
}
