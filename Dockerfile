# GTEMS OS 1.0 Aurora — Entorno reproducible Debian Bookworm para compilar la imagen .iso híbrida
FROM debian:bookworm

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    debootstrap live-build squashfs-tools xorriso \
    grub-pc-bin grub-efi-amd64-bin mtools dosfstools \
    nodejs npm make curl ca-certificates git && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace/gtems-os
COPY . .

RUN npm ci --no-audit --no-fund

# La generación completa de rootfs/ISO requiere privilegios de montaje en tiempo de ejecución:
# docker build -t gtems-iso-builder .
# docker run --privileged --rm -v "$(pwd)/.gtems-iso:/workspace/gtems-os/.gtems-iso" gtems-iso-builder make build-iso validate-iso
CMD ["make", "test", "build-web"]
