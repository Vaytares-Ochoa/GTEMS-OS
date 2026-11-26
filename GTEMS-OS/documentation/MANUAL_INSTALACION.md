# Manual de Instalación — GTEMS OS 1.0 Aurora

## 1. Requisitos del Sistema
- **Procesador**: Arquitectura `x86_64` (`amd64`), 2 núcleos mínimo (4 núcleos recomendados).
- **Memoria RAM**: 2 GiB mínimo (4 GiB o más recomendados).
- **Almacenamiento**: 15 GiB libres (32 GiB SSD recomendados).
- **Arranque**: Firmware UEFI o BIOS Legacy (`El Torito` híbrido).

## 2. Obtención y Verificación de la Imagen `.iso`
1. Desde **Configuración → Sistema → Descargar GTEMS OS**, haz clic en **Descargar imagen .iso del sistema** (cuando exista una versión compilada publicada en el servidor).
2. Verifica la integridad criptográfica antes de grabar el medio:
```bash
sha256sum -c GTEMS-OS.iso.sha256
```

## 3. Creación de USB Arrancable
### En Linux / macOS
Identifica tu unidad USB con `lsblk` (reemplaza `/dev/sdX` por la unidad real, nunca por una partición como `sdX1`):
```bash
sudo dd if=GTEMS-OS.iso of=/dev/sdX bs=4M status=progress oflag=sync
```
### En Windows
Utiliza **Rufus** o **BalenaEtcher**, selecciona `GTEMS-OS.iso` y elige esquema **GPT (UEFI)** o **MBR (BIOS/UEFI híbrido)**.

## 4. Arranque en Vivo (Live) e Instalación en Disco
Al iniciar desde el USB, GRUB2 ofrece tres modos:
1. **Sesión Live**: Arranca GTEMS OS en memoria sin alterar los discos locales.
2. **Sesión Live Persistente**: Activa `persistence` si el USB incluye una partición etiquetada `persistence`.
3. **Modo Recuperación**: Consola de mantenimiento con `nomodeset`.

Para instalar permanentemente en disco desde una sesión Live:
```bash
sudo bash /opt/gtems-os/GTEMS-OS/installer/gtems-install.sh
```
O mediante el asistente gráfico de primer arranque al iniciar GTEMS OS sin usuarios instalados.

## 5. Pruebas en Máquina Virtual (QEMU/VirtualBox)
```bash
# BIOS Legacy
qemu-system-x86_64 -enable-kvm -m 4096 -smp 4 -cdrom GTEMS-OS.iso -boot d

# UEFI (con OVMF)
qemu-system-x86_64 -enable-kvm -m 4096 -smp 4 -bios /usr/share/ovmf/OVMF.fd -cdrom GTEMS-OS.iso -boot d
```
