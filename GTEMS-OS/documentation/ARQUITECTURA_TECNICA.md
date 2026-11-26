# Arquitectura Técnica — GTEMS OS 1.0 Aurora

## 1. Base del Sistema Operativo
GTEMS OS no parte de un kernel escrito desde cero: se construye sobre **Linux (Debian 12 Bookworm `amd64`)**, utilizando su kernel estándar (`linux-image-amd64`), `systemd`, `udev`, `Polkit`, `NetworkManager`, sistema de paquetes `APT/dpkg` y utilidades GNU/Linux reales.

## 2. Separación por Capas
1. **Capa Kernel y Arranque (`kernel/`, `boot/`)**: Parámetros de endurecimiento `sysctl` (`99-gtems-security.conf`), `initramfs` y configuración híbrida GRUB2 BIOS/UEFI (`grub.cfg`).
2. **Capa Hardware (`drivers/udev/`)**: Reglas `udev` para almacenamiento, audio ALSA/Pulse y vídeo DRM/V4L2; lectura real de `/sys/class`, `/proc` y `lsblk`.
3. **Capa Servicios (`system/`, `server/`)**: Daemon `gtems-desktop.service`, CLI `gtemsctl`, autenticación con hashing `scrypt` + sal aleatoria, tokens HMAC, registro de auditoría, servicio de archivos `.gtems-fs` con confinamiento estricto y servicio de descarga/verificación de `.iso`.
4. **Capa Escritorio y Aplicaciones (`src/`)**: Interfaz React + Tailwind ejecutada en modo kiosco fullscreen (`Openbox + Chromium`) o navegador estándar, sin simular hardware inexistente.

## 3. Modelo Live vs Instalado y Seguridad
- **Live sin persistencia**: Arranca desde SquashFS en RAM; cambios locales no se conservan tras apagar.
- **Live con persistencia**: Con partición/archivo etiquetado `persistence` y parámetro `boot=live persistence`.
- **Instalado en disco**: Particionado GPT (`EFI` + `ext4`) y cuentas locales cifradas.
- **Seguridad en descargas ISO**: El servidor únicamente lee y transmite por flujo (`fs.createReadStream` + soporte `Range`) desde el directorio publicado `.gtems-iso/published/` validado con `SHA-256`; ningún usuario visitante puede disparar compilaciones ni sobrescribir artefactos vía HTTP.
