import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/apiClient';

const SYSTEM_FILES = [
  { label: 'Bootloader GRUB2 (BIOS/UEFI)', path: '/Sistema/boot/bootloader/grub.cfg' },
  { label: 'Initramfs Early Boot', path: '/Sistema/boot/initramfs/init' },
  { label: 'Kernel Linux 6.6 Kconfig', path: '/Sistema/kernel/config/gtems-6.6-x86_64.config' },
  { label: 'Endurecimiento Sysctl', path: '/Sistema/kernel/config/99-gtems-security.conf' },
  { label: 'Reglas Udev Hardware', path: '/Sistema/drivers/udev/90-gtems-hardware.rules' },
  { label: 'Utilidad CLI gtemsctl', path: '/Sistema/system/services/gtemsctl' },
  { label: 'Servicio Systemd GTEMS', path: '/Sistema/system/services/gtems-desktop.service' },
  { label: 'Reglas Polkit Seguridad', path: '/Sistema/system/security/polkit-gtems.rules' },
  { label: 'Instalador en Disco (gtems-install.sh)', path: '/Sistema/installer/gtems-install.sh' },
  { label: 'Build Web (build-web.sh)', path: '/Sistema/build/build-web.sh' },
  { label: 'Build RootFS Debian (build-rootfs.sh)', path: '/Sistema/build/build-rootfs.sh' },
  { label: 'Generador ISO BIOS/UEFI (build-iso.sh)', path: '/Sistema/build/build-iso.sh' },
  { label: 'Validador ISO (validate-iso.sh)', path: '/Sistema/build/validate-iso.sh' },
  { label: 'Documentación Principal (README)', path: '/Sistema/documentation/README.md' },
  { label: 'Manual de Instalación', path: '/Sistema/documentation/MANUAL_INSTALACION.md' },
  { label: 'Manual de Usuario', path: '/Sistema/documentation/MANUAL_USUARIO.md' },
  { label: 'Manual de Compilación ISO', path: '/Sistema/documentation/MANUAL_COMPILACION.md' },
  { label: 'Arquitectura Técnica', path: '/Sistema/documentation/ARQUITECTURA_TECNICA.md' },
];

export const ArchitectureApp: React.FC = () => {
  const [selected, setSelected] = useState(SYSTEM_FILES[0]);
  const [content, setContent] = useState('Cargando...');

  useEffect(() => {
    apiFetch<{ content: string }>(`/api/fs/read?path=${encodeURIComponent(selected.path)}`)
      .then((res) => setContent(res.content))
      .catch((err) => setContent(err instanceof Error ? err.message : 'Error leyendo archivo'));
  }, [selected]);

  return (
    <div className="h-full flex text-[var(--gtems-text)]">
      <aside className="w-72 shrink-0 border-r border-[var(--gtems-border)] p-3 overflow-y-auto aurora-scroll space-y-1">
        <div className="px-2.5 py-1.5 text-[11px] font-semibold text-[var(--gtems-text-muted)]">
          Árbol Modular GTEMS-OS/
        </div>
        {SYSTEM_FILES.map((item) => (
          <button
            key={item.path}
            type="button"
            onClick={() => setSelected(item)}
            className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
              selected.path === item.path ? 'bg-[#398F91] text-white font-semibold' : 'hover:bg-[#398F91]/10'
            }`}
          >
            {item.label}
          </button>
        ))}
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-4 py-2.5 border-b border-[var(--gtems-border)] font-mono text-xs text-[var(--gtems-text-muted)]">
          {selected.path}
        </div>
        <pre className="flex-1 p-4 overflow-auto aurora-scroll bg-[#0B161E] text-[#DDF5EC] font-mono text-xs leading-relaxed">
          {content}
        </pre>
      </div>
    </div>
  );
};
