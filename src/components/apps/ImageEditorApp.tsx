import React, { useEffect, useRef, useState } from 'react';
import { RotateCw, FlipHorizontal, FlipVertical, Save, ZoomIn, ZoomOut, Crop } from 'lucide-react';
import { apiFetch, getRawFileUrl } from '../../lib/apiClient';
import type { FileEntry } from '../../lib/types';

interface ImageEditorAppProps {
  initialPath?: string;
  onNotify: (title: string, body: string) => void;
}

export const ImageEditorApp: React.FC<ImageEditorAppProps> = ({ initialPath, onNotify }) => {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [activePath, setActivePath] = useState(initialPath || '/Imágenes/Aurora_Muestra.jpg');
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [cropInset, setCropInset] = useState(0);
  const [resizeScale, setResizeScale] = useState(100);
  const [saving, setSaving] = useState(false);
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    apiFetch<{ entries: FileEntry[] }>('/api/fs/list?path=%2FIm%C3%A1genes')
      .then((res) => setFiles(res.entries.filter((e) => !e.isDirectory && e.appId === 'image-editor')))
      .catch(() => {});
  }, []);

  const renderCanvas = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !img.complete || img.naturalWidth === 0) return;

    const srcW = img.naturalWidth;
    const srcH = img.naturalHeight;
    const insetX = Math.round((srcW * cropInset) / 100);
    const insetY = Math.round((srcH * cropInset) / 100);
    const cw = Math.max(10, srcW - insetX * 2);
    const ch = Math.max(10, srcH - insetY * 2);

    const scaleFactor = resizeScale / 100;
    const outW = Math.max(16, Math.round((rotation % 180 === 0 ? cw : ch) * scaleFactor));
    const outH = Math.max(16, Math.round((rotation % 180 === 0 ? ch : cw) * scaleFactor));

    canvas.width = outW;
    canvas.height = outH;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.clearRect(0, 0, outW, outH);
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
    ctx.translate(outW / 2, outH / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);

    const drawW = cw * scaleFactor;
    const drawH = ch * scaleFactor;
    ctx.drawImage(img, insetX, insetY, cw, ch, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();
  };

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgRef.current = img;
      renderCanvas();
    };
    img.src = getRawFileUrl(activePath);
  }, [activePath]);

  useEffect(() => {
    renderCanvas();
  }, [rotation, flipH, flipV, brightness, contrast, saturation, cropInset, resizeScale]);

  const resetAdjustments = () => {
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setCropInset(0);
    setResizeScale(100);
  };

  const handleSave = async (asCopy = false) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setConfirmOverwrite(false);
    setSaving(true);
    try {
      const targetPath = asCopy
        ? activePath.replace(/(\.[^.]+)?$/, `_editado_${Date.now()}.png`)
        : activePath;
      const mime = targetPath.endsWith('.jpg') || targetPath.endsWith('.jpeg') ? 'image/jpeg' : 'image/png';
      const dataUrl = canvas.toDataURL(mime, 0.92);
      await apiFetch('/api/fs/file', {
        method: 'PUT',
        body: JSON.stringify({ path: targetPath, base64: dataUrl }),
      });
      onNotify('Imagen guardada', `Cambios aplicados en ${targetPath}.`);
      resetAdjustments();
      if (asCopy) setActivePath(targetPath);
    } catch (err) {
      onNotify('Error al guardar', err instanceof Error ? err.message : 'No se pudo guardar la imagen');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col text-[var(--gtems-text)]">
      {/* Toolbar */}
      <div className="px-4 py-2 border-b border-[var(--gtems-border)] flex flex-wrap items-center justify-between gap-2 bg-white/60 dark:bg-slate-900/50">
        <div className="flex items-center gap-2">
          <select
            aria-label="Seleccionar imagen"
            value={activePath}
            onChange={(e) => setActivePath(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-[var(--gtems-border)] bg-white dark:bg-slate-800 text-xs"
          >
            {!files.some((f) => f.path === activePath) && <option value={activePath}>{activePath}</option>}
            {files.map((f) => (
              <option key={f.path} value={f.path}>{f.name}</option>
            ))}
          </select>
          <button type="button" onClick={() => setZoom((z) => Math.max(0.25, z - 0.15))} className="p-1.5 rounded-lg border border-[var(--gtems-border)]" aria-label="Alejar">
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs font-mono tabular-nums w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => setZoom((z) => Math.min(2.5, z + 0.15))} className="p-1.5 rounded-lg border border-[var(--gtems-border)]" aria-label="Acercar">
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={() => setRotation((r) => (r + 90) % 360)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--gtems-border)] text-xs">
            <RotateCw className="w-3.5 h-3.5" /> Rotar
          </button>
          <button type="button" onClick={() => setFlipH((v) => !v)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--gtems-border)] text-xs">
            <FlipHorizontal className="w-3.5 h-3.5" /> Voltear H
          </button>
          <button type="button" onClick={() => setFlipV((v) => !v)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--gtems-border)] text-xs">
            <FlipVertical className="w-3.5 h-3.5" /> Voltear V
          </button>
          <button type="button" onClick={resetAdjustments} className="px-2.5 py-1.5 rounded-lg border border-[var(--gtems-border)] text-xs">
            Restablecer
          </button>
          <button type="button" disabled={saving} onClick={() => setConfirmOverwrite(true)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#398F91] text-white text-xs font-semibold">
            <Save className="w-3.5 h-3.5" /> Guardar
          </button>
          <button type="button" disabled={saving} onClick={() => void handleSave(true)} className="px-2.5 py-1.5 rounded-lg border border-[var(--gtems-border)] text-xs">
            Guardar como copia
          </button>
        </div>
      </div>

      {confirmOverwrite && (
        <div className="px-4 py-2.5 bg-amber-500/15 border-b border-amber-500/35 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-medium">
            ¿Deseas sobrescribir el archivo original ({activePath}) o guardar una copia nueva?
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmOverwrite(false)}
              className="px-2.5 py-1 rounded-lg border border-[var(--gtems-border)]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void handleSave(true)}
              className="px-2.5 py-1 rounded-lg border border-[var(--gtems-border)] font-medium"
            >
              Guardar copia
            </button>
            <button
              type="button"
              onClick={() => void handleSave(false)}
              className="px-3 py-1 rounded-lg bg-amber-600 text-white font-semibold"
            >
              Sobrescribir original
            </button>
          </div>
        </div>
      )}

      {/* Workspace */}
      <div className="flex-1 min-h-0 flex">
        <div className="flex-1 overflow-auto flex items-center justify-center p-6 bg-slate-950/10 dark:bg-black/30">
          <canvas
            ref={canvasRef}
            style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
            className="max-w-full max-h-full shadow-lg rounded-lg transition-transform"
          />
        </div>

        {/* Adjustments Sidebar */}
        <aside className="w-56 shrink-0 border-l border-[var(--gtems-border)] p-4 space-y-4 text-xs bg-white/50 dark:bg-slate-900/40 overflow-y-auto">
          <div className="font-semibold">Ajustes reales de imagen</div>
          <div>
            <label className="flex justify-between mb-1"><span>Brillo</span><span className="font-mono">{brightness}%</span></label>
            <input type="range" min={30} max={180} value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} className="w-full accent-[#398F91]" />
          </div>
          <div>
            <label className="flex justify-between mb-1"><span>Contraste</span><span className="font-mono">{contrast}%</span></label>
            <input type="range" min={30} max={180} value={contrast} onChange={(e) => setContrast(Number(e.target.value))} className="w-full accent-[#398F91]" />
          </div>
          <div>
            <label className="flex justify-between mb-1"><span>Saturación</span><span className="font-mono">{saturation}%</span></label>
            <input type="range" min={0} max={200} value={saturation} onChange={(e) => setSaturation(Number(e.target.value))} className="w-full accent-[#398F91]" />
          </div>
          <div>
            <label className="flex justify-between mb-1"><span className="inline-flex items-center gap-1"><Crop className="w-3 h-3" /> Recorte bordes</span><span className="font-mono">{cropInset}%</span></label>
            <input type="range" min={0} max={35} value={cropInset} onChange={(e) => setCropInset(Number(e.target.value))} className="w-full accent-[#398F91]" />
          </div>
          <div>
            <label className="flex justify-between mb-1"><span>Redimensionar</span><span className="font-mono">{resizeScale}%</span></label>
            <input type="range" min={25} max={150} value={resizeScale} onChange={(e) => setResizeScale(Number(e.target.value))} className="w-full accent-[#398F91]" />
          </div>
        </aside>
      </div>
    </div>
  );
};
