import fs from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';
import type { FileEntry } from '../src/lib/types';
import { resolveFileExtension } from '../src/lib/gtemsIdentity';

export const FS_ROOT = path.resolve(process.cwd(), '.gtems-fs');
export const SYSTEM_SRC_ROOT = path.resolve(process.cwd(), 'GTEMS-OS');

const STANDARD_DIRS = [
  'Inicio',
  'Escritorio',
  'Documentos',
  'Descargas',
  'Imágenes',
  'Música',
  'Vídeos',
  'Proyectos',
  'Papelera',
];

function createSampleWavBuffer(): Buffer {
  const sampleRate = 22050;
  const durationSec = 0.8;
  const numSamples = Math.floor(sampleRate * durationSec);
  const dataSize = numSamples * 2;
  const buf = Buffer.alloc(44 + dataSize);

  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const env = Math.sin(Math.PI * (i / numSamples));
    const wave = (Math.sin(2 * Math.PI * 523.25 * t) * 0.45 + Math.sin(2 * Math.PI * 659.25 * t) * 0.35) * env;
    buf.writeInt16LE(Math.round(wave * 16000), 44 + i * 2);
  }
  return buf;
}

export function ensureFilesystemReady(): void {
  if (!fs.existsSync(FS_ROOT)) {
    fs.mkdirSync(FS_ROOT, { recursive: true });
  }
  for (const dir of STANDARD_DIRS) {
    const p = path.join(FS_ROOT, dir);
    if (!fs.existsSync(p)) {
      fs.mkdirSync(p, { recursive: true });
    }
  }

  const welcomeDoc = path.join(FS_ROOT, 'Documentos', 'Bienvenida_GTEMS_OS.md');
  if (!fs.existsSync(welcomeDoc)) {
    fs.writeFileSync(
      welcomeDoc,
      `# GTEMS OS 1.0 Aurora\n\n**Diseñado por cinco mentes, construido para el futuro.**\n\nEste archivo reside físicamente en el sistema de archivos del equipo dentro de \`Documentos/Bienvenida_GTEMS_OS.md\`.\n\n## Equipo de Desarrollo Oficial\n1. GLENDA SAMAHI ARDON ZELAYA\n2. TATIANA VAYTARES OCHOA AGUILAR\n3. CARLOS ROBERTO SUAZO\n4. EDER JOSUE CABRERA RAMOS\n5. MAYLON ASAEL SÁNCHEZ SOSA\n`,
      'utf8'
    );
  }

  const sampleHtml = path.join(FS_ROOT, 'Documentos', 'Ejemplo.html');
  if (!fs.existsSync(sampleHtml)) {
    fs.writeFileSync(
      sampleHtml,
      `<!doctype html>\n<html lang="es">\n<head><meta charset="utf-8"><title>Prueba GTEMS OS</title></head>\n<body style="font-family:sans-serif;padding:2rem;background:#F5FCFA;color:#0F272B">\n  <h1>GTEMS OS — Documento HTML</h1>\n  <p>Diseñado por cinco mentes, construido para el futuro.</p>\n</body>\n</html>\n`,
      'utf8'
    );
  }

  const sampleScript = path.join(FS_ROOT, 'Documentos', 'diagnostico_gtems.sh');
  if (!fs.existsSync(sampleScript)) {
    fs.writeFileSync(
      sampleScript,
      `#!/usr/bin/env bash\nuname -a\nfree -h\ndf -h /\n`,
      'utf8'
    );
  }

  // Seed starter real projects for GTEMS Code Studio
  const pySample = path.join(FS_ROOT, 'Proyectos', 'hola.py');
  if (!fs.existsSync(pySample)) {
    fs.writeFileSync(
      pySample,
      `import platform\nimport sys\n\nprint("GTEMS Code Studio — Python real activo")\nprint(f"Python: {sys.version.split()[0]} | Sistema: {platform.system()} {platform.machine()}")\ncuadrados = [n * n for n in range(1, 6)]\nprint("Cuadrados:", cuadrados)\n`,
      'utf8'
    );
  }

  const jsSample = path.join(FS_ROOT, 'Proyectos', 'app.js');
  if (!fs.existsSync(jsSample)) {
    fs.writeFileSync(
      jsSample,
      `const os = require('node:os');\n\nconsole.log('GTEMS Code Studio — Node.js', process.version);\nconsole.log('Host:', os.hostname(), '| Núcleos:', os.cpus().length);\n`,
      'utf8'
    );
  }

  const tsSample = path.join(FS_ROOT, 'Proyectos', 'saludo.ts');
  if (!fs.existsSync(tsSample)) {
    fs.writeFileSync(
      tsSample,
      `interface Sistema {\n  nombre: string;\n  version: string;\n}\n\nconst gtems: Sistema = { nombre: 'GTEMS OS', version: '1.0 Aurora' };\nconsole.log(\`Compilado y ejecutado con TypeScript: \${gtems.nombre} \${gtems.version}\`);\n`,
      'utf8'
    );
  }

  const cppSample = path.join(FS_ROOT, 'Proyectos', 'calculo.cpp');
  if (!fs.existsSync(cppSample)) {
    fs.writeFileSync(
      cppSample,
      `#include <iostream>\n#include <vector>\n\nint main() {\n  std::vector<int> valores = {10, 20, 30, 40};\n  int suma = 0;\n  for (int v : valores) suma += v;\n  std::cout << "GTEMS Code Studio C++ (g++) — Suma: " << suma << std::endl;\n  return 0;\n}\n`,
      'utf8'
    );
  }

  const sqlSample = path.join(FS_ROOT, 'Proyectos', 'consulta.sql');
  if (!fs.existsSync(sqlSample)) {
    fs.writeFileSync(
      sqlSample,
      `CREATE TABLE modulos (id INTEGER PRIMARY KEY, nombre TEXT, estado TEXT);\nINSERT INTO modulos VALUES (1, 'Kernel Linux', 'Activo');\nINSERT INTO modulos VALUES (2, 'GTEMS Explorer', 'Activo');\nINSERT INTO modulos VALUES (3, 'GTEMS Code Studio', 'Listo');\nSELECT id, nombre, estado FROM modulos ORDER BY id;\n`,
      'utf8'
    );
  }

  const sampleAudio = path.join(FS_ROOT, 'Música', 'Aurora_Chime.wav');
  if (!fs.existsSync(sampleAudio)) {
    fs.writeFileSync(sampleAudio, createSampleWavBuffer());
  }

  const sampleImage = path.join(FS_ROOT, 'Imágenes', 'Aurora_Muestra.jpg');
  const assetWall = path.resolve(process.cwd(), 'src/assets/images/gtems_aurora_wallpaper_1795655915565.jpg');
  if (!fs.existsSync(sampleImage) && fs.existsSync(assetWall)) {
    fs.copyFileSync(assetWall, sampleImage);
  }
}

export function resolveSafePath(virtualPath: string): { absPath: string; readOnly: boolean; relPath: string } {
  const normalizedVirtual = ('/' + (virtualPath || '/').replace(/\\/g, '/')).replace(/\/+/g, '/');

  if (normalizedVirtual === '/Sistema' || normalizedVirtual.startsWith('/Sistema/')) {
    const sub = normalizedVirtual.replace(/^\/Sistema\/?/, '');
    const resolved = path.resolve(SYSTEM_SRC_ROOT, sub);
    if (resolved !== SYSTEM_SRC_ROOT && !resolved.startsWith(SYSTEM_SRC_ROOT + path.sep)) {
      throw new Error('Ruta fuera del árbol permitido de GTEMS OS.');
    }
    return { absPath: resolved, readOnly: true, relPath: normalizedVirtual };
  }

  const sub = normalizedVirtual.replace(/^\/+/, '');
  const resolved = path.resolve(FS_ROOT, sub);
  if (resolved !== FS_ROOT && !resolved.startsWith(FS_ROOT + path.sep)) {
    throw new Error('Acceso denegado: ruta fuera del espacio autorizado del usuario.');
  }
  return { absPath: resolved, readOnly: false, relPath: normalizedVirtual };
}

function buildFileEntry(absPath: string, virtualPath: string): FileEntry {
  const stat = fs.statSync(absPath);
  const name = path.basename(absPath);
  const ext = stat.isDirectory() ? '' : path.extname(name).slice(1).toLowerCase();
  const mime = stat.isDirectory()
    ? { mimeType: 'inode/directory', appId: 'explorer' as const }
    : resolveFileExtension(name);

  let trashInfo: FileEntry['trashInfo'] | undefined;
  if (virtualPath.startsWith('/Papelera/') && !name.endsWith('.trashinfo.json')) {
    const metaPath = absPath + '.trashinfo.json';
    if (fs.existsSync(metaPath)) {
      try {
        trashInfo = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      } catch {
        // ignore corrupted trash metadata
      }
    }
  }

  return {
    name,
    path: virtualPath,
    isDirectory: stat.isDirectory(),
    size: stat.size,
    mtime: stat.mtime.toISOString(),
    extension: ext,
    mimeType: mime.mimeType,
    appId: mime.appId,
    trashInfo,
  };
}

export function listDirectory(virtualPath: string): { entries: FileEntry[]; readOnly: boolean; currentPath: string } {
  ensureFilesystemReady();
  const { absPath, readOnly, relPath } = resolveSafePath(virtualPath);
  if (!fs.existsSync(absPath) || !fs.statSync(absPath).isDirectory()) {
    throw new Error('El directorio especificado no existe.');
  }

  const names = fs.readdirSync(absPath);
  const entries: FileEntry[] = [];

  for (const name of names) {
    if (name.endsWith('.trashinfo.json')) continue;
    const childAbs = path.join(absPath, name);
    const childVirtual = relPath === '/' ? `/${name}` : `${relPath}/${name}`;
    try {
      entries.push(buildFileEntry(childAbs, childVirtual));
    } catch {
      // skip inaccessible entry
    }
  }

  if (relPath === '/') {
    entries.push({
      name: 'Sistema',
      path: '/Sistema',
      isDirectory: true,
      size: 0,
      mtime: new Date().toISOString(),
      extension: '',
      mimeType: 'inode/directory',
      appId: 'explorer',
    });
  }

  entries.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name, 'es');
  });

  return { entries, readOnly, currentPath: relPath };
}

const TEXT_SEARCH_EXTS = new Set([
  'txt', 'md', 'html', 'htm', 'css', 'js', 'jsx', 'ts', 'tsx', 'json', 'xml', 'yaml', 'yml',
  'py', 'cpp', 'c', 'h', 'java', 'cs', 'sql', 'sh', 'conf', 'cfg', 'log', 'csv', 'rules', 'service',
]);

export interface FileSearchMatch {
  entry: FileEntry;
  matchReason: 'nombre' | 'extensión' | 'contenido';
  snippet?: string;
}

export function searchFilesWithContent(query: string, maxResults = 40): FileSearchMatch[] {
  ensureFilesystemReady();
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const extFilter = q.startsWith('.') ? q.slice(1) : null;
  const results: FileSearchMatch[] = [];

  const walk = (absDir: string, virtualPrefix: string, depth: number) => {
    if (depth > 5 || results.length >= maxResults) return;
    let names: string[] = [];
    try {
      names = fs.readdirSync(absDir);
    } catch {
      return;
    }

    for (const name of names) {
      if (results.length >= maxResults) break;
      if (name.endsWith('.trashinfo.json') || name === 'node_modules' || name === '.git') continue;
      const childAbs = path.join(absDir, name);
      const childVirtual = virtualPrefix === '/' ? `/${name}` : `${virtualPrefix}/${name}`;
      let stat: fs.Stats;
      try {
        stat = fs.statSync(childAbs);
      } catch {
        continue;
      }

      const entry = buildFileEntry(childAbs, childVirtual);
      const lowerName = name.toLowerCase();

      if (extFilter && !entry.isDirectory && entry.extension === extFilter) {
        results.push({ entry, matchReason: 'extensión' });
      } else if (lowerName.includes(q)) {
        results.push({ entry, matchReason: 'nombre' });
      } else if (!stat.isDirectory() && stat.size <= 65536 && TEXT_SEARCH_EXTS.has(entry.extension)) {
        try {
          const content = fs.readFileSync(childAbs, 'utf8');
          const idx = content.toLowerCase().indexOf(q);
          if (idx !== -1) {
            const start = Math.max(0, idx - 28);
            const end = Math.min(content.length, idx + q.length + 52);
            const snippet = content.slice(start, end).replace(/\s+/g, ' ').trim();
            results.push({ entry, matchReason: 'contenido', snippet });
          }
        } catch {
          // ignore unreadable text file
        }
      }

      if (stat.isDirectory()) {
        walk(childAbs, childVirtual, depth + 1);
      }
    }
  };

  walk(FS_ROOT, '/', 0);
  if (fs.existsSync(SYSTEM_SRC_ROOT)) {
    walk(SYSTEM_SRC_ROOT, '/Sistema', 0);
  }

  return results;
}

export function saveWallpaperBase64(filename: string, base64Data: string): string {
  ensureFilesystemReady();
  const clean = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_') || `wallpaper_${Date.now()}.png`;
  const targetVirtual = `/Imágenes/${clean}`;
  const { absPath } = resolveSafePath(targetVirtual);
  const stripped = base64Data.replace(/^data:[^;]+;base64,/, '');
  fs.writeFileSync(absPath, Buffer.from(stripped, 'base64'));
  return targetVirtual;
}

export function moveToTrash(virtualPaths: string[]): void {
  ensureFilesystemReady();
  const trashDir = path.join(FS_ROOT, 'Papelera');
  for (const vp of virtualPaths) {
    const { absPath, readOnly, relPath } = resolveSafePath(vp);
    if (readOnly || relPath === '/' || STANDARD_DIRS.some((d) => relPath === `/${d}`)) {
      throw new Error(`No se puede eliminar la carpeta protegida del sistema: ${relPath}`);
    }
    if (!fs.existsSync(absPath)) continue;
    const stat = fs.statSync(absPath);
    const baseName = path.basename(absPath);
    let destName = baseName;
    if (fs.existsSync(path.join(trashDir, destName))) {
      destName = `${Date.now()}_${baseName}`;
    }
    const destAbs = path.join(trashDir, destName);
    fs.renameSync(absPath, destAbs);
    fs.writeFileSync(
      destAbs + '.trashinfo.json',
      JSON.stringify({
        originalPath: relPath,
        deletedAt: new Date().toISOString(),
        size: stat.size,
      }),
      'utf8'
    );
  }
}

export function restoreFromTrash(trashPaths: string[]): void {
  ensureFilesystemReady();
  for (const vp of trashPaths) {
    const { absPath, relPath } = resolveSafePath(vp);
    if (!relPath.startsWith('/Papelera/')) {
      throw new Error('Solo se pueden restaurar elementos desde /Papelera.');
    }
    if (!fs.existsSync(absPath)) continue;
    const metaPath = absPath + '.trashinfo.json';
    let targetVirtual = `/Documentos/${path.basename(absPath)}`;
    if (fs.existsSync(metaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        if (meta.originalPath) targetVirtual = meta.originalPath;
      } catch {
        // fallback
      }
      fs.unlinkSync(metaPath);
    }
    const { absPath: targetAbs } = resolveSafePath(targetVirtual);
    const parent = path.dirname(targetAbs);
    if (!fs.existsSync(parent)) fs.mkdirSync(parent, { recursive: true });
    const finalTarget = fs.existsSync(targetAbs)
      ? path.join(parent, `Restaurado_${Date.now()}_${path.basename(targetAbs)}`)
      : targetAbs;
    fs.renameSync(absPath, finalTarget);
  }
}

export function permanentDelete(virtualPaths: string[]): void {
  for (const vp of virtualPaths) {
    const { absPath, readOnly, relPath } = resolveSafePath(vp);
    if (readOnly || relPath === '/' || STANDARD_DIRS.some((d) => relPath === `/${d}`)) {
      throw new Error(`Operación denegada sobre ruta protegida: ${relPath}`);
    }
    if (fs.existsSync(absPath)) {
      fs.rmSync(absPath, { recursive: true, force: true });
    }
    if (fs.existsSync(absPath + '.trashinfo.json')) {
      fs.unlinkSync(absPath + '.trashinfo.json');
    }
  }
}

export function compressToZip(virtualPaths: string[], destZipVirtual: string): string {
  const { absPath: zipAbs, readOnly, relPath } = resolveSafePath(destZipVirtual);
  if (readOnly) throw new Error('No se puede escribir en /Sistema.');
  const zip = new AdmZip();
  for (const vp of virtualPaths) {
    const { absPath } = resolveSafePath(vp);
    if (!fs.existsSync(absPath)) continue;
    const stat = fs.statSync(absPath);
    if (stat.isDirectory()) {
      zip.addLocalFolder(absPath, path.basename(absPath));
    } else {
      zip.addLocalFile(absPath);
    }
  }
  zip.writeZip(zipAbs);
  return relPath;
}

export function extractZip(zipVirtual: string, destDirVirtual: string): void {
  const { absPath: zipAbs } = resolveSafePath(zipVirtual);
  const { absPath: destAbs, readOnly } = resolveSafePath(destDirVirtual);
  if (readOnly) throw new Error('No se puede extraer en /Sistema.');
  if (!fs.existsSync(zipAbs)) throw new Error('El archivo comprimido no existe.');
  const zip = new AdmZip(zipAbs);
  for (const entry of zip.getEntries()) {
    const resolvedEntry = path.resolve(destAbs, entry.entryName);
    if (!resolvedEntry.startsWith(destAbs + path.sep) && resolvedEntry !== destAbs) {
      throw new Error(`Entrada de archivo comprimido insegura detectada: ${entry.entryName}`);
    }
  }
  zip.extractAllTo(destAbs, true);
}
