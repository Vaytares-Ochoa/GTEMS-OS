#!/usr/bin/env bash
# GTEMS OS 1.0 Aurora — Instalador Real de Sistema en Disco
# «Diseñado por cinco mentes, construido para el futuro.»
# ADVERTENCIA: Realiza particionado y formateo real sobre el disco seleccionado.

set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "[ERROR] El instalador de GTEMS OS debe ejecutarse como root (sudo)."
  exit 1
fi

echo "================================================================"
echo "  GTEMS OS 1.0 Aurora — Asistente de Instalación en Disco"
echo "  Diseñado por cinco mentes, construido para el futuro."
echo "================================================================"

echo "[1/6] Discos físicos detectados:"
lsblk -d -o NAME,SIZE,MODEL,TRAN

read -rp "Introduce el dispositivo destino (ej. /dev/sda o /dev/nvme0n1): " TARGET_DISK
if [[ ! -b "${TARGET_DISK}" ]]; then
  echo "[ERROR] ${TARGET_DISK} no es un dispositivo de bloques válido."
  exit 1
fi

echo ""
echo "ATENCIÓN DESTRUCTIVA: Se eliminarán TODAS las particiones y datos de ${TARGET_DISK}."
read -rp "Escribe exactamente 'CONFIRMAR BORRADO ${TARGET_DISK}' para continuar: " CONFIRM
if [[ "${CONFIRM}" != "CONFIRMAR BORRADO ${TARGET_DISK}" ]]; then
  echo "Instalación cancelada por el usuario. No se modificó ningún disco."
  exit 0
fi

read -rp "Nombre de usuario administrador para GTEMS OS: " GTEMS_USER
read -rsp "Contraseña para ${GTEMS_USER}: " GTEMS_PASS
echo ""
read -rp "Zona horaria (ej. America/Tegucigalpa): " GTEMS_TZ

echo "[2/6] Creando tabla GPT y particiones EFI + Raíz en ${TARGET_DISK}..."
parted -s "${TARGET_DISK}" mklabel gpt
parted -s "${TARGET_DISK}" mkpart ESP fat32 1MiB 513MiB
parted -s "${TARGET_DISK}" set 1 esp on
parted -s "${TARGET_DISK}" mkpart GTEMS_ROOT ext4 513MiB 100%

PART_EFI="${TARGET_DISK}1"
PART_ROOT="${TARGET_DISK}2"
if [[ "${TARGET_DISK}" == *"nvme"* ]]; then
  PART_EFI="${TARGET_DISK}p1"
  PART_ROOT="${TARGET_DISK}p2"
fi

echo "[3/6] Formateando particiones..."
mkfs.fat -F32 -n GTEMS_EFI "${PART_EFI}"
mkfs.ext4 -F -L GTEMS_ROOT "${PART_ROOT}"

echo "[4/6] Montando e instalando base Linux Debian + componentes GTEMS OS..."
mkdir -p /mnt/gtems-target
mount "${PART_ROOT}" /mnt/gtems-target
mkdir -p /mnt/gtems-target/boot/efi
mount "${PART_EFI}" /mnt/gtems-target/boot/efi

debootstrap --arch=amd64 bookworm /mnt/gtems-target http://deb.debian.org/debian/

echo "[5/6] Configurando kernel, fstab, usuario y servicios..."
genfstab_uuid_root=$(blkid -s UUID -o value "${PART_ROOT}")
genfstab_uuid_efi=$(blkid -s UUID -o value "${PART_EFI}")
cat > /mnt/gtems-target/etc/fstab <<EOF
UUID=${genfstab_uuid_root} / ext4 errors=remount-ro 0 1
UUID=${genfstab_uuid_efi}  /boot/efi vfat umask=0077 0 1
EOF

echo "gtems-pc" > /mnt/gtems-target/etc/hostname
chroot /mnt/gtems-target /bin/bash -c "
  ln -sf /usr/share/zoneinfo/${GTEMS_TZ} /etc/localtime &&
  useradd -m -s /bin/bash -G sudo,audio,video '${GTEMS_USER}' &&
  echo '${GTEMS_USER}:${GTEMS_PASS}' | chpasswd &&
  apt-get update &&
  DEBIAN_FRONTEND=noninteractive apt-get install -y linux-image-amd64 grub-efi-amd64 network-manager sudo curl
"

echo "[6/6] Instalando gestor de arranque GRUB..."
cp "$(dirname "$0")/../boot/bootloader/grub.cfg" /mnt/gtems-target/boot/grub/grub.cfg
chroot /mnt/gtems-target grub-install --target=x86_64-efi --efi-directory=/boot/efi --bootloader-id=GTEMS_OS
chroot /mnt/gtems-target update-grub

umount -R /mnt/gtems-target
echo "Instalación de GTEMS OS completada con éxito. Puede reiniciar el equipo."
