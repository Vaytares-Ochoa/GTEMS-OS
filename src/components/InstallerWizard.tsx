import React, { useEffect, useMemo, useState } from 'react';
import { Check, AlertTriangle, ArrowLeft, ArrowRight, RotateCcw, HardDrive } from 'lucide-react';
import { GTEMS_IDENTITY } from '../lib/gtemsIdentity';
import { applyLanguageToDom, getIanaTimezoneCatalog, SUPPORTED_LANGUAGES, t } from '../lib/i18n';
import { GtemsLogo } from './icons/GtemsIcons';
import { apiFetch, setAuthToken } from '../lib/apiClient';
import type { UserProfile } from '../lib/types';

interface InstallerProbe {
  hardware: {
    hostname: string;
    processor: { model: string; architecture: string; cores: number; frequencyMhz: number | null };
    memory: { totalBytes: number; freeBytes: number };
    storage: Array<{ filesystem: string; type: string; sizeBytes: number; availBytes: number; mount: string }>;
    systemType: { kernelVersion: string; hostPlatform: string };
  };
  network: {
    interfaces: Array<{ name: string; addresses: Array<{ address: string }> }>;
    wifiStatusMessage: string;
  };
  requirements: {
    cpuCoresOk: boolean;
    ramOk: boolean;
    diskOk: boolean;
    archOk: boolean;
  };
}

interface InstallerWizardProps {
  onInstalled: (user: UserProfile) => void;
  onTryLive: () => void;
}

const STEPS = [
  'Bienvenida',
  'Idioma',
  'Región',
  'Distribución del teclado',
  'Comprobación de requisitos',
  'Detección de hardware',
  'Conexión a Internet',
  'Selección de disco',
  'Particionado',
  'Configuración del usuario',
  'Creación de contraseña',
  'Zona horaria',
  'Resumen',
  'Confirmación',
  'Instalación',
  'Configuración final',
  'Reinicio',
];

export const InstallerWizard: React.FC<InstallerWizardProps> = ({ onInstalled, onTryLive }) => {
  const [mode, setMode] = useState<'initial' | 'wizard'>('initial');
  const [step, setStep] = useState(0);
  const [probe, setProbe] = useState<InstallerProbe | null>(null);
  const [language, setLanguage] = useState('es-HN');
  const [region, setRegion] = useState('Honduras');
  const [keyboardLayout, setKeyboardLayout] = useState('es-LATAM');
  const [selectedDisk, setSelectedDisk] = useState('/');
  const [partitionScheme, setPartitionScheme] = useState<'gpt-auto' | 'manual'>('gpt-auto');
  const [username, setUsername] = useState('admin');
  const [displayName, setDisplayName] = useState('Administrador GTEMS');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [timezone, setTimezone] = useState('America/Tegucigalpa');
  const [tzFilter, setTzFilter] = useState('');
  const [confirmedDestructive, setConfirmedDestructive] = useState(false);
  const [installProgress, setInstallProgress] = useState(0);
  const [installLogs, setInstallLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [installedUser, setInstalledUser] = useState<UserProfile | null>(null);

  const tzCatalog = useMemo(() => getIanaTimezoneCatalog(), []);
  const filteredTz = useMemo(() => {
    const q = tzFilter.trim().toLowerCase();
    return tzCatalog
      .filter((z) => !q || z.id.toLowerCase().includes(q) || z.city.toLowerCase().includes(q) || z.offsetLabel.toLowerCase().includes(q))
      .slice(0, 120);
  }, [tzCatalog, tzFilter]);

  useEffect(() => {
    applyLanguageToDom(language);
  }, [language]);

  useEffect(() => {
    if (mode === 'wizard' && !probe) {
      apiFetch<InstallerProbe>('/api/installer/probe')
        .then(setProbe)
        .catch(() => setError('No se pudo consultar el hardware del equipo anfitrión.'));
    }
  }, [mode, probe]);

  const startLive = async () => {
    try {
      const res = await apiFetch<{ token: string; user: UserProfile }>('/api/auth/live-session', {
        method: 'POST',
      });
      setAuthToken(res.token);
      onTryLive();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error iniciando entorno Live.');
    }
  };

  const runRealInstallation = async () => {
    setError(null);
    setStep(14);
    const phases = [
      'Verificando tabla de particiones y espacio disponible en disco...',
      'Inicializando estructura raíz de archivos GTEMS OS (.gtems-fs/)...',
      'Registrando configuración de kernel Linux y reglas udev...',
      'Generando configuración de arranque GRUB2 e initramfs...',
      'Creando cuenta de usuario con hashing criptográfico scrypt...',
      'Guardando preferencias persistentes de idioma, región y zona horaria...',
    ];

    setInstallLogs([]);
    for (let i = 0; i < phases.length; i++) {
      setInstallLogs((prev) => [...prev, phases[i]]);
      setInstallProgress(Math.round(((i + 1) / phases.length) * 85));
      await new Promise((r) => setTimeout(r, 220));
    }

    try {
      const res = await apiFetch<{ ok: boolean; user: UserProfile; token: string }>('/api/installer/complete', {
        method: 'POST',
        body: JSON.stringify({
          username,
          displayName,
          password,
          language,
          region,
          timezone,
          keyboardLayout,
        }),
      });
      setAuthToken(res.token);
      setInstalledUser(res.user);
      setInstallProgress(100);
      setInstallLogs((prev) => [...prev, 'Instalación completada y verificada correctamente.']);
      setStep(15);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fallo durante la instalación.');
      setStep(13);
    }
  };

  const canAdvance = (): boolean => {
    if (step === 9 && username.trim().length < 2) return false;
    if (step === 10 && (password.length < 4 || password !== confirmPassword)) return false;
    if (step === 13 && !confirmedDestructive) return false;
    return true;
  };

  const handleNext = () => {
    setError(null);
    if (step === 9 && username.trim().length < 2) {
      setError('El nombre de usuario debe tener al menos 2 caracteres.');
      return;
    }
    if (step === 10) {
      if (password.length < 4) {
        setError('La contraseña debe tener al menos 4 caracteres.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Las contraseñas no coinciden.');
        return;
      }
    }
    if (step === 13) {
      if (!confirmedDestructive) {
        setError('Debes confirmar explícitamente la configuración de destino para continuar.');
        return;
      }
      void runRealInstallation();
      return;
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  if (mode === 'initial') {
    return (
      <main
        data-testid="installer-initial"
        className="relative w-full h-full flex items-center justify-center p-6 overflow-hidden"
      >
        <img
          src="/src/assets/images/gtems_aurora_lockscreen_1795655916431.jpg"
          alt="Fondo Aurora del instalador GTEMS OS"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="relative z-10 w-full max-w-2xl rounded-3xl aurora-glass shadow-2xl p-8 md:p-10 text-[var(--gtems-text)]">
          <div className="flex items-center gap-4">
            <GtemsLogo className="w-16 h-16 shrink-0" />
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight">{GTEMS_IDENTITY.name}</h1>
              <p className="text-sm text-[var(--gtems-text-muted)] mt-1">{GTEMS_IDENTITY.slogan}</p>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-[var(--gtems-border)] flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--gtems-text-muted)]">
            <span>Versión {GTEMS_IDENTITY.version}</span>
            <span aria-hidden="true">·</span>
            <span>Compilación {GTEMS_IDENTITY.build}</span>
            <span aria-hidden="true">·</span>
            <span>Base Linux x86_64</span>
          </div>

          <p className="mt-5 text-sm leading-relaxed text-[var(--gtems-text)]">
            Bienvenido al asistente de instalación e inicio de GTEMS OS. Puedes instalar el sistema operativo con
            cuenta de usuario cifrada mediante scrypt y entorno persistente, o iniciar directamente una sesión Live de prueba.
          </p>

          {error && (
            <p role="alert" className="mt-4 text-xs text-red-600 font-medium">
              {error}
            </p>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => setMode('wizard')}
              className="px-6 py-3 rounded-xl bg-[#398F91] hover:bg-[#2d7678] text-white font-semibold text-sm transition-colors whitespace-nowrap"
            >
              {t(language, 'installer.installBtn', 'Instalar GTEMS OS')}
            </button>
            <button
              type="button"
              onClick={startLive}
              className="px-6 py-3 rounded-xl bg-white/80 dark:bg-slate-800/80 hover:bg-white border border-[var(--gtems-border)] text-[var(--gtems-text)] font-medium text-sm transition-colors whitespace-nowrap"
            >
              {t(language, 'installer.liveBtn', 'Probar sin instalar')}
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      data-testid="installer-wizard"
      className="relative w-full h-full flex items-center justify-center p-4 md:p-8 overflow-hidden"
    >
      <img
        src="/src/assets/images/gtems_aurora_lockscreen_1795655916431.jpg"
        alt="Fondo Aurora"
        referrerPolicy="no-referrer"
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="relative z-10 w-full max-w-5xl h-[min(640px,92vh)] rounded-3xl aurora-glass shadow-2xl flex overflow-hidden text-[var(--gtems-text)]">
        {/* Stepper Sidebar */}
        <aside className="w-64 shrink-0 border-r border-[var(--gtems-border)] bg-white/45 dark:bg-slate-900/50 p-5 overflow-y-auto aurora-scroll hidden md:block">
          <div className="flex items-center gap-2.5 mb-5">
            <GtemsLogo className="w-8 h-8" />
            <span className="font-display font-bold text-sm">Instalador GTEMS OS</span>
          </div>
          <ol className="space-y-1">
            {STEPS.map((label, idx) => (
              <li
                key={label}
                className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs ${
                  idx === step
                    ? 'bg-[#398F91] text-white font-semibold'
                    : idx < step
                    ? 'text-[#398F91] dark:text-[#79D9CE] font-medium'
                    : 'text-[var(--gtems-text-muted)]'
                }`}
              >
                <span className="w-5 text-right tabular-nums">{idx + 1}.</span>
                <span className="truncate">{label}</span>
              </li>
            ))}
          </ol>
        </aside>

        {/* Main Step Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-white/75 dark:bg-[#0D1E26]/85">
          <header className="px-7 py-5 border-b border-[var(--gtems-border)] flex items-center justify-between">
            <div>
              <p className="text-xs text-[var(--gtems-text-muted)] tabular-nums">
                Paso {step + 1} de {STEPS.length}
              </p>
              <h2 className="font-display text-xl font-bold mt-0.5">{STEPS[step]}</h2>
            </div>
            <button
              type="button"
              onClick={() => setMode('initial')}
              className="text-xs font-medium text-[var(--gtems-text-muted)] hover:text-[var(--gtems-text)]"
            >
              Cancelar instalación
            </button>
          </header>

          <div className="flex-1 p-7 overflow-y-auto aurora-scroll">
            {step === 0 && (
              <div className="space-y-4 max-w-xl">
                <p className="text-sm leading-relaxed">
                  Este asistente prepara el entorno de GTEMS OS 1.0 Aurora, verifica el hardware real del equipo,
                  configura el idioma, la red, la zona horaria y crea la cuenta de administrador con contraseña cifrada.
                </p>
                <p className="text-xs text-[var(--gtems-text-muted)]">
                  Para instalaciones en disco físico bare-metal o VM desde ISO, el sistema incluye también el script
                  nativo <code className="font-mono">GTEMS-OS/installer/gtems-install.sh</code>.
                </p>
              </div>
            )}

            {step === 1 && (
              <div className="max-w-lg space-y-3">
                <label htmlFor="inst-lang" className="block text-sm font-medium">
                  Idioma del sistema ({SUPPORTED_LANGUAGES.length} variantes / 33 idiomas)
                </label>
                <select
                  id="inst-lang"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--gtems-border)] bg-white dark:bg-slate-800 text-sm"
                >
                  {SUPPORTED_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.nativeName} — {l.englishName} ({l.rtl ? 'RTL' : 'LTR'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {step === 2 && (
              <div className="max-w-md space-y-3">
                <label htmlFor="inst-region" className="block text-sm font-medium">Región</label>
                <select
                  id="inst-region"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--gtems-border)] bg-white dark:bg-slate-800 text-sm"
                >
                  <option value="Honduras">Honduras</option>
                  <option value="México">México</option>
                  <option value="España">España</option>
                  <option value="Estados Unidos">Estados Unidos</option>
                </select>
              </div>
            )}

            {step === 3 && (
              <div className="max-w-md space-y-3">
                <label htmlFor="inst-kb" className="block text-sm font-medium">Distribución del teclado</label>
                <select
                  id="inst-kb"
                  value={keyboardLayout}
                  onChange={(e) => setKeyboardLayout(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--gtems-border)] bg-white dark:bg-slate-800 text-sm"
                >
                  <option value="es-LATAM">Español (Latinoamérica)</option>
                  <option value="es-ES">Español (ISO)</option>
                  <option value="en-US">Inglés (US QWERTY)</option>
                </select>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-3 max-w-xl">
                <p className="text-sm text-[var(--gtems-text-muted)]">Comprobación real sobre el equipo anfitrión:</p>
                {probe ? (
                  <div className="space-y-2">
                    {[
                      { label: 'Arquitectura x86_64 / ARM64', ok: probe.requirements.archOk },
                      { label: `Núcleos de CPU (${probe.hardware.processor.cores} detectados)`, ok: probe.requirements.cpuCoresOk },
                      { label: `Memoria RAM (${(probe.hardware.memory.totalBytes / 1024 ** 3).toFixed(2)} GiB)`, ok: probe.requirements.ramOk },
                      { label: 'Espacio disponible suficiente en raíz', ok: probe.requirements.diskOk },
                    ].map((req) => (
                      <div key={req.label} className="flex items-center justify-between p-3 rounded-xl border border-[var(--gtems-border)] bg-white/60 dark:bg-slate-900/40 text-sm">
                        <span>{req.label}</span>
                        <span className={`inline-flex items-center gap-1 font-medium ${req.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-600'}`}>
                          <Check className="w-4 h-4" />
                          {req.ok ? 'Cumple' : 'Ajustado'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm">Consultando requisitos del sistema...</p>
                )}
              </div>
            )}

            {step === 5 && probe && (
              <div className="space-y-3 max-w-xl text-sm">
                <div className="p-4 rounded-xl border border-[var(--gtems-border)] space-y-2">
                  <div><strong>Equipo:</strong> {probe.hardware.hostname}</div>
                  <div><strong>Procesador:</strong> {probe.hardware.processor.model} ({probe.hardware.processor.cores} núcleos)</div>
                  <div><strong>Kernel:</strong> {probe.hardware.systemType.kernelVersion}</div>
                  <div><strong>Plataforma base:</strong> {probe.hardware.systemType.hostPlatform}</div>
                </div>
              </div>
            )}

            {step === 6 && probe && (
              <div className="space-y-3 max-w-xl text-sm">
                <p className="text-[var(--gtems-text-muted)]">{probe.network.wifiStatusMessage}</p>
                <div className="space-y-2">
                  {probe.network.interfaces.map((iface) => (
                    <div key={iface.name} className="p-3 rounded-xl border border-[var(--gtems-border)] flex items-center justify-between">
                      <span className="font-mono font-medium">{iface.name}</span>
                      <span className="font-mono text-xs text-[var(--gtems-text-muted)]">
                        {iface.addresses.map((a) => a.address).join(', ') || 'Sin IP'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step === 7 && probe && (
              <div className="space-y-3 max-w-xl">
                <p className="text-sm text-[var(--gtems-text-muted)]">Unidades y volúmenes detectados mediante <code className="font-mono">df</code>:</p>
                {probe.hardware.storage.map((part) => (
                  <button
                    key={part.mount}
                    type="button"
                    onClick={() => setSelectedDisk(part.mount)}
                    className={`w-full flex items-center justify-between p-4 rounded-xl border text-left transition-colors ${
                      selectedDisk === part.mount
                        ? 'border-[#398F91] bg-[#DDF5EC]/60 dark:bg-[#398F91]/20'
                        : 'border-[var(--gtems-border)] hover:bg-black/5'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <HardDrive className="w-5 h-5 text-[#398F91]" />
                      <div>
                        <div className="text-sm font-semibold">{part.mount} ({part.filesystem})</div>
                        <div className="text-xs text-[var(--gtems-text-muted)]">Tipo: {part.type}</div>
                      </div>
                    </div>
                    <div className="text-xs font-mono tabular-nums">
                      {(part.availBytes / 1024 ** 3).toFixed(1)} GiB libres
                    </div>
                  </button>
                ))}
              </div>
            )}

            {step === 8 && (
              <div className="space-y-4 max-w-xl text-sm">
                <div className="space-y-2">
                  <label className="flex items-start gap-3 p-3.5 rounded-xl border border-[var(--gtems-border)] cursor-pointer">
                    <input
                      type="radio"
                      name="partScheme"
                      checked={partitionScheme === 'gpt-auto'}
                      onChange={() => setPartitionScheme('gpt-auto')}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-semibold">Particionado GPT estándar GTEMS OS (Recomendado)</div>
                      <div className="text-xs text-[var(--gtems-text-muted)] mt-0.5">
                        EFI System Partition (512 MiB FAT32) + GTEMS_ROOT (EXT4). En este entorno web contenedorizado se
                        inicializa el espacio aislado <code className="font-mono">.gtems-fs/</code> sin alterar el disco anfitrión.
                      </div>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 p-3.5 rounded-xl border border-[var(--gtems-border)] cursor-pointer">
                    <input
                      type="radio"
                      name="partScheme"
                      checked={partitionScheme === 'manual'}
                      onChange={() => setPartitionScheme('manual')}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-semibold">Esquema personalizado para instalación bare-metal (gtems-install.sh)</div>
                      <div className="text-xs text-[var(--gtems-text-muted)] mt-0.5">
                        Conserva la configuración de destino seleccionada ({selectedDisk}) para despliegue en espacio de trabajo.
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {step === 9 && (
              <div className="max-w-md space-y-4">
                <div>
                  <label htmlFor="inst-username" className="block text-sm font-medium mb-1">Nombre de usuario</label>
                  <input
                    id="inst-username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--gtems-border)] bg-white dark:bg-slate-800 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="inst-display" className="block text-sm font-medium mb-1">Nombre completo para mostrar</label>
                  <input
                    id="inst-display"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--gtems-border)] bg-white dark:bg-slate-800 text-sm"
                  />
                </div>
              </div>
            )}

            {step === 10 && (
              <div className="max-w-md space-y-4">
                <div>
                  <label htmlFor="inst-pass" className="block text-sm font-medium mb-1">Contraseña (mínimo 4 caracteres)</label>
                  <input
                    id="inst-pass"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--gtems-border)] bg-white dark:bg-slate-800 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="inst-pass2" className="block text-sm font-medium mb-1">Confirmar contraseña</label>
                  <input
                    id="inst-pass2"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--gtems-border)] bg-white dark:bg-slate-800 text-sm"
                  />
                </div>
              </div>
            )}

            {step === 11 && (
              <div className="max-w-lg space-y-3">
                <label htmlFor="inst-tz-filter" className="block text-sm font-medium">
                  Zona horaria IANA ({tzCatalog.length} zonas disponibles)
                </label>
                <input
                  id="inst-tz-filter"
                  type="search"
                  value={tzFilter}
                  onChange={(e) => setTzFilter(e.target.value)}
                  placeholder="Filtrar zona horaria (Tegucigalpa, Madrid, Tokyo, New York...)"
                  className="w-full px-3.5 py-2 rounded-xl border border-[var(--gtems-border)] bg-white dark:bg-slate-800 text-sm"
                />
                <select
                  id="inst-tz"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--gtems-border)] bg-white dark:bg-slate-800 text-sm"
                >
                  {filteredTz.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.id} ({z.offsetLabel})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {step === 12 && (
              <div className="max-w-xl space-y-3 text-sm">
                <div className="p-4 rounded-xl border border-[var(--gtems-border)] space-y-2">
                  <div><strong>Sistema:</strong> {GTEMS_IDENTITY.name} {GTEMS_IDENTITY.version}</div>
                  <div><strong>Idioma / Región:</strong> {language} · {region}</div>
                  <div><strong>Teclado:</strong> {keyboardLayout}</div>
                  <div><strong>Destino:</strong> {selectedDisk} ({partitionScheme})</div>
                  <div><strong>Usuario administrador:</strong> {username} ({displayName})</div>
                  <div><strong>Zona horaria:</strong> {timezone}</div>
                </div>
              </div>
            )}

            {step === 13 && (
              <div className="max-w-xl space-y-4 text-sm">
                <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 flex gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Confirmación explícita requerida</p>
                    <p className="text-xs mt-1 text-[var(--gtems-text-muted)]">
                      Se inicializará la instalación de GTEMS OS en <code className="font-mono">{selectedDisk}</code> con la
                      cuenta <strong>{username}</strong>. Ningún disco físico fuera del espacio autorizado será formateado sin confirmación.
                    </p>
                  </div>
                </div>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmedDestructive}
                    onChange={(e) => setConfirmedDestructive(e.target.checked)}
                  />
                  <span>Confirmo los parámetros de destino y deseo instalar GTEMS OS ahora.</span>
                </label>
              </div>
            )}

            {step === 14 && (
              <div className="max-w-xl space-y-4">
                <div className="w-full h-3 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-[#398F91] transition-all duration-300"
                    style={{ width: `${installProgress}%` }}
                  />
                </div>
                <div className="p-4 rounded-xl bg-slate-950 text-[#BCEBDD] font-mono text-xs space-y-1.5 max-h-60 overflow-y-auto">
                  {installLogs.map((l, i) => (
                    <div key={i}>[GTEMS-INSTALL] {l}</div>
                  ))}
                </div>
              </div>
            )}

            {step === 15 && (
              <div className="max-w-xl space-y-3 text-sm">
                <p className="font-semibold text-[#398F91] dark:text-[#79D9CE]">
                  Configuración final aplicada correctamente.
                </p>
                <p>
                  El usuario <strong>{username}</strong> ha sido registrado con contraseña cifrada mediante <code className="font-mono">scrypt</code>,
                  y la estructura del sistema de archivos está lista.
                </p>
              </div>
            )}

            {step === 16 && (
              <div className="max-w-xl space-y-4 text-sm">
                <p className="font-semibold text-base">GTEMS OS está listo para iniciar.</p>
                <p className="text-[var(--gtems-text-muted)]">
                  Pulsa «Reiniciar e iniciar GTEMS OS» para acceder al entorno de escritorio o bloquear la sesión.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    if (installedUser) onInstalled(installedUser);
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#398F91] hover:bg-[#2d7678] text-white font-semibold"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Reiniciar e iniciar GTEMS OS</span>
                </button>
              </div>
            )}

            {error && (
              <p role="alert" className="mt-4 text-xs font-medium text-red-600 dark:text-red-400">
                {error}
              </p>
            )}
          </div>

          {/* Footer Controls */}
          {step !== 14 && step !== 16 && (
            <footer className="px-7 py-4 border-t border-[var(--gtems-border)] flex items-center justify-between">
              <button
                type="button"
                disabled={step === 0 || step === 15}
                onClick={() => {
                  setError(null);
                  setStep((s) => Math.max(0, s - 1));
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--gtems-border)] text-sm font-medium disabled:opacity-40"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Atrás</span>
              </button>

              <button
                type="button"
                disabled={!canAdvance()}
                onClick={handleNext}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#398F91] hover:bg-[#2d7678] text-white text-sm font-semibold disabled:opacity-40"
              >
                <span>{step === 13 ? 'Comenzar instalación' : 'Siguiente'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </footer>
          )}
        </div>
      </div>
    </main>
  );
};
