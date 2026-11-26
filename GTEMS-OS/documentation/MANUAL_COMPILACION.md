# Manual de Compilación de la Imagen `.iso` — GTEMS OS

## 1. Dependencias Necesarias (Debian / Ubuntu)
```bash
sudo make install-deps
```
Instala `debootstrap`, `live-build`, `squashfs-tools`, `xorriso`, `grub-pc-bin`, `grub-efi-amd64-bin`, `mtools`, `dosfstools` y `qemu-system-x86`.

## 2. Estructura de `GTEMS-OS/build/`
- `build-web.sh`: Ejecuta verificación de tipos (`npm run lint`), compila el frontend (`npm run build`) y prepara `/opt/gtems-os`.
- `build-rootfs.sh`: Crea un sistema base Debian Bookworm `amd64` con `debootstrap`, instala el kernel `linux-image-amd64`, `live-boot`, `systemd`, `xorg`, `openbox`, `chromium` en modo kiosco y habilita `gtems-desktop.service`.
- `build-iso.sh`: Empaqueta `live/filesystem.squashfs`, copia `vmlinuz`/`initrd.img`, configura GRUB2 BIOS+UEFI y genera `.gtems-iso/published/GTEMS-OS.iso`, su archivo `.sha256` y `metadata.json`.
- `validate-iso.sh`: Verifica tamaño mínimo, suma `SHA-256`, catálogo El Torito BIOS/UEFI y archivos obligatorios dentro de la imagen.
- `clean-build.sh`: Limpia `.gtems-iso/work/` sin tocar `.gtems-fs/`.

## 3. Comandos Estándar (`Makefile` y `Dockerfile`)
```bash
# Verificar lógica y compilar capa web (no requiere root):
make test build-web

# Compilar ISO híbrida BIOS+UEFI completa (requiere Linux con root):
sudo make build-iso validate-iso

# Alternativa reproducible con Docker:
docker build -t gtems-iso-builder .
docker run --privileged --rm -v "$(pwd)/.gtems-iso:/workspace/gtems-os/.gtems-iso" gtems-iso-builder make build-iso validate-iso
```

## 4. Transparencia en Entornos Contenedor/Sandbox
En contenedores restringidos donde no están instalados `debootstrap`, `mksquashfs`, `xorriso` o `grub-mkrescue` (ni permisos de `mount`/`chroot`), la compilación completa de la `.iso` debe ejecutarse en un host Debian/Ubuntu real o contenedor Docker privilegiado. GTEMS OS nunca fabrica una `.iso` falsa o vacía.
