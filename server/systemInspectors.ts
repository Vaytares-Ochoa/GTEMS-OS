import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import dns from 'node:dns/promises';
import net from 'node:net';
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import type { BrowserRegistryItem, CodeRuntimeInfo } from '../src/lib/types';

const execFileAsync = promisify(execFile);

async function safeExecFile(bin: string, args: string[], timeout = 4000): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(bin, args, { timeout, maxBuffer: 1024 * 1024 });
    return stdout.trim();
  } catch (err) {
    const out = (err as { stdout?: string })?.stdout;
    return out && out.trim() ? out.trim() : null;
  }
}

export async function getRealHardwareSpecs() {
  const cpus = os.cpus();
  const cpuModelRaw = cpus[0]?.model && cpus[0].model !== 'unknown' ? cpus[0].model : null;
  let cpuinfoModel: string | null = null;
  let cpuVendor: string | null = null;
  let cpuMhz: number | null = cpus[0]?.speed || null;

  if (fs.existsSync('/proc/cpuinfo')) {
    const info = fs.readFileSync('/proc/cpuinfo', 'utf8');
    const vendorMatch = info.match(/vendor_id\s*:\s*(.+)/);
    const modelMatch = info.match(/model name\s*:\s*(.+)/);
    const mhzMatch = info.match(/cpu MHz\s*:\s*(.+)/);
    if (vendorMatch) cpuVendor = vendorMatch[1].trim();
    if (modelMatch && modelMatch[1].trim() !== 'unknown') cpuinfoModel = modelMatch[1].trim();
    if (mhzMatch) cpuMhz = Math.round(parseFloat(mhzMatch[1]));
  }

  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  const dfOut = await safeExecFile('df', ['-B1', '-T']);
  const storagePartitions: Array<{
    filesystem: string;
    type: string;
    sizeBytes: number;
    usedBytes: number;
    availBytes: number;
    usePercent: string;
    mount: string;
  }> = [];

  if (dfOut) {
    const lines = dfOut.split('\n').slice(1);
    for (const line of lines) {
      const cols = line.trim().split(/\s+/);
      if (cols.length >= 7) {
        storagePartitions.push({
          filesystem: cols[0],
          type: cols[1],
          sizeBytes: Number(cols[2]) || 0,
          usedBytes: Number(cols[3]) || 0,
          availBytes: Number(cols[4]) || 0,
          usePercent: cols[5],
          mount: cols[6],
        });
      }
    }
  }

  let gpuInfo = 'Información no disponible';
  if (fs.existsSync('/sys/class/drm')) {
    const drmCards = fs.readdirSync('/sys/class/drm').filter((c) => /^card\d+$/.test(c));
    if (drmCards.length > 0) {
      gpuInfo = `Adaptador DRM detectado (${drmCards.join(', ')})`;
    }
  }

  let distroName = 'Debian GNU/Linux';
  if (fs.existsSync('/etc/os-release')) {
    const osRel = fs.readFileSync('/etc/os-release', 'utf8');
    const pretty = osRel.match(/PRETTY_NAME="([^"]+)"/);
    if (pretty) distroName = pretty[1];
  }

  const batteryPresent =
    fs.existsSync('/sys/class/power_supply') &&
    fs.readdirSync('/sys/class/power_supply').some((n) => n.startsWith('BAT'));

  return {
    hostname: os.hostname(),
    processor: {
      vendor: cpuVendor || 'Información no disponible',
      model: cpuinfoModel || cpuModelRaw || `Procesador ${os.arch()} (modelo oculto por hipervisor)`,
      architecture: os.arch(),
      cores: cpus.length,
      frequencyMhz: cpuMhz || null,
    },
    memory: {
      totalBytes: totalMem,
      usedBytes: usedMem,
      freeBytes: freeMem,
    },
    gpu: gpuInfo,
    storage: storagePartitions,
    batteryPresent,
    systemType: {
      arch: os.arch(),
      kernelVersion: `${os.type()} ${os.release()}`,
      hostPlatform: distroName,
      uptimeSeconds: Math.floor(os.uptime()),
    },
  };
}

export async function getRealProcesses() {
  const out = await safeExecFile('ps', ['-eo', 'pid,ppid,user,pcpu,pmem,etime,comm', '--sort=-pcpu']);
  if (!out) return [];
  const lines = out.split('\n').slice(1);
  return lines.slice(0, 80).map((line) => {
    const parts = line.trim().split(/\s+/);
    const pid = Number(parts[0]);
    const ppid = Number(parts[1]);
    const user = parts[2] || 'unknown';
    const cpu = parseFloat(parts[3] || '0');
    const mem = parseFloat(parts[4] || '0');
    const elapsed = parts[5] || '00:00';
    const command = parts.slice(6).join(' ');
    return { pid, ppid, user, cpu, mem, elapsed, command };
  });
}

export async function getRealNetworkStatus() {
  const ifaces = os.networkInterfaces();
  const interfaces = Object.entries(ifaces).map(([name, addrs]) => ({
    name,
    isWireless: name.startsWith('wl'),
    isLoopback: name === 'lo',
    addresses: (addrs || []).map((a) => ({
      address: a.address,
      family: a.family,
      netmask: a.netmask,
      mac: a.mac,
      internal: a.internal,
    })),
  }));

  const wifiAdapters = interfaces.filter((i) => i.isWireless);
  let dnsServers: string[] = [];
  if (fs.existsSync('/etc/resolv.conf')) {
    const resolv = fs.readFileSync('/etc/resolv.conf', 'utf8');
    dnsServers = resolv
      .split('\n')
      .filter((l) => l.trim().startsWith('nameserver'))
      .map((l) => l.trim().split(/\s+/)[1])
      .filter(Boolean);
  }

  const routeOut = await safeExecFile('ip', ['route', 'show', 'default']);
  const gatewayMatch = routeOut?.match(/default via ([^\s]+)/);

  return {
    interfaces,
    wifiHardwarePresent: wifiAdapters.length > 0,
    wifiStatusMessage:
      wifiAdapters.length > 0
        ? `Adaptador Wi-Fi activo: ${wifiAdapters.map((w) => w.name).join(', ')}`
        : 'Sin adaptador Wi-Fi físico detectado en este entorno (conectividad mediante interfaz de red del anfitrión).',
    dnsServers,
    gateway: gatewayMatch ? gatewayMatch[1] : 'Información no disponible',
  };
}

export async function getRealDevices() {
  const devices: Array<{
    name: string;
    manufacturer: string;
    type: string;
    status: string;
    driver: string;
    port: string;
    details: string;
  }> = [];

  const ifaces = os.networkInterfaces();
  for (const [name, addrs] of Object.entries(ifaces)) {
    devices.push({
      name: `Adaptador de red ${name}`,
      manufacturer: 'Kernel Linux Netdev',
      type: name.startsWith('wl') ? 'Wi-Fi' : name === 'lo' ? 'Loopback' : 'Ethernet / Red',
      status: 'Conectado',
      driver: 'linux-net',
      port: `/sys/class/net/${name}`,
      details: (addrs || []).map((a) => a.address).join(', '),
    });
  }

  const lsblkOut = await safeExecFile('lsblk', ['-J', '-o', 'NAME,SIZE,TYPE,MOUNTPOINT,MODEL']);
  if (lsblkOut) {
    try {
      const parsed = JSON.parse(lsblkOut);
      for (const blk of parsed.blockdevices || []) {
        devices.push({
          name: blk.model || blk.name,
          manufacturer: 'Subsistema de Bloques Linux',
          type: `Almacenamiento (${blk.type})`,
          status: blk.mountpoint ? `Montado en ${blk.mountpoint}` : 'Disponible',
          driver: 'block',
          port: `/dev/${blk.name}`,
          details: `Capacidad: ${blk.size}`,
        });
      }
    } catch {
      // ignore
    }
  }

  const usbAvailable = fs.existsSync('/sys/bus/usb/devices');
  if (usbAvailable) {
    const usbDevs = fs.readdirSync('/sys/bus/usb/devices');
    for (const u of usbDevs) {
      devices.push({
        name: `Dispositivo USB (${u})`,
        manufacturer: 'USB Host Controller',
        type: 'USB',
        status: 'Detectado',
        driver: 'usbcore',
        port: `/sys/bus/usb/devices/${u}`,
        details: 'Bus USB del kernel',
      });
    }
  }

  const soundAvailable = fs.existsSync('/sys/class/sound');
  if (soundAvailable) {
    const soundCards = fs.readdirSync('/sys/class/sound');
    for (const s of soundCards) {
      devices.push({
        name: `Audio (${s})`,
        manufacturer: 'ALSA / Linux Sound',
        type: 'Audio',
        status: 'Disponible',
        driver: 'snd',
        port: `/dev/snd/${s}`,
        details: 'Dispositivo de audio del sistema',
      });
    }
  }

  return {
    devices,
    capabilities: {
      usbBusPresent: usbAvailable,
      soundBusPresent: soundAvailable,
      bluetoothPresent: fs.existsSync('/sys/class/bluetooth'),
      batteryPresent:
        fs.existsSync('/sys/class/power_supply') &&
        fs.readdirSync('/sys/class/power_supply').some((n) => n.startsWith('BAT')),
      drmPresent: fs.existsSync('/sys/class/drm'),
    },
  };
}

export async function getChromeAvailability() {
  const candidates = [
    { label: 'Google Chrome Oficial', path: '/usr/bin/google-chrome' },
    { label: 'Google Chrome Stable', path: '/opt/google/chrome/chrome' },
    { label: 'Chromium', path: '/usr/bin/chromium' },
    { label: 'Chromium Browser', path: '/usr/bin/chromium-browser' },
    { label: 'Motor Chromium Headless (Evaluación)', path: '/ms-playwright/chrome-headless-shell-linux64/chrome-headless-shell' },
  ];

  const found = candidates.filter((c) => fs.existsSync(c.path));
  const officialChrome = found.find((f) => f.label.startsWith('Google Chrome')) || null;
  const chromiumEngine = found.find((f) => !f.label.startsWith('Google Chrome')) || null;

  return {
    officialChromeInstalled: Boolean(officialChrome),
    officialChromePath: officialChrome?.path || null,
    chromiumEngineInstalled: Boolean(chromiumEngine),
    chromiumEnginePath: chromiumEngine?.path || null,
    chromiumEngineLabel: chromiumEngine?.label || null,
    notice: officialChrome
      ? 'Google Chrome oficial detectado en el sistema anfitrión.'
      : 'Google Chrome oficial no está instalado en este contenedor Linux. Se detectó únicamente el motor Chromium sin interfaz gráfica local (X11/Wayland). Puede abrir enlaces en el navegador de su equipo o realizar consultas HTTP/HTTPS reales desde el servidor.',
  };
}

async function detectFirstBinary(paths: string[], versionArgs = ['--version']): Promise<{ path: string; version: string | null } | null> {
  for (const p of paths) {
    if (fs.existsSync(p)) {
      const ver = await safeExecFile(p, versionArgs, 2000);
      return { path: p, version: ver ? ver.split('\n')[0].trim() : null };
    }
  }
  return null;
}

export async function getBrowserRegistry(defaultBrowser: BrowserRegistryItem['id'] = 'gtems-browser'): Promise<BrowserRegistryItem[]> {
  const chrome = await detectFirstBinary([
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/opt/google/chrome/chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ]);
  const headless = fs.existsSync('/ms-playwright/chrome-headless-shell-linux64/chrome-headless-shell')
    ? '/ms-playwright/chrome-headless-shell-linux64/chrome-headless-shell'
    : null;
  const firefox = await detectFirstBinary(['/usr/bin/firefox', '/usr/bin/firefox-esr']);
  const edge = await detectFirstBinary(['/usr/bin/microsoft-edge', '/usr/bin/microsoft-edge-stable']);
  const opera = await detectFirstBinary(['/usr/bin/opera', '/usr/local/bin/opera']);

  return [
    {
      id: 'gtems-browser',
      name: 'GTEMS Browser (Integrado)',
      installed: true,
      supportedOnLinux: true,
      executablePath: headless || 'gtems-http-engine',
      version: 'GTEMS Web Engine 1.0',
      profilesSupported: true,
      statusNote: 'Integrado en GTEMS OS con consultas HTTP/HTTPS reales, marcadores, historial y descargas.',
      isDefault: defaultBrowser === 'gtems-browser',
    },
    {
      id: 'chrome',
      name: 'Google Chrome',
      installed: Boolean(chrome),
      supportedOnLinux: true,
      executablePath: chrome?.path || null,
      version: chrome?.version || null,
      profilesSupported: Boolean(chrome),
      statusNote: chrome
        ? `Binario Linux detectado en ${chrome.path}.`
        : headless
        ? `Google Chrome gráfico no está instalado en este contenedor Linux (solo motor headless ${headless}). Puedes abrir enlaces externos en el navegador del anfitrión.`
        : 'No instalado en el contenedor Linux (paquete google-chrome-stable ausente).',
      isDefault: defaultBrowser === 'chrome',
    },
    {
      id: 'firefox',
      name: 'Mozilla Firefox',
      installed: Boolean(firefox),
      supportedOnLinux: true,
      executablePath: firefox?.path || null,
      version: firefox?.version || null,
      profilesSupported: Boolean(firefox),
      statusNote: firefox
        ? `Binario Linux detectado en ${firefox.path}.`
        : 'No instalado en este sistema Linux (disponible vía APT: firefox-esr).',
      isDefault: defaultBrowser === 'firefox',
    },
    {
      id: 'edge',
      name: 'Microsoft Edge',
      installed: Boolean(edge),
      supportedOnLinux: true,
      executablePath: edge?.path || null,
      version: edge?.version || null,
      profilesSupported: Boolean(edge),
      statusNote: edge
        ? `Binario Linux detectado en ${edge.path}.`
        : 'No instalado en este sistema Linux (paquete microsoft-edge-stable ausente).',
      isDefault: defaultBrowser === 'edge',
    },
    {
      id: 'opera',
      name: 'Opera',
      installed: Boolean(opera),
      supportedOnLinux: true,
      executablePath: opera?.path || null,
      version: opera?.version || null,
      profilesSupported: Boolean(opera),
      statusNote: opera
        ? `Binario Linux detectado en ${opera.path}.`
        : 'No instalado en este sistema Linux (paquete opera-stable ausente).',
      isDefault: defaultBrowser === 'opera',
    },
    {
      id: 'safari',
      name: 'Safari',
      installed: false,
      supportedOnLinux: false,
      executablePath: null,
      version: null,
      profilesSupported: false,
      statusNote: 'Incompatible con Linux: Apple Safari solo se distribuye oficialmente para macOS/iOS y no existe versión nativa soportada para Debian/Linux.',
      isDefault: false,
    },
  ];
}

export async function getCodeRuntimes(): Promise<CodeRuntimeInfo[]> {
  const py = await detectFirstBinary(['/usr/bin/python3', '/usr/local/bin/python3']);
  const nodeVer = process.version;
  const tscBin = path.resolve(process.cwd(), 'node_modules/.bin/tsc');
  const tsxBin = path.resolve(process.cwd(), 'node_modules/.bin/tsx');
  const tsInstalled = fs.existsSync(tsxBin) || fs.existsSync(tscBin);
  const tsVer = fs.existsSync(tscBin) ? await safeExecFile(tscBin, ['--version'], 2000) : null;
  const gpp = await detectFirstBinary(['/usr/bin/g++', '/usr/local/bin/g++']);
  const gcc = await detectFirstBinary(['/usr/bin/gcc', '/usr/local/bin/gcc']);
  const sqliteCli = await detectFirstBinary(['/usr/bin/sqlite3']);
  const pySqliteVer = py ? await safeExecFile(py.path, ['-c', 'import sqlite3; print(sqlite3.sqlite_version)'], 2000) : null;
  const javac = await detectFirstBinary(['/usr/bin/javac', '/usr/local/bin/javac'], ['-version']);
  const dotnet = await detectFirstBinary(['/usr/bin/dotnet', '/usr/local/bin/dotnet']);
  const bash = await detectFirstBinary(['/bin/bash', '/usr/bin/bash']);

  return [
    {
      language: 'python',
      label: 'Python 3',
      toolName: 'python3',
      installed: Boolean(py),
      binaryPath: py?.path || null,
      version: py?.version || null,
      aptPackage: 'python3',
      note: py ? 'Intérprete Python 3 real operativo.' : 'No instalado.',
    },
    {
      language: 'javascript',
      label: 'JavaScript',
      toolName: 'Node.js',
      installed: true,
      binaryPath: process.execPath,
      version: `Node ${nodeVer}`,
      aptPackage: 'nodejs',
      note: 'Motor V8 Node.js nativo operativo.',
    },
    {
      language: 'typescript',
      label: 'TypeScript',
      toolName: 'tsc / tsx',
      installed: tsInstalled,
      binaryPath: fs.existsSync(tsxBin) ? tsxBin : fs.existsSync(tscBin) ? tscBin : null,
      version: tsVer || (tsInstalled ? 'TypeScript Runtime' : null),
      aptPackage: 'node-typescript',
      note: tsInstalled ? 'Compilación y ejecución real mediante tsc/tsx.' : 'Compilador TypeScript no encontrado.',
    },
    {
      language: 'cpp',
      label: 'C++',
      toolName: 'g++ (GCC)',
      installed: Boolean(gpp),
      binaryPath: gpp?.path || null,
      version: gpp?.version || null,
      aptPackage: 'g++',
      note: gpp ? 'Compilación nativa ELF C++17 y ejecución en proceso aislado.' : 'Compilador g++ no instalado.',
    },
    {
      language: 'c',
      label: 'C',
      toolName: 'gcc',
      installed: Boolean(gcc),
      binaryPath: gcc?.path || null,
      version: gcc?.version || null,
      aptPackage: 'gcc',
      note: gcc ? 'Compilación nativa C y ejecución en proceso aislado.' : 'Compilador gcc no instalado.',
    },
    {
      language: 'sql',
      label: 'SQL (SQLite)',
      toolName: sqliteCli ? 'sqlite3 CLI' : 'SQLite C (vía Python sqlite3)',
      installed: Boolean(sqliteCli || pySqliteVer),
      binaryPath: sqliteCli?.path || py?.path || null,
      version: sqliteCli?.version || (pySqliteVer ? `SQLite ${pySqliteVer}` : null),
      aptPackage: 'sqlite3',
      note: sqliteCli
        ? 'Motor SQLite3 nativo.'
        : pySqliteVer
        ? `Motor real libsqlite3 ${pySqliteVer} ejecutado mediante módulo nativo Python sqlite3.`
        : 'Motor SQLite no instalado.',
    },
    {
      language: 'bash',
      label: 'Bash / Shell',
      toolName: 'GNU Bash',
      installed: Boolean(bash),
      binaryPath: bash?.path || null,
      version: bash?.version || null,
      aptPackage: 'bash',
      note: 'Intérprete Bash nativo.',
    },
    {
      language: 'java',
      label: 'Java',
      toolName: 'JDK (javac / java)',
      installed: Boolean(javac),
      binaryPath: javac?.path || null,
      version: javac?.version || null,
      aptPackage: 'default-jdk',
      note: javac
        ? 'JDK instalado y operativo.'
        : 'JDK (javac) no está instalado en este contenedor Linux. Instala "default-jdk" vía APT para habilitar compilación Java.',
    },
    {
      language: 'csharp',
      label: 'C#',
      toolName: '.NET SDK (dotnet)',
      installed: Boolean(dotnet),
      binaryPath: dotnet?.path || null,
      version: dotnet?.version || null,
      aptPackage: 'dotnet-sdk-8.0',
      note: dotnet
        ? '.NET SDK instalado y operativo.'
        : '.NET SDK no está instalado en este contenedor Linux. Instala "dotnet-sdk-8.0" para compilar C#.',
    },
  ];
}

const activeCodeProcesses = new Map<string, ChildProcess>();

function spawnCollected(
  runId: string,
  bin: string,
  args: string[],
  cwd: string,
  timeoutMs = 10000
): Promise<{ stdout: string; stderr: string; exitCode: number; timedOut: boolean; killed: boolean }> {
  return new Promise((resolve) => {
    const child = spawn(bin, args, { cwd, shell: false });
    activeCodeProcesses.set(runId, child);
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let killed = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 600);
    }, timeoutMs);

    child.stdout?.on('data', (d) => {
      stdout += d.toString('utf8');
      if (stdout.length > 64000) stdout = stdout.slice(-64000);
    });
    child.stderr?.on('data', (d) => {
      stderr += d.toString('utf8');
      if (stderr.length > 32000) stderr = stderr.slice(-32000);
    });

    child.on('close', (code, signal) => {
      clearTimeout(timer);
      activeCodeProcesses.delete(runId);
      if (signal === 'SIGTERM' || signal === 'SIGKILL') killed = !timedOut;
      resolve({
        stdout,
        stderr: timedOut ? `${stderr}\n[Proceso detenido tras exceder límite de ${timeoutMs / 1000}s]` : stderr,
        exitCode: code ?? (killed || timedOut ? 137 : 0),
        timedOut,
        killed,
      });
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      activeCodeProcesses.delete(runId);
      resolve({ stdout, stderr: err.message, exitCode: 127, timedOut: false, killed: false });
    });
  });
}

export function stopCodeRun(runId: string): boolean {
  const proc = activeCodeProcesses.get(runId);
  if (!proc) return false;
  proc.kill('SIGTERM');
  setTimeout(() => {
    if (activeCodeProcesses.has(runId)) proc.kill('SIGKILL');
  }, 500);
  return true;
}

export async function executeCodeRun(
  runId: string,
  language: CodeRuntimeInfo['language'],
  code: string
): Promise<{ stdout: string; stderr: string; exitCode: number; durationMs: number; compilerOutput?: string }> {
  const started = Date.now();
  const safeId = runId.replace(/[^a-zA-Z0-9_-]/g, '') || `run_${Date.now()}`;
  const runDir = path.resolve(process.cwd(), '.gtems-data/tmp-runs', safeId);
  fs.mkdirSync(runDir, { recursive: true });

  try {
    if (language === 'python') {
      const pyBin = fs.existsSync('/usr/bin/python3') ? '/usr/bin/python3' : 'python3';
      const file = path.join(runDir, 'main.py');
      fs.writeFileSync(file, code, 'utf8');
      const r = await spawnCollected(safeId, pyBin, ['-u', file], runDir);
      return { ...r, durationMs: Date.now() - started };
    }

    if (language === 'javascript') {
      const file = path.join(runDir, 'main.js');
      fs.writeFileSync(file, code, 'utf8');
      const r = await spawnCollected(safeId, process.execPath, [file], runDir);
      return { ...r, durationMs: Date.now() - started };
    }

    if (language === 'typescript') {
      const file = path.join(runDir, 'main.ts');
      fs.writeFileSync(file, code, 'utf8');
      const tsxBin = path.resolve(process.cwd(), 'node_modules/.bin/tsx');
      const tscBin = path.resolve(process.cwd(), 'node_modules/.bin/tsc');
      if (fs.existsSync(tscBin)) {
        const check = await spawnCollected(`${safeId}_tsc`, tscBin, ['--noEmit', '--target', 'ES2022', '--module', 'ESNext', file], runDir, 8000);
        if (check.exitCode !== 0) {
          return {
            stdout: check.stdout,
            stderr: check.stderr || 'Error de compilación TypeScript.',
            exitCode: check.exitCode,
            durationMs: Date.now() - started,
          };
        }
      }
      if (!fs.existsSync(tsxBin)) {
        return {
          stdout: '',
          stderr: 'No se encontró tsx para ejecutar TypeScript directamente.',
          exitCode: 127,
          durationMs: Date.now() - started,
        };
      }
      const r = await spawnCollected(safeId, tsxBin, [file], runDir);
      return { ...r, durationMs: Date.now() - started };
    }

    if (language === 'cpp' || language === 'c') {
      const compiler = language === 'cpp' ? '/usr/bin/g++' : '/usr/bin/gcc';
      if (!fs.existsSync(compiler)) {
        return {
          stdout: '',
          stderr: `Compilador ${path.basename(compiler)} no instalado en este sistema Linux.`,
          exitCode: 127,
          durationMs: Date.now() - started,
        };
      }
      const src = path.join(runDir, language === 'cpp' ? 'main.cpp' : 'main.c');
      const outBin = path.join(runDir, 'main.out');
      fs.writeFileSync(src, code, 'utf8');
      const args = language === 'cpp' ? ['-O2', '-std=c++17', src, '-o', outBin] : ['-O2', src, '-o', outBin];
      const comp = await spawnCollected(`${safeId}_comp`, compiler, args, runDir, 12000);
      if (comp.exitCode !== 0) {
        return {
          stdout: comp.stdout,
          stderr: comp.stderr,
          exitCode: comp.exitCode,
          durationMs: Date.now() - started,
          compilerOutput: comp.stderr,
        };
      }
      const execRes = await spawnCollected(safeId, outBin, [], runDir, 10000);
      return { ...execRes, durationMs: Date.now() - started, compilerOutput: 'Compilación exitosa (0 errores)' };
    }

    if (language === 'sql') {
      const sqlFile = path.join(runDir, 'query.sql');
      fs.writeFileSync(sqlFile, code, 'utf8');
      const pyRunner = `
import sqlite3, sys
sql = open(sys.argv[1], 'r', encoding='utf-8').read()
conn = sqlite3.connect(':memory:')
cur = conn.cursor()
statements = [s.strip() for s in sql.split(';') if s.strip()]
for stmt in statements:
    cur.execute(stmt)
    if cur.description:
        cols = [d[0] for d in cur.description]
        rows = cur.fetchall()
        print(' | '.join(cols))
        print('-' * (len(' | '.join(cols)) + 2))
        for r in rows:
            print(' | '.join(str(x) for x in r))
        print(f"({len(rows)} filas)\\n")
    else:
        print(f"OK ({cur.rowcount if cur.rowcount >= 0 else 0} filas afectadas)")
conn.commit()
`;
      const pyFile = path.join(runDir, 'run_sql.py');
      fs.writeFileSync(pyFile, pyRunner, 'utf8');
      const r = await spawnCollected(safeId, '/usr/bin/python3', [pyFile, sqlFile], runDir, 8000);
      return { ...r, durationMs: Date.now() - started };
    }

    if (language === 'bash') {
      const shFile = path.join(runDir, 'script.sh');
      fs.writeFileSync(shFile, code, 'utf8');
      const r = await spawnCollected(safeId, '/bin/bash', [shFile], runDir, 10000);
      return { ...r, durationMs: Date.now() - started };
    }

    if (language === 'java') {
      if (!fs.existsSync('/usr/bin/javac')) {
        return {
          stdout: '',
          stderr: 'Java JDK (javac) no está instalado en este contenedor Linux. Instala "default-jdk" en el Gestor de Paquetes APT.',
          exitCode: 127,
          durationMs: Date.now() - started,
        };
      }
      const javaFile = path.join(runDir, 'Main.java');
      fs.writeFileSync(javaFile, code, 'utf8');
      const comp = await spawnCollected(`${safeId}_javac`, '/usr/bin/javac', [javaFile], runDir, 12000);
      if (comp.exitCode !== 0) return { ...comp, durationMs: Date.now() - started };
      const r = await spawnCollected(safeId, '/usr/bin/java', ['-cp', runDir, 'Main'], runDir, 10000);
      return { ...r, durationMs: Date.now() - started };
    }

    if (language === 'csharp') {
      if (!fs.existsSync('/usr/bin/dotnet')) {
        return {
          stdout: '',
          stderr: '.NET SDK (dotnet) no está instalado en este contenedor Linux. Se requiere instalar dotnet-sdk-8.0 para compilar C#.',
          exitCode: 127,
          durationMs: Date.now() - started,
        };
      }
    }

    return {
      stdout: '',
      stderr: `Lenguaje no soportado para ejecución directa: ${language}`,
      exitCode: 1,
      durationMs: Date.now() - started,
    };
  } finally {
    try {
      fs.rmSync(runDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup error
    }
  }
}

export async function getInstalledDebianPackages(query = '') {
  const out = await safeExecFile('dpkg-query', ['-W', '-f=${Package}\t${Version}\t${Installed-Size}\t${binary:Summary}\n']);
  if (!out) return [];
  const q = query.trim().toLowerCase();
  const rows = out
    .split('\n')
    .map((line) => {
      const [name, version, sizeKb, summary] = line.split('\t');
      return { name, version, sizeKb: Number(sizeKb) || 0, summary: summary || '' };
    })
    .filter((p) => !q || p.name.toLowerCase().includes(q) || p.summary.toLowerCase().includes(q));
  return rows.slice(0, 120);
}

export function isPrivateOrLoopbackHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (lower === 'localhost' || lower.endsWith('.local') || lower === 'metadata.google.internal') {
    return true;
  }
  const ipVersion = net.isIP(lower);
  if (ipVersion === 4) {
    const parts = lower.split('.').map(Number);
    if (parts[0] === 127 || parts[0] === 10 || parts[0] === 0) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
  }
  if (ipVersion === 6) {
    if (lower === '::1' || lower.startsWith('fe80:') || lower.startsWith('fc') || lower.startsWith('fd')) {
      return true;
    }
  }
  return false;
}

export async function validatePublicHttpUrl(rawUrl: string): Promise<URL> {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Solo se permiten protocolos HTTP y HTTPS.');
  }
  if (isPrivateOrLoopbackHost(parsed.hostname)) {
    throw new Error('Acceso bloqueado por seguridad a direcciones locales o privadas.');
  }
  try {
    const resolved = await dns.lookup(parsed.hostname);
    if (isPrivateOrLoopbackHost(resolved.address)) {
      throw new Error('El dominio resuelve a una dirección interna bloqueada.');
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('bloqueada')) throw err;
  }
  return parsed;
}

export async function runNetworkDiagnostic(host: string) {
  const cleanHost = host.trim();
  if (!/^[a-zA-Z0-9.-]{1,120}$/.test(cleanHost)) {
    throw new Error('Nombre de host o IP inválido.');
  }
  if (isPrivateOrLoopbackHost(cleanHost)) {
    throw new Error('Diagnóstico restringido para direcciones internas/loopback.');
  }

  let dnsIps: string[] = [];
  let dnsError: string | null = null;
  try {
    dnsIps = await dns.resolve4(cleanHost);
  } catch (err) {
    dnsError = err instanceof Error ? err.message : 'Error DNS';
  }

  const pingOut = await safeExecFile('ping', ['-c', '2', '-W', '2', cleanHost], 6000);
  return {
    host: cleanHost,
    dnsResolved: dnsIps,
    dnsError,
    pingOutput: pingOut || 'Sin respuesta ICMP (el entorno puede restringir paquetes ICMP salientes).',
  };
}

export async function executeRealBashCommand(
  command: string,
  cwd: string
): Promise<{ stdout: string; stderr: string; exitCode: number; newCwd: string }> {
  const gtemsBinDir = path.resolve(process.cwd(), 'GTEMS-OS/system/services');
  const fsRoot = path.resolve(process.cwd(), '.gtems-fs');
  const resolvedCwd = cwd && fs.existsSync(cwd) ? path.resolve(cwd) : fsRoot;

  const gtemsctlPath = path.join(gtemsBinDir, 'gtemsctl');
  if (fs.existsSync(gtemsctlPath)) {
    try { fs.chmodSync(gtemsctlPath, 0o755); } catch { /* ignore */ }
  }

  return new Promise((resolve) => {
    const marker = `__GTEMS_PWD_${Date.now()}__`;
    const wrapped = `${command}\n__ec=$?\nprintf "\\n${marker}%s\\n" "$PWD"\nexit $__ec`;

    const child = spawn('/bin/bash', ['-c', wrapped], {
      cwd: resolvedCwd,
      env: {
        ...process.env,
        PATH: `${gtemsBinDir}:${process.env.PATH || '/usr/local/bin:/usr/bin:/bin'}`,
        TERM: 'xterm-256color',
        GTEMS_OS_VERSION: '1.0 Aurora',
      },
      timeout: 12000,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
      if (stdout.length > 64000) stdout = stdout.slice(-64000);
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
      if (stderr.length > 32000) stderr = stderr.slice(-32000);
    });

    child.on('close', (code) => {
      let newCwd = resolvedCwd;
      const idx = stdout.lastIndexOf(marker);
      if (idx !== -1) {
        const after = stdout.slice(idx + marker.length).trim();
        if (after && fs.existsSync(after)) {
          newCwd = after;
        }
        stdout = stdout.slice(0, idx).replace(/\n$/, '');
      }
      resolve({
        stdout,
        stderr,
        exitCode: code ?? 0,
        newCwd,
      });
    });

    child.on('error', (err) => {
      resolve({
        stdout,
        stderr: err.message,
        exitCode: 1,
        newCwd: resolvedCwd,
      });
    });
  });
}
