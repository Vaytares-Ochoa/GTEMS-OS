import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getPublishedIsoMetadata, resolveIsoFilePath } from '../../server/isoService';
import {
  DEFAULT_PERSONALIZATION,
  GTEMS_IDENTITY,
  SETTINGS_CATEGORIES,
  resolveFileExtension,
} from './gtemsIdentity';
import { clampContextMenuPosition, computeNextSelection } from './contextMenuLogic';
import { computeTaskbarLayout } from './taskbarLayout';
import {
  SUPPORTED_LANGUAGES,
  getIanaTimezoneCatalog,
  isRtlLanguage,
  t,
} from './i18n';
import { THEME_PRESETS, buildCursorSvgDataUri } from './themes';
import {
  TERMINAL_HISTORY_LIMIT,
  appendTerminalHistory,
  isDangerousTerminalCommand,
  sanitizeTerminalCommand,
} from './terminalHistoryLogic';

test('GTEMS OS official identity and exact 5 developers', () => {
  assert.equal(GTEMS_IDENTITY.name, 'GTEMS OS');
  assert.equal(GTEMS_IDENTITY.slogan, 'Diseñado por cinco mentes, construido para el futuro.');
  assert.deepEqual([...GTEMS_IDENTITY.developers], [
    'GLENDA SAMAHI ARDON ZELAYA',
    'TATIANA VAYTARES OCHOA AGUILAR',
    'CARLOS ROBERTO SUAZO',
    'EDER JOSUE CABRERA RAMOS',
    'MAYLON ASAEL SÁNCHEZ SOSA',
  ]);
  assert.equal(JSON.stringify(GTEMS_IDENTITY).toUpperCase().includes('ZEYLA'), false);
  assert.equal(DEFAULT_PERSONALIZATION.taskbarPosition, 'left');
  assert.equal(DEFAULT_PERSONALIZATION.themeId, 'zeyla-aurora');
});

test('Settings has exact 10 categories and excludes Windows Update, Accesibilidad, Privacidad y seguridad', () => {
  assert.equal(SETTINGS_CATEGORIES.length, 10);
  const labels = SETTINGS_CATEGORIES.map((c) => c.label);
  assert.deepEqual(labels, [
    'Inicio',
    'Sistema',
    'Bluetooth y dispositivos',
    'Red e Internet',
    'Personalización',
    'Aplicaciones',
    'Cuentas',
    'Hora e idioma',
    'Juegos',
    'Acerca de',
  ]);
  assert.equal(labels.includes('Windows Update'), false);
  assert.equal(labels.includes('Accesibilidad'), false);
  assert.equal(labels.includes('Privacidad y seguridad'), false);
});

test('MIME extension registry maps media, archives, executables and Code Studio languages accurately', () => {
  assert.equal(resolveFileExtension('foto.PNG').appId, 'image-editor');
  assert.equal(resolveFileExtension('cancion.flac').appId, 'music-player');
  assert.equal(resolveFileExtension('clip.mkv').appId, 'video-player');
  assert.equal(resolveFileExtension('index.html').appId, 'browser');
  assert.equal(resolveFileExtension('paquete.zip').appId, 'archive');
  assert.equal(resolveFileExtension('programa.exe').appId, 'incompatible-exe');
  assert.equal(resolveFileExtension('notas.md').appId, 'text-editor');
  assert.equal(resolveFileExtension('script.py').appId, 'code-studio');
  assert.equal(resolveFileExtension('main.cpp').appId, 'code-studio');
  assert.equal(resolveFileExtension('consulta.sql').appId, 'code-studio');
});

test('Context menu clamping keeps menu inside viewport boundaries', () => {
  const pos = clampContextMenuPosition(1420, 880, 220, 260, 1440, 900);
  assert.ok(pos.x <= 1440 - 220 - 8);
  assert.ok(pos.y <= 900 - 260 - 8);
  assert.equal(pos.openSubmenuLeft, true);
});

test('Multi-selection supports Ctrl+click and Shift+click ranges', () => {
  const list = ['/a', '/b', '/c', '/d'];
  const s1 = computeNextSelection(list, ['/a'], '/c', '/a', { ctrlKey: false, shiftKey: true });
  assert.deepEqual(s1.selected, ['/a', '/b', '/c']);
  const s2 = computeNextSelection(list, s1.selected, '/b', '/a', { ctrlKey: true, shiftKey: false });
  assert.deepEqual(s2.selected, ['/a', '/c']);
});

test('Left vertical taskbar computes overflow on short viewports and preserves sidebar width', () => {
  const res = computeTaskbarLayout({
    viewportWidth: 1280,
    viewportHeight: 460,
    position: 'left',
    uiScale: 1.15,
    iconSize: 'large',
    fontSize: 'large',
    items: ['explorer', 'browser', 'terminal', 'code-studio', 'settings', 'task-manager', 'device-manager', 'image-editor'],
  });
  assert.ok(res.sidebarWidthPx >= 60);
  assert.ok(res.overflowItems.length > 0);
  assert.equal(res.visibleItems.length + res.overflowItems.length, 8);
});

test('i18n supports 33+ languages, RTL detection, and full IANA timezone database', () => {
  assert.ok(SUPPORTED_LANGUAGES.length >= 33);
  assert.equal(isRtlLanguage('ar-SA'), true);
  assert.equal(isRtlLanguage('he-IL'), true);
  assert.equal(isRtlLanguage('es-HN'), false);
  assert.equal(t('en-US', 'settings.personalizacion'), 'Personalization');
  assert.equal(t('ja-JP', 'app.start'), 'スタート');
  assert.equal(t('ar-SA', 'settings.hora'), 'الوقت واللغة');
  assert.equal(t('es-HN', 'nonexistent.custom.key', 'Texto seguro'), 'Texto seguro');

  const zones = getIanaTimezoneCatalog();
  assert.ok(zones.length > 100);
  assert.ok(zones.some((z) => z.id === 'America/Tegucigalpa'));
  assert.ok(zones.some((z) => z.id === 'Asia/Tokyo'));
});

test('ZEYLA theme presets and SVG real cursor data URIs build cleanly', () => {
  const ids = Object.keys(THEME_PRESETS);
  assert.deepEqual(ids.sort(), [
    'zeyla-aurora',
    'zeyla-crystal',
    'zeyla-dream',
    'zeyla-midnight',
    'zeyla-neon',
    'zeyla-pastel',
  ]);
  const cur = buildCursorSvgDataUri('neon', 'large', '#00D4FF', 'default');
  assert.ok(cur.startsWith('url("data:image/svg+xml;utf8,'));
});

test('Terminal 20-command history keeps max 20 newest-first and redacts sensitive secrets', () => {
  const s1 = sanitizeTerminalCommand('export API_TOKEN=supersecret123 && ls');
  assert.equal(s1.redacted, true);
  assert.equal(s1.sanitized.includes('supersecret123'), false);

  const s2 = sanitizeTerminalCommand('curl -H "Authorization: Bearer mysecrettoken999" https://example.com');
  assert.equal(s2.redacted, true);
  assert.equal(s2.sanitized.includes('mysecrettoken999'), false);

  assert.equal(isDangerousTerminalCommand('rm -rf /tmp/test'), true);
  assert.equal(isDangerousTerminalCommand('ls -la'), false);

  let hist: ReturnType<typeof appendTerminalHistory> = [];
  for (let i = 1; i <= 25; i++) {
    hist = appendTerminalHistory(hist, {
      id: `h-${i}`,
      command: `echo cmd_${i}`,
      executedAt: new Date().toISOString(),
      exitCode: 0,
      cwd: '.gtems-fs',
    });
  }
  assert.equal(hist.length, TERMINAL_HISTORY_LIMIT);
  assert.equal(hist[0].command, 'echo cmd_25');
  assert.equal(hist[19].command, 'echo cmd_6');
});

test('GTEMS OS includes verbatim official description (§1.2)', () => {
  assert.equal(
    GTEMS_IDENTITY.officialDescription,
    'GTEMS OS es un sistema operativo basado en Linux, diseñado para ofrecer un entorno de escritorio moderno, personalizable y funcional. Integra herramientas de productividad, navegación, programación, administración de archivos y dispositivos, conectividad y configuración del sistema en una plataforma preparada para evolucionar.'
  );
});

test('ISO service reports unavailable honestly when directory is missing or empty, validates SHA-256, and blocks path traversal', async () => {
  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'gtems-iso-test-'));
  try {
    // 1. Missing directory -> honest unavailable
    const missingMeta = await getPublishedIsoMetadata(path.join(tmpBase, 'nonexistent'));
    assert.equal(missingMeta.available, false);
    assert.equal(missingMeta.status, 'unavailable');

    // 2. Empty 0-byte ISO -> corrupted / blocked
    const emptyDir = path.join(tmpBase, 'empty');
    fs.mkdirSync(emptyDir, { recursive: true });
    fs.writeFileSync(path.join(emptyDir, 'GTEMS-OS.iso'), Buffer.alloc(0));
    const emptyMeta = await getPublishedIsoMetadata(emptyDir);
    assert.equal(emptyMeta.available, false);
    assert.equal(emptyMeta.status, 'corrupted');

    // 3. Real non-empty ISO + matching sha256 + metadata.json
    const validDir = path.join(tmpBase, 'valid');
    fs.mkdirSync(validDir, { recursive: true });
    const samplePayload = Buffer.from('GTEMS-ISO-TEST-HEADER-9660');
    const expectedSha = crypto.createHash('sha256').update(samplePayload).digest('hex');
    const isoPath = path.join(validDir, 'GTEMS-OS.iso');
    fs.writeFileSync(isoPath, samplePayload);
    fs.writeFileSync(isoPath + '.sha256', `${expectedSha}  GTEMS-OS.iso\n`);
    fs.writeFileSync(
      path.join(validDir, 'metadata.json'),
      JSON.stringify({ version: '1.0 Aurora', architecture: 'amd64 (x86_64)', sha256: expectedSha })
    );

    const validMeta = await getPublishedIsoMetadata(validDir);
    assert.equal(validMeta.available, true);
    assert.equal(validMeta.status, 'available');
    assert.equal(validMeta.checksumVerified, true);
    assert.equal(validMeta.sha256, expectedSha);
    assert.equal(validMeta.sizeBytes, samplePayload.length);

    // 4. Tampered checksum -> corrupted
    fs.writeFileSync(isoPath + '.sha256', `${'0'.repeat(64)}  GTEMS-OS.iso\n`);
    const badMeta = await getPublishedIsoMetadata(validDir);
    assert.equal(badMeta.available, false);
    assert.equal(badMeta.status, 'corrupted');

    // 5. Path traversal & extension confinement
    assert.throws(() => resolveIsoFilePath('../etc/passwd', validDir));
    assert.throws(() => resolveIsoFilePath('GTEMS-OS.txt', validDir));
    assert.equal(resolveIsoFilePath('GTEMS-OS.iso', validDir), isoPath);
  } finally {
    fs.rmSync(tmpBase, { recursive: true, force: true });
  }
});

