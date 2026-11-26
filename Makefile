SHELL := /usr/bin/env bash
.PHONY: install-deps test build-web build-rootfs build-iso validate-iso checksum clean all

ISO_PATH ?= .gtems-iso/published/GTEMS-OS.iso

install-deps:
	apt-get update && apt-get install -y --no-install-recommends \
		debootstrap live-build squashfs-tools xorriso \
		grub-pc-bin grub-efi-amd64-bin mtools dosfstools \
		qemu-system-x86 make ca-certificates

test:
	npx --yes tsx --test src/lib/gtemsLogic.test.ts

build-web:
	bash GTEMS-OS/build/build-web.sh

build-rootfs:
	bash GTEMS-OS/build/build-rootfs.sh

build-iso:
	bash GTEMS-OS/build/build-iso.sh

validate-iso:
	bash GTEMS-OS/build/validate-iso.sh "$(ISO_PATH)"

checksum:
	@if [ ! -f "$(ISO_PATH)" ]; then echo "No existe $(ISO_PATH)"; exit 1; fi
	@cd "$$(dirname "$(ISO_PATH)")" && sha256sum "$$(basename "$(ISO_PATH)")" | tee "$$(basename "$(ISO_PATH)").sha256"

clean:
	bash GTEMS-OS/build/clean-build.sh
	rm -rf dist

all: test build-iso validate-iso
