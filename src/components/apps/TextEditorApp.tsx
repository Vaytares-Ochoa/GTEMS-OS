import React, { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { apiFetch } from '../../lib/apiClient';

interface TextEditorAppProps {
  initialPath?: string;
  onNotify: (title: string, body: string) => void;
}

export const TextEditorApp: React.FC<TextEditorAppProps> = ({
  initialPath = '/Documentos/Bienvenida_GTEMS_OS.md',
  onNotify,
}) => {
  const [filePath, setFilePath] = useState(initialPath);
  const [content, setContent] = useState('');
  const [readOnly, setReadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiFetch<{ content: string; readOnly: boolean; path: string }>(
      `/api/fs/read?path=${encodeURIComponent(filePath)}`
    )
      .then((res) => {
        setContent(res.content);
        setReadOnly(res.readOnly);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudo abrir el archivo'))
      .finally(() => setLoading(false));
  }, [filePath]);

  const handleSave = async () => {
    if (readOnly) return;
    setSaving(true);
    try {
      await apiFetch('/api/fs/file', {
        method: 'PUT',
        body: JSON.stringify({ path: filePath, content }),
      });
      onNotify('Archivo guardado', `${filePath} guardado en disco.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col text-[var(--gtems-text)]">
      <div className="px-4 py-2 border-b border-[var(--gtems-border)] flex items-center justify-between gap-2 bg-white/60 dark:bg-slate-900/50">
        <input
          type="text"
          aria-label="Ruta del archivo"
          value={filePath}
          onChange={(e) => setFilePath(e.target.value)}
          className="flex-1 px-3 py-1.5 rounded-lg border border-[var(--gtems-border)] bg-white dark:bg-slate-800 font-mono text-xs"
        />
        {!readOnly && (
          <button
            type="button"
            disabled={saving || loading}
            onClick={() => void handleSave()}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#398F91] text-white text-xs font-semibold disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Guardando...' : 'Guardar'}</span>
          </button>
        )}
      </div>

      {error && (
        <div role="alert" className="px-4 py-2 text-xs text-red-600 bg-red-500/10 border-b border-red-500/20">
          {error}
        </div>
      )}

      <textarea
        aria-label="Contenido del editor de texto"
        value={loading ? 'Cargando archivo...' : content}
        readOnly={readOnly || loading}
        onChange={(e) => setContent(e.target.value)}
        className="flex-1 w-full p-4 bg-white/85 dark:bg-[#0B161E] font-mono text-xs leading-relaxed resize-none focus:outline-none aurora-scroll"
      />
    </div>
  );
};
