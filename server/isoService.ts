import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_ISO_DIR = path.resolve(process.cwd(), '.gtems-iso/published');

export interface IsoToolchainStatus {
  xorriso: boolean;
  grubMkrescue: boolean;
  mksquashfs: boolean;
  debootstrap: boolean;
  liveBuild: boolean;
  qemuX64: boolean;
  missing: string[];
}

export interface IsoReleaseMetadata {
  available: boolean;
  status: 'available' | 'unavailable' | 'corrupted';
  name: string;
  filename: string | null;
  version: string;
  architecture: string;
  sizeBytes: number;
  sizeFormatted: string;
  buildDate: string | null;
  publishDate: string | null;
  bootCompatibility: string;
  sha256: string | null;
  checksumVerified: boolean;
  channel: string;
  downloadUrl: string | null;
  reason: string;
  missingToolchain: string[];
}

interface CompanionManifest {
  name?: string;
  version?: string;
  architecture?: string;
  buildDate?: string;
  publishDate?: string;
  bootCompatibility?: string;
  channel?: string;
  sha256?: string;
}

const shaCache = new Map<string, { key: string; sha256: string }>();

function hasExecutableInPath(cmd: string): boolean {
  const pathEnv = process.env.PATH || '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin';
  for (const dir of pathEnv.split(path.delimiter)) {
    if (!dir) continue;
    const candidate = path.join(dir, cmd);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      const stat = fs.statSync(candidate);
      if (stat.isFile()) return true;
    } catch {
      // continue searching PATH
    }
  }
  return false;
}

export function probeHostIsoToolchain(): IsoToolchainStatus {
  const xorriso = hasExecutableInPath('xorriso');
  const grubMkrescue = hasExecutableInPath('grub-mkrescue');
  const mksquashfs = hasExecutableInPath('mksquashfs');
  const debootstrap = hasExecutableInPath('debootstrap');
  const liveBuild = hasExecutableInPath('lb');
  const qemuX64 = hasExecutableInPath('qemu-system-x86_64');

  const missing: string[] = [];
  if (!debootstrap) missing.push('debootstrap');
  if (!mksquashfs) missing.push('squashfs-tools (mksquashfs)');
  if (!xorriso) missing.push('xorriso');
  if (!grubMkrescue) missing.push('grub-mkrescue');
  if (!qemuX64) missing.push('qemu-system-x86_64');

  return {
    xorriso,
    grubMkrescue,
    mksquashfs,
    debootstrap,
    liveBuild,
    qemuX64,
    missing,
  };
}

export function formatIsoSize(bytes: number): string {
  if (bytes <= 0) return '0 B';
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GiB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MiB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${bytes} B`;
}

export function resolveIsoFilePath(filename: string, baseDir = DEFAULT_ISO_DIR): string {
  if (!filename || typeof filename !== 'string') {
    throw new Error('Nombre de archivo ISO inválido.');
  }
  if (filename.includes('/') || filename.includes('\\') || filename.includes('\0') || filename.includes('..')) {
    throw new Error('Acceso denegado: nombre de archivo ISO fuera de límites permitidos.');
  }
  const cleanName = path.basename(filename);
  if (!cleanName.toLowerCase().endsWith('.iso')) {
    throw new Error('Solo se permiten descargas de archivos .iso.');
  }
  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(resolvedBase, cleanName);
  if (!resolvedTarget.startsWith(resolvedBase + path.sep)) {
    throw new Error('Acceso denegado: ruta fuera del directorio publicado de ISOs.');
  }
  return resolvedTarget;
}

export async function computeFileSha256(absPath: string): Promise<string> {
  const stat = fs.statSync(absPath);
  const cacheKey = `${stat.mtimeMs}:${stat.size}`;
  const cached = shaCache.get(absPath);
  if (cached && cached.key === cacheKey) {
    return cached.sha256;
  }

  const hash = crypto.createHash('sha256');
  await new Promise<void>((resolve, reject) => {
    const stream = fs.createReadStream(absPath, { highWaterMark: 1024 * 1024 });
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve());
    stream.on('error', (err) => reject(err));
  });
  const digest = hash.digest('hex');
  shaCache.set(absPath, { key: cacheKey, sha256: digest });
  return digest;
}

function readOptionalSha256Sidecar(isoAbsPath: string): string | null {
  const candidates = [`${isoAbsPath}.sha256`, path.join(path.dirname(isoAbsPath), 'SHA256SUMS')];
  const base = path.basename(isoAbsPath);
  for (const cand of candidates) {
    if (!fs.existsSync(cand)) continue;
    try {
      const raw = fs.readFileSync(cand, 'utf8');
      for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const match = trimmed.match(/^([a-fA-F0-9]{64})(?:\s+\*?(.+))?$/);
        if (match) {
          if (!match[2] || path.basename(match[2].trim()) === base) {
            return match[1].toLowerCase();
          }
        }
      }
    } catch {
      // ignore unreadable sidecar
    }
  }
  return null;
}

function readCompanionManifest(baseDir: string): CompanionManifest | null {
  const manifestPath = path.join(baseDir, 'metadata.json');
  if (!fs.existsSync(manifestPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as CompanionManifest;
  } catch {
    return null;
  }
}

export async function getPublishedIsoMetadata(baseDir = DEFAULT_ISO_DIR): Promise<IsoReleaseMetadata> {
  const resolvedDir = path.resolve(baseDir);
  const toolchain = probeHostIsoToolchain();

  if (!fs.existsSync(resolvedDir)) {
    return {
      available: false,
      status: 'unavailable',
      name: 'GTEMS OS 1.0 Aurora',
      filename: null,
      version: '1.0 Aurora',
      architecture: 'amd64 (x86_64)',
      sizeBytes: 0,
      sizeFormatted: '0 B',
      buildDate: null,
      publishDate: null,
      bootCompatibility: 'BIOS Legacy + UEFI (Híbrido El Torito / GRUB2)',
      sha256: null,
      checksumVerified: false,
      channel: 'estable',
      downloadUrl: null,
      reason:
        'Aún no hay una imagen .iso compilada y publicada en el servidor (.gtems-iso/published). Ejecuta "make build-iso" en un entorno Debian con privilegios de compilación.',
      missingToolchain: toolchain.missing,
    };
  }

  const files = fs
    .readdirSync(resolvedDir)
    .filter((f) => f.toLowerCase().endsWith('.iso'))
    .sort((a, b) => {
      if (a === 'GTEMS-OS.iso') return -1;
      if (b === 'GTEMS-OS.iso') return 1;
      return b.localeCompare(a);
    });

  if (files.length === 0) {
    return {
      available: false,
      status: 'unavailable',
      name: 'GTEMS OS 1.0 Aurora',
      filename: null,
      version: '1.0 Aurora',
      architecture: 'amd64 (x86_64)',
      sizeBytes: 0,
      sizeFormatted: '0 B',
      buildDate: null,
      publishDate: null,
      bootCompatibility: 'BIOS Legacy + UEFI (Híbrido El Torito / GRUB2)',
      sha256: null,
      checksumVerified: false,
      channel: 'estable',
      downloadUrl: null,
      reason:
        'No se encontró ningún archivo .iso publicado en .gtems-iso/published. Compila y valida la imagen con "make build-iso validate-iso".',
      missingToolchain: toolchain.missing,
    };
  }

  const chosenName = files[0];
  const absPath = resolveIsoFilePath(chosenName, resolvedDir);
  const stat = fs.statSync(absPath);

  if (!stat.isFile() || stat.size === 0) {
    return {
      available: false,
      status: 'corrupted',
      name: 'GTEMS OS 1.0 Aurora',
      filename: chosenName,
      version: '1.0 Aurora',
      architecture: 'amd64 (x86_64)',
      sizeBytes: stat.size,
      sizeFormatted: formatIsoSize(stat.size),
      buildDate: null,
      publishDate: null,
      bootCompatibility: 'BIOS Legacy + UEFI (Híbrido El Torito / GRUB2)',
      sha256: null,
      checksumVerified: false,
      channel: 'estable',
      downloadUrl: null,
      reason: `El archivo ${chosenName} está vacío (0 bytes) o es inválido; la descarga fue bloqueada por seguridad.`,
      missingToolchain: toolchain.missing,
    };
  }

  const manifest = readCompanionManifest(resolvedDir);
  const actualSha = await computeFileSha256(absPath);
  const expectedSha = readOptionalSha256Sidecar(absPath) || manifest?.sha256?.toLowerCase() || null;

  if (expectedSha && expectedSha !== actualSha) {
    return {
      available: false,
      status: 'corrupted',
      name: manifest?.name || 'GTEMS OS 1.0 Aurora',
      filename: chosenName,
      version: manifest?.version || '1.0 Aurora',
      architecture: manifest?.architecture || 'amd64 (x86_64)',
      sizeBytes: stat.size,
      sizeFormatted: formatIsoSize(stat.size),
      buildDate: manifest?.buildDate || stat.mtime.toISOString(),
      publishDate: manifest?.publishDate || stat.mtime.toISOString(),
      bootCompatibility: manifest?.bootCompatibility || 'BIOS Legacy + UEFI (Híbrido El Torito / GRUB2)',
      sha256: actualSha,
      checksumVerified: false,
      channel: manifest?.channel || 'estable',
      downloadUrl: null,
      reason: `La suma SHA-256 real (${actualSha.slice(0, 12)}…) no coincide con el manifiesto esperado (${expectedSha.slice(0, 12)}…).`,
      missingToolchain: toolchain.missing,
    };
  }

  return {
    available: true,
    status: 'available',
    name: manifest?.name || 'GTEMS OS 1.0 Aurora',
    filename: chosenName,
    version: manifest?.version || '1.0 Aurora',
    architecture: manifest?.architecture || 'amd64 (x86_64)',
    sizeBytes: stat.size,
    sizeFormatted: formatIsoSize(stat.size),
    buildDate: manifest?.buildDate || stat.mtime.toISOString(),
    publishDate: manifest?.publishDate || stat.mtime.toISOString(),
    bootCompatibility: manifest?.bootCompatibility || 'BIOS Legacy + UEFI (Híbrido El Torito / GRUB2)',
    sha256: actualSha,
    checksumVerified: Boolean(expectedSha && expectedSha === actualSha),
    channel: manifest?.channel || 'estable',
    downloadUrl: `/api/system/iso/download?file=${encodeURIComponent(chosenName)}`,
    reason: expectedSha
      ? 'Imagen ISO verificada mediante SHA-256 y lista para descarga directa.'
      : 'Imagen ISO publicada en el servidor (SHA-256 calculado en tiempo real; sin archivo .sha256 complementario).',
    missingToolchain: toolchain.missing,
  };
}
