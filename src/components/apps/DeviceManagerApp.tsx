import React, { useEffect, useState } from 'react';
import { RefreshCw, Cpu } from 'lucide-react';
import { apiFetch } from '../../lib/apiClient';

interface DeviceItem {
  name: string;
  manufacturer: string;
  type: string;
  status: string;
  driver: string;
  port: string;
  details: string;
}

interface DevicesResp {
  devices: DeviceItem[];
  capabilities: {
    usbBusPresent: boolean;
    soundBusPresent: boolean;
    bluetoothPresent: boolean;
    batteryPresent: boolean;
    drmPresent: boolean;
  };
}

export const DeviceManagerApp: React.FC = () => {
  const [data, setData] = useState<DevicesResp | null>(null);
  const [clientDevices, setClientDevices] = useState<string[]>([]);

  const load = async () => {
    const res = await apiFetch<DevicesResp>('/api/devices');
    setData(res);

    if (navigator.mediaDevices?.enumerateDevices) {
      try {
        const list = await navigator.mediaDevices.enumerateDevices();
        setClientDevices(list.map((d) => `${d.kind}${d.label ? ` (${d.label})` : ''}`));
      } catch {
        setClientDevices([]);
      }
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="h-full flex flex-col p-5 gap-4 overflow-y-auto aurora-scroll text-[var(--gtems-text)]">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display font-bold text-base">Dispositivos detectados en tiempo real</h3>
          <p className="text-xs text-[var(--gtems-text-muted)]">
            Consulta directa a subsistemas del kernel Linux (<code className="font-mono">/sys</code>, <code className="font-mono">lsblk</code>, <code className="font-mono">netdev</code>).
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--gtems-border)] text-xs font-medium"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Escanear</span>
        </button>
      </div>

      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
          {[
            { label: 'Bus USB', ok: data.capabilities.usbBusPresent },
            { label: 'Audio ALSA', ok: data.capabilities.soundBusPresent },
            { label: 'Bluetooth', ok: data.capabilities.bluetoothPresent },
            { label: 'Batería ACPI', ok: data.capabilities.batteryPresent },
            { label: 'Gráficos DRM', ok: data.capabilities.drmPresent },
          ].map((cap) => (
            <div key={cap.label} className="p-2.5 rounded-xl border border-[var(--gtems-border)] bg-white/50 dark:bg-slate-900/40">
              <div className="font-semibold">{cap.label}</div>
              <div className="text-[11px] text-[var(--gtems-text-muted)] mt-0.5">
                {cap.ok ? 'Disponible' : 'No presente en este entorno'}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {(data?.devices || []).map((dev, idx) => (
          <div key={idx} className="p-3.5 rounded-xl border border-[var(--gtems-border)] flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-3">
              <Cpu className="w-4 h-4 text-[#398F91] shrink-0" />
              <div>
                <div className="font-semibold">{dev.name}</div>
                <div className="text-[11px] text-[var(--gtems-text-muted)]">
                  {dev.manufacturer} · {dev.type} · Controlador: {dev.driver}
                </div>
              </div>
            </div>
            <div className="text-right font-mono text-[11px]">
              <div>{dev.status}</div>
              <div className="text-[var(--gtems-text-muted)]">{dev.port}</div>
            </div>
          </div>
        ))}
      </div>

      {clientDevices.length > 0 && (
        <div className="p-3.5 rounded-xl border border-[var(--gtems-border)] text-xs space-y-1">
          <div className="font-semibold">Dispositivos multimedia expuestos por el navegador cliente:</div>
          <div className="font-mono text-[11px] text-[var(--gtems-text-muted)]">{clientDevices.join(' · ')}</div>
        </div>
      )}
    </div>
  );
};
