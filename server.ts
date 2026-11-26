import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer as createViteServer } from 'vite';
import {
  appendAuditLog,
  buildPublicStateSummary,
  createSessionToken,
  hashPassword,
  loadState,
  sanitizePublicUsers,
  saveState,
  verifyPassword,
  verifySessionToken,
} from './server/stateStore';
import {
  compressToZip,
  ensureFilesystemReady,
  extractZip,
  FS_ROOT,
  listDirectory,
  moveToTrash,
  permanentDelete,
  resolveSafePath,
  restoreFromTrash,
  saveWallpaperBase64,
  searchFilesWithContent,
} from './server/fsService';
import {
  executeCodeRun,
  executeRealBashCommand,
  getBrowserRegistry,
  getChromeAvailability,
  getCodeRuntimes,
  getInstalledDebianPackages,
  getRealDevices,
  getRealHardwareSpecs,
  getRealNetworkStatus,
  getRealProcesses,
  runNetworkDiagnostic,
  stopCodeRun,
  validatePublicHttpUrl,
} from './server/systemInspectors';
import {
  DEFAULT_ISO_DIR,
  getPublishedIsoMetadata,
  resolveIsoFilePath,
} from './server/isoService';
import {
  APP_CATALOG,
  DEFAULT_PERSONALIZATION,
  SETTINGS_CATEGORIES,
  resolveFileExtension,
} from './src/lib/gtemsIdentity';
import { appendTerminalHistory } from './src/lib/terminalHistoryLogic';
import type { AppId, DownloadItem, SearchResultItem } from './src/lib/types';

const execFileAsync = promisify(execFile);

const app = express();
app.use(express.json({ limit: '20mb' }));

ensureFilesystemReady();

interface AuthReq extends express.Request {
  authUser?: { sub: string; username: string; role: 'admin' | 'standard' };
}

function requireAuth(req: AuthReq, res: express.Response, next: express.NextFunction) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const verified = token ? verifySessionToken(token) : null;
  if (!verified) {
    res.status(401).json({ error: 'Sesión no autenticada o expirada.' });
    return;
  }
  req.authUser = verified;
  next();
}

// Active streaming downloads map
const activeDownloadControllers = new Map<string, { controller: AbortController; mode: 'pause' | 'cancel' | null }>();

async function streamDownloadToDisk(downloadId: string, parsedUrl: URL, absPath: string, resumeFromByte = 0) {
  const controller = new AbortController();
  activeDownloadControllers.set(downloadId, { controller, mode: null });

  const updateItem = (patch: Partial<DownloadItem>) => {
    const state = loadState();
    state.downloads = state.downloads.map((d) => (d.id === downloadId ? { ...d, ...patch } : d));
    saveState(state);
  };

  try {
    const headers: Record<string, string> = {
      'User-Agent': 'GTEMS-OS-Downloader/1.0',
    };
    if (resumeFromByte > 0) {
      headers['Range'] = `bytes=${resumeFromByte}-`;
    }

    const response = await fetch(parsedUrl.toString(), {
      headers,
      signal: controller.signal,
    });

    if (!response.ok && response.status !== 206) {
      throw new Error(`Servidor remoto devolvió HTTP ${response.status}`);
    }

    const acceptRanges = (response.headers.get('accept-ranges') || '').toLowerCase() === 'bytes' || response.status === 206;
    const contentLenHeader = Number(response.headers.get('content-length') || '0');
    const totalBytes = response.status === 206 ? resumeFromByte + contentLenHeader : contentLenHeader;

    const flags = response.status === 206 && resumeFromByte > 0 ? 'a' : 'w';
    const baseBytes = response.status === 206 ? resumeFromByte : 0;
    const stream = fs.createWriteStream(absPath, { flags });

    let received = baseBytes;
    const startedAtMs = Date.now();
    let lastUpdateMs = 0;

    updateItem({
      status: 'downloading',
      totalBytes,
      receivedBytes: received,
      supportsRange: acceptRanges,
      error: undefined,
    });

    const reader = response.body?.getReader();
    if (!reader) {
      const buf = Buffer.from(await response.arrayBuffer());
      stream.write(buf);
      stream.end();
      received += buf.length;
    } else {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          stream.write(Buffer.from(value));
          received += value.byteLength;
          const nowMs = Date.now();
          if (nowMs - lastUpdateMs > 250) {
            const elapsedSec = Math.max(0.1, (nowMs - startedAtMs) / 1000);
            const speedBps = Math.round((received - baseBytes) / elapsedSec);
            const etaSeconds =
              totalBytes > 0 && speedBps > 0 ? Math.max(1, Math.round((totalBytes - received) / speedBps)) : null;
            updateItem({
              receivedBytes: received,
              totalBytes: totalBytes || received,
              speedBps,
              etaSeconds,
            });
            lastUpdateMs = nowMs;
          }
        }
      }
      await new Promise<void>((resWrite) => stream.end(() => resWrite()));
    }

    const fileBuf = fs.readFileSync(absPath);
    const sha256 = crypto.createHash('sha256').update(fileBuf).digest('hex');
    const elapsedTotal = Math.max(0.1, (Date.now() - startedAtMs) / 1000);
    const finalSpeed = Math.round((fileBuf.length - baseBytes) / elapsedTotal);

    const state = loadState();
    const target = state.downloads.find((d) => d.id === downloadId);
    state.downloads = state.downloads.map((d) =>
      d.id === downloadId
        ? {
            ...d,
            status: 'completed',
            totalBytes: fileBuf.length,
            receivedBytes: fileBuf.length,
            speedBps: Math.max(0, finalSpeed),
            etaSeconds: 0,
            supportsRange: acceptRanges,
            sha256,
          }
        : d
    );
    state.notifications.unshift({
      id: `notif-${Date.now()}`,
      title: 'Descarga completada',
      body: `${target?.filename || 'Archivo'} guardado en Descargas (${(fileBuf.length / 1024).toFixed(1)} KB).`,
      category: 'download',
      timestamp: new Date().toISOString(),
      read: false,
    });
    saveState(state);
  } catch (err) {
    const ctrlInfo = activeDownloadControllers.get(downloadId);
    if (ctrlInfo?.mode === 'pause') {
      updateItem({ status: 'paused', speedBps: 0, etaSeconds: null });
    } else if (ctrlInfo?.mode === 'cancel') {
      updateItem({ status: 'cancelled', speedBps: 0, etaSeconds: null });
      try {
        if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
      } catch {
        // ignore
      }
    } else {
      updateItem({
        status: 'error',
        speedBps: 0,
        etaSeconds: null,
        error: err instanceof Error ? err.message : 'Error de red durante la descarga',
      });
    }
  } finally {
    activeDownloadControllers.delete(downloadId);
  }
}

// Public boot / installation status
app.get('/api/system/boot-status', (_req, res) => {
  const state = loadState();
  const hasAdminPasscodeEnv = Boolean(process.env.GTEMS_ADMIN_PASSCODE && process.env.GTEMS_ADMIN_PASSCODE.trim());
  res.json({
    installed: state.installed,
    hasUsers: state.users.length > 0,
    hasAdminPasscodeEnv,
    personalization: state.personalization,
    notifications: state.notifications,
    language: state.language,
    timezone: state.timezone,
    productId: state.productId,
    deviceId: state.deviceId,
    installDate: state.installDate,
  });
});

// Installer requirements & real host probe
app.get('/api/installer/probe', async (_req, res) => {
  const hardware = await getRealHardwareSpecs();
  const network = await getRealNetworkStatus();
  const totalRamGb = hardware.memory.totalBytes / 1024 ** 3;
  const rootPart = hardware.storage.find((s) => s.mount === '/') || hardware.storage[0];
  const freeDiskGb = rootPart ? rootPart.availBytes / 1024 ** 3 : 0;

  res.json({
    hardware,
    network,
    requirements: {
      cpuCoresOk: hardware.processor.cores >= 1,
      ramOk: totalRamGb >= 1.5,
      diskOk: freeDiskGb >= 5,
      archOk: hardware.systemType.arch === 'x64' || hardware.systemType.arch === 'arm64',
    },
  });
});

// Complete installation
app.post('/api/installer/complete', (req, res) => {
  const { username, displayName, password, language, region, timezone, keyboardLayout } = req.body || {};
  if (!username || typeof username !== 'string' || username.trim().length < 2) {
    res.status(400).json({ error: 'El nombre de usuario debe tener al menos 2 caracteres.' });
    return;
  }
  if (!password || typeof password !== 'string' || password.length < 4) {
    res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres.' });
    return;
  }

  const state = loadState();
  const cleanUser = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (!cleanUser) {
    res.status(400).json({ error: 'Nombre de usuario inválido (usa letras o números).' });
    return;
  }

  const { hash, salt } = hashPassword(password);
  const newUser = {
    id: `usr-${crypto.randomBytes(4).toString('hex')}`,
    username: cleanUser,
    displayName: (displayName || username).trim(),
    role: 'admin' as const,
    createdAt: new Date().toISOString(),
    passwordHash: hash,
    salt,
  };

  state.installed = true;
  state.installDate = new Date().toISOString();
  state.users = [newUser];
  if (language) state.language = String(language);
  if (region) state.region = String(region);
  if (timezone) state.timezone = String(timezone);
  if (keyboardLayout) state.keyboardLayout = String(keyboardLayout);

  appendAuditLog(state, 'INFO', 'OS_INSTALLED', `GTEMS OS instalado por ${cleanUser}`);
  state.notifications.unshift({
    id: `notif-${Date.now()}`,
    title: 'Instalación completada',
    body: `GTEMS OS 1.0 Aurora instalado correctamente para ${cleanUser}.`,
    category: 'system',
    timestamp: new Date().toISOString(),
    read: false,
  });
  saveState(state);
  ensureFilesystemReady();

  const { passwordHash: _ph, salt: _s, ...pubUser } = newUser;
  const token = createSessionToken(pubUser);
  res.json({ ok: true, user: pubUser, token });
});

app.post('/api/auth/live-session', (_req, res) => {
  const liveUser = {
    id: 'live-session',
    username: 'gtems-live',
    displayName: 'Sesión Live GTEMS OS',
    role: 'admin' as const,
    createdAt: new Date().toISOString(),
  };
  const token = createSessionToken(liveUser);
  res.json({ token, user: liveUser });
});

app.post('/api/auth/login', (req, res) => {
  const { password, username } = req.body || {};
  if (!password || typeof password !== 'string') {
    res.status(400).json({ error: 'Introduce tu contraseña.' });
    return;
  }

  const state = loadState();
  const envPass = process.env.GTEMS_ADMIN_PASSCODE?.trim();

  if (state.users.length === 0 && envPass) {
    if (password === envPass) {
      const adminUser = {
        id: 'env-admin',
        username: 'admin',
        displayName: 'Administrador GTEMS',
        role: 'admin' as const,
        createdAt: new Date().toISOString(),
      };
      const token = createSessionToken(adminUser);
      res.json({ token, user: adminUser });
      return;
    }
    res.status(401).json({ error: 'Contraseña incorrecta.' });
    return;
  }

  const targetUser = username ? state.users.find((u) => u.username === username) : state.users[0];
  if (!targetUser) {
    res.status(401).json({ error: 'No hay cuentas configuradas. Ejecuta el instalador.' });
    return;
  }

  const validEnv = Boolean(envPass && password === envPass);
  const validHash = verifyPassword(password, targetUser.passwordHash, targetUser.salt);

  if (!validEnv && !validHash) {
    appendAuditLog(state, 'SEC', 'LOGIN_FAILED', `Intento fallido para ${targetUser.username}`);
    saveState(state);
    res.status(401).json({ error: 'Contraseña incorrecta. Verifica tus credenciales e inténtalo de nuevo.' });
    return;
  }

  appendAuditLog(state, 'INFO', 'LOGIN_SUCCESS', `Sesión iniciada por ${targetUser.username}`);
  saveState(state);

  const { passwordHash: _ph, salt: _s, ...pubUser } = targetUser;
  const token = createSessionToken(pubUser);
  res.json({ token, user: pubUser });
});

// Full authenticated system state
app.get('/api/system/state', requireAuth, (_req, res) => {
  const state = loadState();
  res.json(buildPublicStateSummary(state));
});

// Update personalization / settings persistently
app.patch('/api/system/settings', requireAuth, (req: AuthReq, res) => {
  const state = loadState();
  const body = req.body || {};

  if (body.personalization && typeof body.personalization === 'object') {
    state.personalization = {
      ...state.personalization,
      ...body.personalization,
      customTheme: {
        ...state.personalization.customTheme,
        ...(body.personalization.customTheme || {}),
      },
    };
  }
  if (typeof body.language === 'string') state.language = body.language;
  if (typeof body.timezone === 'string') state.timezone = body.timezone;
  if (typeof body.autoTimezone === 'boolean') state.autoTimezone = body.autoTimezone;
  if (typeof body.region === 'string') state.region = body.region;
  if (typeof body.keyboardLayout === 'string') state.keyboardLayout = body.keyboardLayout;
  if (typeof body.doNotDisturb === 'boolean') state.doNotDisturb = body.doNotDisturb;
  if (typeof body.volume === 'number') state.volume = Math.min(100, Math.max(0, body.volume));
  if (typeof body.muted === 'boolean') state.muted = body.muted;
  if (typeof body.brightness === 'number') state.brightness = Math.min(100, Math.max(20, body.brightness));
  if (body.powerMode) state.powerMode = body.powerMode;
  if (Array.isArray(body.pinnedApps)) state.pinnedApps = body.pinnedApps;
  if (Array.isArray(body.startupApps)) state.startupApps = body.startupApps;
  if (typeof body.defaultBrowser === 'string') state.defaultBrowser = body.defaultBrowser;

  saveState(state);
  res.json({ ok: true, state: buildPublicStateSummary(state) });
});

// Upload local wallpaper image into .gtems-fs/Imágenes/
app.post('/api/personalization/upload-wallpaper', requireAuth, (req, res) => {
  try {
    const { filename, base64 } = req.body || {};
    if (!base64 || typeof base64 !== 'string') {
      res.status(400).json({ error: 'Imagen no proporcionada.' });
      return;
    }
    const virtualPath = saveWallpaperBase64(String(filename || `fondo_${Date.now()}.png`), base64);
    const wallpaperUrl = `/api/personalization/active-wallpaper?path=${encodeURIComponent(virtualPath)}`;
    res.json({ ok: true, virtualPath, wallpaperUrl });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Error guardando imagen' });
  }
});

// Serve ONLY the currently configured desktop or lockscreen wallpaper (safe for LockScreen pre-auth)
app.get('/api/personalization/active-wallpaper', (req, res) => {
  try {
    const vp = String(req.query.path || '');
    const state = loadState();
    const expectedDesktop = `/api/personalization/active-wallpaper?path=${encodeURIComponent(vp)}`;
    const isActive =
      vp.startsWith('/Imágenes/') &&
      (state.personalization.wallpaper === expectedDesktop || state.personalization.lockWallpaper === expectedDesktop);
    if (!isActive) {
      res.status(404).send('Fondo no activo');
      return;
    }
    const { absPath } = resolveSafePath(vp);
    if (!fs.existsSync(absPath) || fs.statSync(absPath).isDirectory()) {
      res.status(404).send('Imagen no encontrada');
      return;
    }
    res.sendFile(absPath);
  } catch {
    res.status(400).send('Solicitud inválida');
  }
});

// System Recovery Backup & Media Check
app.get('/api/system/recovery-info', requireAuth, (_req, res) => {
  const installerScript = path.resolve(process.cwd(), 'GTEMS-OS/installer/gtems-install.sh');
  const grubCfg = path.resolve(process.cwd(), 'GTEMS-OS/boot/bootloader/grub.cfg');
  res.json({
    recoveryMediaValid: fs.existsSync(installerScript) && fs.existsSync(grubCfg),
    installerScriptExists: fs.existsSync(installerScript),
    grubCfgExists: fs.existsSync(grubCfg),
    installerScriptPath: 'GTEMS-OS/installer/gtems-install.sh',
  });
});

app.get('/api/system/backup', requireAuth, (_req, res) => {
  const state = loadState();
  res.setHeader('Content-Disposition', `attachment; filename="gtems-backup-${Date.now()}.json"`);
  res.json({
    exportedAt: new Date().toISOString(),
    os: 'GTEMS OS 1.0 Aurora',
    state: buildPublicStateSummary(state),
  });
});

// Published GTEMS OS ISO Metadata & Streaming Download (Read-only, confined, non-buffered)
app.get('/api/system/iso/latest', async (_req, res) => {
  try {
    const isoDir = process.env.GTEMS_ISO_DIR ? path.resolve(process.env.GTEMS_ISO_DIR) : DEFAULT_ISO_DIR;
    const meta = await getPublishedIsoMetadata(isoDir);
    res.json(meta);
  } catch (err) {
    res.status(500).json({
      available: false,
      status: 'unavailable',
      reason: err instanceof Error ? err.message : 'Error consultando el estado de la imagen ISO.',
    });
  }
});

app.get('/api/system/iso/download', async (req, res) => {
  try {
    const isoDir = process.env.GTEMS_ISO_DIR ? path.resolve(process.env.GTEMS_ISO_DIR) : DEFAULT_ISO_DIR;
    const meta = await getPublishedIsoMetadata(isoDir);
    if (!meta.available || !meta.filename) {
      res.status(404).json({
        error: meta.reason || 'No existe una imagen .iso válida publicada en el servidor.',
        status: meta.status,
      });
      return;
    }

    const requested = typeof req.query.file === 'string' && req.query.file.trim() ? req.query.file.trim() : meta.filename;
    const absPath = resolveIsoFilePath(requested, isoDir);
    if (!fs.existsSync(absPath)) {
      res.status(404).json({ error: 'El archivo .iso solicitado no existe.' });
      return;
    }
    const stat = fs.statSync(absPath);
    if (!stat.isFile() || stat.size === 0) {
      res.status(422).json({ error: 'El archivo .iso está vacío o corrupto.' });
      return;
    }

    const safeFilename = path.basename(absPath);
    res.setHeader('Content-Type', 'application/x-iso9660-image');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'no-store');
    if (meta.sha256) {
      res.setHeader('ETag', `"${meta.sha256}"`);
      res.setHeader('X-GTEMS-SHA256', meta.sha256);
    }

    const rangeHeader = req.headers.range;
    if (rangeHeader) {
      const match = rangeHeader.match(/^bytes=(\d*)-(\d*)$/);
      if (!match) {
        res.status(416).setHeader('Content-Range', `bytes */${stat.size}`).end();
        return;
      }
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Math.min(Number(match[2]), stat.size - 1) : stat.size - 1;
      if (Number.isNaN(start) || Number.isNaN(end) || start < 0 || start > end || end >= stat.size) {
        res.status(416).setHeader('Content-Range', `bytes */${stat.size}`).end();
        return;
      }
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
      res.setHeader('Content-Length', String(end - start + 1));
      const stream = fs.createReadStream(absPath, { start, end });
      stream.on('error', () => {
        if (!res.headersSent) res.status(500).end();
      });
      stream.pipe(res);
      return;
    }

    res.setHeader('Content-Length', String(stat.size));
    const stream = fs.createReadStream(absPath);
    stream.on('error', () => {
      if (!res.headersSent) res.status(500).end();
    });
    stream.pipe(res);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Solicitud de descarga ISO inválida.' });
  }
});

// User Management
app.post('/api/users', requireAuth, (req: AuthReq, res) => {
  if (req.authUser?.role !== 'admin') {
    res.status(403).json({ error: 'Se requieren privilegios de administrador.' });
    return;
  }
  const { username, displayName, password, role } = req.body || {};
  const cleanUser = String(username || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (cleanUser.length < 2 || !password || String(password).length < 4) {
    res.status(400).json({ error: 'Usuario o contraseña inválidos (mínimo 4 caracteres).' });
    return;
  }

  const state = loadState();
  if (state.users.some((u) => u.username === cleanUser)) {
    res.status(409).json({ error: 'El usuario ya existe.' });
    return;
  }

  const { hash, salt } = hashPassword(String(password));
  state.users.push({
    id: `usr-${crypto.randomBytes(4).toString('hex')}`,
    username: cleanUser,
    displayName: String(displayName || cleanUser).trim(),
    role: role === 'admin' ? 'admin' : 'standard',
    createdAt: new Date().toISOString(),
    passwordHash: hash,
    salt,
  });
  appendAuditLog(state, 'SEC', 'USER_CREATED', `Cuenta creada: ${cleanUser} por ${req.authUser.username}`);
  saveState(state);
  res.json({ ok: true, users: sanitizePublicUsers(state.users) });
});

app.post('/api/users/change-password', requireAuth, (req: AuthReq, res) => {
  const { userId, currentPassword, newPassword } = req.body || {};
  if (!newPassword || String(newPassword).length < 4) {
    res.status(400).json({ error: 'La nueva contraseña debe tener al menos 4 caracteres.' });
    return;
  }
  const state = loadState();
  const target = state.users.find((u) => u.id === (userId || req.authUser?.sub));
  if (!target) {
    res.status(404).json({ error: 'Usuario no encontrado.' });
    return;
  }
  if (req.authUser?.role !== 'admin' && target.id !== req.authUser?.sub) {
    res.status(403).json({ error: 'Acceso denegado.' });
    return;
  }
  if (target.id === req.authUser?.sub && (!currentPassword || !verifyPassword(String(currentPassword), target.passwordHash, target.salt))) {
    res.status(401).json({ error: 'La contraseña actual no coincide.' });
    return;
  }
  const { hash, salt } = hashPassword(String(newPassword));
  target.passwordHash = hash;
  target.salt = salt;
  appendAuditLog(state, 'SEC', 'PASSWORD_CHANGED', `Contraseña actualizada para ${target.username}`);
  saveState(state);
  res.json({ ok: true });
});

app.patch('/api/users/:id', requireAuth, (req: AuthReq, res) => {
  const state = loadState();
  const target = state.users.find((u) => u.id === req.params.id);
  if (!target) {
    res.status(404).json({ error: 'Usuario no encontrado.' });
    return;
  }
  if (req.authUser?.role !== 'admin' && target.id !== req.authUser?.sub) {
    res.status(403).json({ error: 'No autorizado.' });
    return;
  }
  if (typeof req.body?.displayName === 'string') target.displayName = req.body.displayName.trim();
  if (typeof req.body?.avatarUrl === 'string') target.avatarUrl = req.body.avatarUrl;
  if (req.authUser?.role === 'admin' && (req.body?.role === 'admin' || req.body?.role === 'standard')) {
    target.role = req.body.role;
  }
  saveState(state);
  res.json({ ok: true, users: sanitizePublicUsers(state.users) });
});

// Power actions: Shutdown, Reboot, Reset Settings, Clean Reinstall
app.post('/api/system/power', requireAuth, (req: AuthReq, res) => {
  const { action, confirmReset } = req.body || {};
  const state = loadState();

  if (action === 'reset-settings') {
    state.personalization = { ...DEFAULT_PERSONALIZATION };
    state.language = 'es-HN';
    state.timezone = 'America/Tegucigalpa';
    state.doNotDisturb = false;
    state.volume = 72;
    state.muted = false;
    state.brightness = 95;
    appendAuditLog(state, 'WARN', 'SETTINGS_RESET', `Preferencias restablecidas por ${req.authUser?.username}`);
    saveState(state);
    res.json({ ok: true, action: 'reset-settings', state: buildPublicStateSummary(state) });
    return;
  }

  if (action === 'reinstall') {
    if (confirmReset !== 'REINSTALAR GTEMS OS') {
      res.status(400).json({ error: 'Confirmación explícita requerida para restablecer.' });
      return;
    }
    state.installed = false;
    state.users = [];
    state.personalization = { ...DEFAULT_PERSONALIZATION };
    appendAuditLog(state, 'SEC', 'SYSTEM_RESET', `Restablecimiento a instalador ejecutado por ${req.authUser?.username}`);
    saveState(state);
    res.json({ ok: true, action: 'reinstall' });
    return;
  }

  if (action === 'shutdown' || action === 'reboot' || action === 'suspend') {
    appendAuditLog(state, 'INFO', action.toUpperCase(), `Operación de energía (${action}) ejecutada por ${req.authUser?.username}`);
    saveState(state);
    res.json({ ok: true, action });
    return;
  }

  res.status(400).json({ error: 'Acción de energía inválida.' });
});

// Global Real System Search (Apps, Files + Content, Settings, Devices, Processes, Tools, History)
app.get('/api/search', requireAuth, async (req, res) => {
  const q = String(req.query.q || '').trim();
  const category = String(req.query.category || 'all');
  const saveHistory = req.query.saveHistory === '1';

  const state = loadState();
  if (saveHistory && q) {
    state.searchHistory = [
      { id: `sh-${Date.now()}`, query: q, type: 'system' as const, timestamp: new Date().toISOString() },
      ...state.searchHistory.filter((h) => h.query.toLowerCase() !== q.toLowerCase()),
    ].slice(0, 30);
    saveState(state);
  }

  if (!q) {
    res.json({ results: [], history: state.searchHistory });
    return;
  }

  const lower = q.toLowerCase();
  const results: SearchResultItem[] = [];

  // 1. Installed / Preinstalled GTEMS Apps
  if (category === 'all' || category === 'apps') {
    for (const appId of Object.keys(APP_CATALOG) as AppId[]) {
      const entry = APP_CATALOG[appId];
      if (entry.name.toLowerCase().includes(lower) || entry.description.toLowerCase().includes(lower) || entry.id.includes(lower)) {
        results.push({
          id: `app-${appId}`,
          category: 'app-installed',
          title: entry.name,
          subtitle: entry.description,
          matchReason: 'Aplicación del sistema',
          actionType: 'open-app',
          appId,
          score: entry.name.toLowerCase().startsWith(lower) ? 100 : 82,
        });
      }
    }
  }

  // 2. Settings sections
  if (category === 'all' || category === 'settings') {
    for (const cat of SETTINGS_CATEGORIES) {
      if (cat.label.toLowerCase().includes(lower) || cat.keywords.some((k) => k.toLowerCase().includes(lower))) {
        results.push({
          id: `set-${cat.id}`,
          category: 'setting',
          title: `Configuración → ${cat.label}`,
          subtitle: cat.keywords.slice(0, 5).join(', '),
          matchReason: 'Ajuste del sistema',
          actionType: 'open-setting',
          settingCategory: cat.id,
          score: 88,
        });
      }
    }
  }

  // 3. Real Files, Folders, Documents, Images, Videos, Music, Downloads (name + ext + text content)
  if (category === 'all' || category === 'files') {
    const fileMatches = searchFilesWithContent(q, 30);
    for (const fm of fileMatches) {
      const e = fm.entry;
      let cat: SearchResultItem['category'] = 'file';
      if (e.isDirectory) cat = 'folder';
      else if (e.path.startsWith('/Descargas')) cat = 'download';
      else if (e.appId === 'image-editor') cat = 'image';
      else if (e.appId === 'music-player') cat = 'music';
      else if (e.appId === 'video-player') cat = 'video';
      else if (e.appId === 'text-editor' || e.appId === 'code-studio') cat = 'document';

      results.push({
        id: `file-${e.path}`,
        category: cat,
        title: e.name,
        subtitle: fm.snippet ? `${e.path} · "${fm.snippet}"` : `${e.path} · ${e.mimeType}`,
        matchReason: `Coincidencia por ${fm.matchReason}`,
        actionType: 'open-file',
        filePath: e.path,
        appId: e.isDirectory ? 'explorer' : e.appId === 'archive' || e.appId === 'incompatible-exe' || e.appId === 'unsupported' ? 'explorer' : e.appId,
        score: fm.matchReason === 'nombre' ? 92 : fm.matchReason === 'extensión' ? 78 : 70,
      });
    }
  }

  // 4. Real Devices & Processes & APT Packages
  if (category === 'all' || category === 'devices') {
    const devData = await getRealDevices();
    for (const d of devData.devices) {
      if (d.name.toLowerCase().includes(lower) || d.type.toLowerCase().includes(lower) || d.details.toLowerCase().includes(lower)) {
        results.push({
          id: `dev-${d.port}-${d.name}`,
          category: 'device',
          title: d.name,
          subtitle: `${d.type} · ${d.status} · ${d.port}`,
          matchReason: 'Dispositivo real',
          actionType: 'open-app',
          appId: 'device-manager',
          score: 68,
        });
      }
    }
  }

  if (category === 'all' || category === 'processes') {
    const procs = await getRealProcesses();
    for (const pr of procs.slice(0, 40)) {
      if (pr.command.toLowerCase().includes(lower) || String(pr.pid) === q) {
        results.push({
          id: `proc-${pr.pid}`,
          category: 'process',
          title: `${pr.command} (PID ${pr.pid})`,
          subtitle: `Usuario: ${pr.user} · CPU ${pr.cpu}% · MEM ${pr.mem}%`,
          matchReason: 'Proceso activo',
          actionType: 'open-app',
          appId: 'task-manager',
          score: 65,
        });
      }
    }
  }

  if (category === 'all' || category === 'apps') {
    const pkgs = await getInstalledDebianPackages(q);
    for (const pkg of pkgs.slice(0, 8)) {
      results.push({
        id: `pkg-${pkg.name}`,
        category: 'app-installed',
        title: `Paquete APT: ${pkg.name} (${pkg.version})`,
        subtitle: pkg.summary || 'Paquete Debian instalado',
        matchReason: 'dpkg-query',
        actionType: 'open-app',
        appId: 'package-manager',
        score: 60,
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  res.json({ results: results.slice(0, 60), history: state.searchHistory });
});

app.delete('/api/search/history', requireAuth, (_req, res) => {
  const state = loadState();
  state.searchHistory = [];
  saveState(state);
  res.json({ ok: true, history: [] });
});

// Real Hardware, Processes, Network, Devices, Packages
app.get('/api/system/hardware', requireAuth, async (_req, res) => {
  const specs = await getRealHardwareSpecs();
  res.json(specs);
});

app.get('/api/system/processes', requireAuth, async (_req, res) => {
  const processes = await getRealProcesses();
  res.json({ processes, cpuLoad: os.loadavg(), memTotal: os.totalmem(), memFree: os.freemem() });
});

app.post('/api/system/processes/:pid/kill', requireAuth, (req: AuthReq, res) => {
  const pid = Number(req.params.pid);
  if (!Number.isInteger(pid) || pid <= 1 || pid === process.pid) {
    res.status(400).json({ error: 'No está permitido finalizar procesos críticos del kernel o del servicio GTEMS.' });
    return;
  }
  try {
    process.kill(pid, 'SIGTERM');
    const state = loadState();
    appendAuditLog(state, 'WARN', 'PROCESS_KILL', `PID ${pid} terminado por ${req.authUser?.username}`);
    saveState(state);
    res.json({ ok: true });
  } catch (err) {
    res.status(403).json({ error: err instanceof Error ? err.message : 'Permiso denegado o proceso inexistente.' });
  }
});

app.get('/api/network/status', requireAuth, async (_req, res) => {
  const status = await getRealNetworkStatus();
  res.json(status);
});

app.post('/api/network/diagnose', requireAuth, async (req, res) => {
  try {
    const result = await runNetworkDiagnostic(String(req.body?.host || 'deb.debian.org'));
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Error en diagnóstico' });
  }
});

app.get('/api/devices', requireAuth, async (_req, res) => {
  const data = await getRealDevices();
  res.json(data);
});

app.get('/api/packages', requireAuth, async (req, res) => {
  const q = String(req.query.q || '');
  const pkgs = await getInstalledDebianPackages(q);
  res.json({ packages: pkgs });
});

app.post('/api/packages/check-updates', requireAuth, async (_req, res) => {
  try {
    const { stdout, stderr } = await execFileAsync('dpkg', ['--audit'], { timeout: 5000 });
    res.json({
      ok: true,
      summary: stdout.trim() || 'Integridad de paquetes Debian verificada sin errores pendientes.',
      stderr: stderr.trim(),
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error al verificar paquetes' });
  }
});

// Real Bash Terminal Execution & Persistent 20-Command History
app.get('/api/terminal/history', requireAuth, (_req, res) => {
  const state = loadState();
  res.json({ history: state.terminalHistory.slice(0, 20) });
});

app.delete('/api/terminal/history', requireAuth, (_req, res) => {
  const state = loadState();
  state.terminalHistory = [];
  saveState(state);
  res.json({ ok: true, history: [] });
});

app.post('/api/terminal/exec', requireAuth, async (req: AuthReq, res) => {
  const command = String(req.body?.command || '');
  const cwd = String(req.body?.cwd || FS_ROOT);
  if (!command.trim()) {
    res.json({ stdout: '', stderr: '', exitCode: 0, newCwd: cwd });
    return;
  }
  const result = await executeRealBashCommand(command, cwd);

  const state = loadState();
  state.terminalHistory = appendTerminalHistory(state.terminalHistory, {
    id: `term-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
    command,
    executedAt: new Date().toISOString(),
    exitCode: result.exitCode,
    cwd: result.newCwd || cwd,
  });
  saveState(state);

  res.json({ ...result, terminalHistory: state.terminalHistory });
});

app.get('/api/terminal/complete', requireAuth, (req, res) => {
  const prefix = String(req.query.prefix || '');
  const cwd = String(req.query.cwd || FS_ROOT);
  const safeDir = fs.existsSync(cwd) ? cwd : FS_ROOT;
  try {
    const items = fs.readdirSync(safeDir).filter((n) => n.startsWith(prefix));
    res.json({ matches: items.slice(0, 20) });
  } catch {
    res.json({ matches: [] });
  }
});

// GTEMS Code Studio: Real Runtime Detection + Isolated Execution + Stop
app.get('/api/code/runtimes', requireAuth, async (_req, res) => {
  const runtimes = await getCodeRuntimes();
  res.json({ runtimes });
});

app.post('/api/code/execute', requireAuth, async (req, res) => {
  const { runId, language, code } = req.body || {};
  if (!language || typeof code !== 'string') {
    res.status(400).json({ error: 'Lenguaje y código fuente son obligatorios.' });
    return;
  }
  const id = String(runId || `run_${Date.now()}`);
  const result = await executeCodeRun(id, language, code);
  res.json({ ok: true, runId: id, ...result });
});

app.post('/api/code/stop/:runId', requireAuth, (req, res) => {
  const stopped = stopCodeRun(String(req.params.runId));
  res.json({ ok: true, stopped });
});

// Real Filesystem APIs
app.get('/api/fs/list', requireAuth, (req, res) => {
  try {
    const dirPath = String(req.query.path || '/');
    const result = listDirectory(dirPath);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Error al listar directorio' });
  }
});

app.get('/api/fs/read', requireAuth, (req, res) => {
  try {
    const vp = String(req.query.path || '');
    const { absPath, readOnly } = resolveSafePath(vp);
    if (!fs.existsSync(absPath) || fs.statSync(absPath).isDirectory()) {
      res.status(404).json({ error: 'Archivo no encontrado.' });
      return;
    }
    const content = fs.readFileSync(absPath, 'utf8');
    res.json({ content, readOnly, path: vp });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Error al leer archivo' });
  }
});

app.get('/api/fs/raw', (req, res) => {
  const header = req.headers.authorization || '';
  const queryToken = typeof req.query.token === 'string' ? req.query.token : '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : queryToken;
  if (!token || !verifySessionToken(token)) {
    res.status(401).send('No autorizado');
    return;
  }
  try {
    const vp = String(req.query.path || '');
    const { absPath } = resolveSafePath(vp);
    if (!fs.existsSync(absPath) || fs.statSync(absPath).isDirectory()) {
      res.status(404).send('No encontrado');
      return;
    }
    const extInfo = resolveFileExtension(path.basename(absPath));
    res.type(extInfo.mimeType);
    res.sendFile(absPath);
  } catch (err) {
    res.status(400).send(err instanceof Error ? err.message : 'Error');
  }
});

app.post('/api/fs/create', requireAuth, (req, res) => {
  try {
    const { parentPath, name, isDirectory, content } = req.body || {};
    const cleanName = path.basename(String(name || '').trim());
    if (!cleanName) throw new Error('Nombre inválido.');
    const targetVirtual = parentPath === '/' ? `/${cleanName}` : `${parentPath}/${cleanName}`;
    const { absPath, readOnly } = resolveSafePath(targetVirtual);
    if (readOnly) throw new Error('El directorio /Sistema es de solo lectura.');
    if (fs.existsSync(absPath)) throw new Error('Ya existe un elemento con ese nombre.');

    if (isDirectory) {
      fs.mkdirSync(absPath, { recursive: true });
    } else {
      fs.writeFileSync(absPath, String(content ?? ''), 'utf8');
    }
    res.json({ ok: true, path: targetVirtual });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Error al crear' });
  }
});

app.put('/api/fs/file', requireAuth, (req, res) => {
  try {
    const { path: vp, content, base64 } = req.body || {};
    const { absPath, readOnly } = resolveSafePath(String(vp || ''));
    if (readOnly) throw new Error('No se pueden modificar archivos de solo lectura en /Sistema.');
    if (base64) {
      const stripped = String(base64).replace(/^data:[^;]+;base64,/, '');
      fs.writeFileSync(absPath, Buffer.from(stripped, 'base64'));
    } else {
      fs.writeFileSync(absPath, String(content ?? ''), 'utf8');
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Error al guardar archivo' });
  }
});

app.post('/api/fs/rename', requireAuth, (req, res) => {
  try {
    const { path: vp, newName } = req.body || {};
    const cleanName = path.basename(String(newName || '').trim());
    if (!cleanName) throw new Error('Nombre inválido.');
    const { absPath, readOnly, relPath } = resolveSafePath(String(vp || ''));
    if (readOnly) throw new Error('No se puede renombrar en /Sistema.');
    const parentVirtual = path.posix.dirname(relPath);
    const destVirtual = parentVirtual === '/' ? `/${cleanName}` : `${parentVirtual}/${cleanName}`;
    const { absPath: destAbs } = resolveSafePath(destVirtual);
    if (fs.existsSync(destAbs)) throw new Error('Ya existe otro elemento con ese nombre.');
    fs.renameSync(absPath, destAbs);
    res.json({ ok: true, newPath: destVirtual });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Error al renombrar' });
  }
});

app.post('/api/fs/transfer', requireAuth, (req, res) => {
  try {
    const { paths: vps, destDir, mode } = req.body || {};
    const { absPath: destAbs, readOnly } = resolveSafePath(String(destDir || '/Documentos'));
    if (readOnly) throw new Error('No se puede escribir en /Sistema.');
    for (const vp of Array.isArray(vps) ? vps : []) {
      const { absPath: srcAbs, readOnly: srcRo } = resolveSafePath(String(vp));
      if (!fs.existsSync(srcAbs)) continue;
      let targetAbs = path.join(destAbs, path.basename(srcAbs));
      if (fs.existsSync(targetAbs)) {
        targetAbs = path.join(destAbs, `Copia_${Date.now()}_${path.basename(srcAbs)}`);
      }
      if (mode === 'cut') {
        if (srcRo) throw new Error('No se puede mover desde /Sistema.');
        fs.renameSync(srcAbs, targetAbs);
      } else {
        fs.cpSync(srcAbs, targetAbs, { recursive: true });
      }
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Error al transferir elementos' });
  }
});

app.post('/api/fs/trash', requireAuth, (req, res) => {
  try {
    moveToTrash(Array.isArray(req.body?.paths) ? req.body.paths : []);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Error al mover a la papelera' });
  }
});

app.post('/api/fs/restore', requireAuth, (req, res) => {
  try {
    restoreFromTrash(Array.isArray(req.body?.paths) ? req.body.paths : []);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Error al restaurar' });
  }
});

app.post('/api/fs/delete-permanent', requireAuth, (req, res) => {
  try {
    permanentDelete(Array.isArray(req.body?.paths) ? req.body.paths : []);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Error al eliminar definitivamente' });
  }
});

app.post('/api/fs/empty-trash', requireAuth, (_req, res) => {
  try {
    const trash = listDirectory('/Papelera');
    permanentDelete(trash.entries.map((e) => e.path));
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Error al vaciar papelera' });
  }
});

app.post('/api/fs/compress', requireAuth, (req, res) => {
  try {
    const { paths: vps, archiveName, parentPath } = req.body || {};
    const cleanZip = path.basename(String(archiveName || `archivo_${Date.now()}.zip`));
    const zipVirtual = parentPath === '/' ? `/${cleanZip}` : `${parentPath}/${cleanZip}`;
    const created = compressToZip(Array.isArray(vps) ? vps : [], zipVirtual);
    res.json({ ok: true, path: created });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Error al comprimir' });
  }
});

app.post('/api/fs/extract', requireAuth, (req, res) => {
  try {
    const { zipPath, destDir } = req.body || {};
    extractZip(String(zipPath || ''), String(destDir || '/Documentos'));
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Error al extraer' });
  }
});

// Multi-Browser Registry + Real HTTP Inspection + Bookmarks + Streaming Downloads
app.get('/api/browser/status', requireAuth, async (_req, res) => {
  const state = loadState();
  const status = await getChromeAvailability();
  const browsers = await getBrowserRegistry(state.defaultBrowser);
  res.json({ ...status, defaultBrowser: state.defaultBrowser, browsers });
});

app.get('/api/browsers', requireAuth, async (_req, res) => {
  const state = loadState();
  const browsers = await getBrowserRegistry(state.defaultBrowser);
  res.json({ defaultBrowser: state.defaultBrowser, browsers });
});

app.post('/api/browsers/default', requireAuth, async (req, res) => {
  const browserId = String(req.body?.browserId || '');
  const browsers = await getBrowserRegistry();
  const target = browsers.find((b) => b.id === browserId);
  if (!target) {
    res.status(404).json({ error: 'Navegador no reconocido.' });
    return;
  }
  if (!target.supportedOnLinux) {
    res.status(400).json({ error: target.statusNote });
    return;
  }
  if (!target.installed) {
    res.status(400).json({ error: `${target.name} no está instalado en este sistema Linux. ${target.statusNote}` });
    return;
  }
  const state = loadState();
  state.defaultBrowser = target.id;
  saveState(state);
  res.json({ ok: true, defaultBrowser: state.defaultBrowser, browsers: await getBrowserRegistry(state.defaultBrowser) });
});

app.post('/api/browser/inspect-url', requireAuth, async (req, res) => {
  try {
    const parsedUrl = await validatePublicHttpUrl(String(req.body?.url || ''));
    const started = Date.now();
    const response = await fetch(parsedUrl.toString(), {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': 'GTEMS-OS-Aurora/1.0' },
      signal: AbortSignal.timeout(8000),
    });
    const latencyMs = Date.now() - started;
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const text =
      contentType.includes('text') || contentType.includes('json')
        ? (await response.text()).slice(0, 12000)
        : '';
    const titleMatch = text.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : parsedUrl.hostname;

    const state = loadState();
    state.history.unshift({
      id: `hist-${Date.now()}`,
      title,
      url: response.url || parsedUrl.toString(),
      visitedAt: new Date().toISOString(),
    });
    state.history = state.history.slice(0, 60);
    saveState(state);

    res.json({
      ok: true,
      finalUrl: response.url || parsedUrl.toString(),
      status: response.status,
      statusText: response.statusText,
      contentType,
      title,
      latencyMs,
      snippet: text.slice(0, 4000),
      history: state.history,
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'No se pudo conectar a la URL' });
  }
});

app.post('/api/browser/bookmarks', requireAuth, (req, res) => {
  const { title, url } = req.body || {};
  const state = loadState();
  state.bookmarks.unshift({
    id: `bm-${Date.now()}`,
    title: String(title || url || 'Marcador').slice(0, 80),
    url: String(url || ''),
    createdAt: new Date().toISOString(),
  });
  saveState(state);
  res.json({ ok: true, bookmarks: state.bookmarks });
});

app.delete('/api/browser/bookmarks/:id', requireAuth, (req, res) => {
  const state = loadState();
  state.bookmarks = state.bookmarks.filter((b) => b.id !== req.params.id);
  saveState(state);
  res.json({ ok: true, bookmarks: state.bookmarks });
});

// Real Streaming Downloads API
app.get('/api/downloads', requireAuth, (_req, res) => {
  const state = loadState();
  res.json({ downloads: state.downloads });
});

app.post('/api/downloads/start', requireAuth, async (req, res) => {
  try {
    const parsedUrl = await validatePublicHttpUrl(String(req.body?.url || ''));
    const suggestedName = path.basename(parsedUrl.pathname) || `descarga_${Date.now()}.bin`;
    const cleanName = suggestedName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const saveVirtual = `/Descargas/${cleanName}`;
    const { absPath } = resolveSafePath(saveVirtual);

    const downloadId = `dl-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`;
    const state = loadState();
    const newItem: DownloadItem = {
      id: downloadId,
      url: parsedUrl.toString(),
      filename: cleanName,
      savePath: saveVirtual,
      status: 'downloading',
      totalBytes: 0,
      receivedBytes: 0,
      speedBps: 0,
      etaSeconds: null,
      supportsRange: false,
      sourceBrowser: state.defaultBrowser,
      startedAt: new Date().toISOString(),
    };
    state.downloads.unshift(newItem);
    saveState(state);

    // Begin streaming in background; wait briefly (up to 800ms) so tiny files finish immediately
    const promise = streamDownloadToDisk(downloadId, parsedUrl, absPath, 0);
    await Promise.race([promise, new Promise((r) => setTimeout(r, 800))]);

    const latestState = loadState();
    const latestItem = latestState.downloads.find((d) => d.id === downloadId);
    res.json({ ok: true, download: latestItem, downloads: latestState.downloads });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Error al iniciar descarga' });
  }
});

app.post('/api/downloads/:id/pause', requireAuth, (req, res) => {
  const id = String(req.params.id);
  const ctrl = activeDownloadControllers.get(id);
  if (!ctrl) {
    res.status(400).json({ error: 'La descarga no está activa en este momento.' });
    return;
  }
  ctrl.mode = 'pause';
  ctrl.controller.abort();
  const state = loadState();
  state.downloads = state.downloads.map((d) => (d.id === id ? { ...d, status: 'paused', speedBps: 0 } : d));
  saveState(state);
  res.json({ ok: true, downloads: state.downloads });
});

app.post('/api/downloads/:id/resume', requireAuth, async (req, res) => {
  try {
    const id = String(req.params.id);
    const state = loadState();
    const item = state.downloads.find((d) => d.id === id);
    if (!item) {
      res.status(404).json({ error: 'Descarga no encontrada.' });
      return;
    }
    const parsedUrl = await validatePublicHttpUrl(item.url);
    const { absPath } = resolveSafePath(item.savePath);
    const currentSize = fs.existsSync(absPath) ? fs.statSync(absPath).size : 0;
    const promise = streamDownloadToDisk(id, parsedUrl, absPath, item.supportsRange ? currentSize : 0);
    await Promise.race([promise, new Promise((r) => setTimeout(r, 500))]);
    const updated = loadState();
    res.json({ ok: true, downloads: updated.downloads });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'No se pudo reanudar la descarga' });
  }
});

app.post('/api/downloads/:id/cancel', requireAuth, (req, res) => {
  const id = String(req.params.id);
  const ctrl = activeDownloadControllers.get(id);
  if (ctrl) {
    ctrl.mode = 'cancel';
    ctrl.controller.abort();
  }
  const state = loadState();
  state.downloads = state.downloads.map((d) =>
    d.id === id ? { ...d, status: 'cancelled', speedBps: 0, etaSeconds: null } : d
  );
  saveState(state);
  res.json({ ok: true, downloads: state.downloads });
});

app.delete('/api/downloads/:id', requireAuth, (req, res) => {
  const id = String(req.params.id);
  const ctrl = activeDownloadControllers.get(id);
  if (ctrl) {
    ctrl.mode = 'cancel';
    ctrl.controller.abort();
  }
  const state = loadState();
  const target = state.downloads.find((d) => d.id === id);
  if (target && req.query.deleteFile === '1') {
    try {
      const { absPath } = resolveSafePath(target.savePath);
      if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
    } catch {
      // ignore
    }
  }
  state.downloads = state.downloads.filter((d) => d.id !== id);
  saveState(state);
  res.json({ ok: true, downloads: state.downloads });
});

// Start Vite dev middleware or serve static build
async function startServer() {
  const PORT = 3000;
  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GTEMS OS Aurora server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
