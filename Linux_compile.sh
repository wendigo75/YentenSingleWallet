#!/bin/bash
# ==========================================================================
# Yenten Single Wallet - Standalone Linux Binary Compilation Script
# Copyright (c) 2026 wendigo75
# Licensed under the MIT License
# ==========================================================================

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE}")" && pwd)"
APP_NAME="YentenSingleWallet"
ARCH=$(uname -m)

echo "=== 1. Checking system prerequisites and dependencies ==="

MISSING_PKGS=()
PKG_MANAGER=""
INSTALL_CMD=""

if command -v apt-get >/dev/null 2>&1; then
    PKG_MANAGER="apt (Debian/Ubuntu/Mint)"
    INSTALL_CMD="sudo apt-get update && sudo apt-get install -y"
    REQUIRED_PKGS=(python3 python3-venv python3-pip binutils python3-gi python3-gi-cairo gir1.2-gtk-3.0)
    
    for pkg in "${REQUIRED_PKGS[@]}"; do
        if ! dpkg -s "$pkg" >/dev/null 2>&1; then
            MISSING_PKGS+=("$pkg")
        fi
    done

    if ! dpkg -s gir1.2-webkit2-4.1 >/dev/null 2>&1 && ! dpkg -s gir1.2-webkit2-4.0 >/dev/null 2>&1; then
        if apt-cache show gir1.2-webkit2-4.1 >/dev/null 2>&1; then
            MISSING_PKGS+=("gir1.2-webkit2-4.1")
        else
            MISSING_PKGS+=("gir1.2-webkit2-4.0")
        fi
    fi

elif command -v dnf >/dev/null 2>&1; then
    PKG_MANAGER="dnf (Fedora/RHEL)"
    INSTALL_CMD="sudo dnf install -y"
    REQUIRED_PKGS=(python3 python3-pip binutils python3-gobject gtk3 webkit2gtk4.1)
    for pkg in "${REQUIRED_PKGS[@]}"; do
        if ! rpm -q "$pkg" >/dev/null 2>&1; then
            MISSING_PKGS+=("$pkg")
        fi
    done

elif command -v pacman >/dev/null 2>&1; then
    PKG_MANAGER="pacman (Arch/Manjaro)"
    INSTALL_CMD="sudo pacman -S --noconfirm"
    REQUIRED_PKGS=(python python-pip binutils python-gobject gtk3 webkit2gtk-4.1)
    for pkg in "${REQUIRED_PKGS[@]}"; do
        if ! pacman -Qi "$pkg" >/dev/null 2>&1; then
            MISSING_PKGS+=("$pkg")
        fi
    done

elif command -v zypper >/dev/null 2>&1; then
    PKG_MANAGER="zypper (openSUSE)"
    INSTALL_CMD="sudo zypper install -y"
    REQUIRED_PKGS=(python3 python3-pip binutils python3-gobject typelib-1_0-Gtk-3_0 typelib-1_0-WebKit2-4_1)
    for pkg in "${REQUIRED_PKGS[@]}"; do
        if ! rpm -q "$pkg" >/dev/null 2>&1; then
            MISSING_PKGS+=("$pkg")
        fi
    done
else
    echo "Warning: Package manager not automatically recognized."
    echo "Please ensure the following dependencies are installed: python3, python3-venv, binutils, python3-gi, gtk3, webkit2gtk."
fi

if [ ${#MISSING_PKGS[@]} -gt 0 ]; then
    echo ""
    echo "Detected package manager: $PKG_MANAGER"
    echo "The following required system dependencies are missing:"
    echo " -> ${MISSING_PKGS[*]}"
    echo ""
    read -r -p "Would you like to install them automatically from official repositories? [Y/n]: " RESPONSE
    case "$RESPONSE" in
        [yY][eE][sS]|[yY]|"")
            echo "Installing dependencies..."
            eval "$INSTALL_CMD ${MISSING_PKGS[*]}"
            ;;
        *)
            echo "Build aborted by user. Please install the missing dependencies manually and try again."
            exit 1
            ;;
    esac
else
    echo "All system dependencies are already installed!"
fi

echo "=== 2. Setting up Python virtual environment ==="
rm -rf "$PROJECT_ROOT/venv"
python3 -m venv --system-site-packages "$PROJECT_ROOT/venv"

source "$PROJECT_ROOT/venv/bin/activate"
pip install --upgrade pip
pip install -r "$PROJECT_ROOT/requirements-linux.txt"

echo "=== 3. Extracting version from version.py ==="
VERSION=$(python3 -c "src=open('$PROJECT_ROOT/version.py').read(); exec(src); print(APP_VERSION if 'APP_VERSION' in locals() else '0.1.0')")
echo "Detected version: $VERSION | Architecture: $ARCH"

echo "=== 4. Building standalone binary with PyInstaller ==="
pyinstaller \
    --clean \
    --noconfirm \
    --onefile \
    --windowed \
    --name "$APP_NAME" \
    --distpath "$PROJECT_ROOT" \
    --workpath "$PROJECT_ROOT/build_tmp" \
    --specpath "$PROJECT_ROOT/build_tmp" \
    --collect-all webview \
    --add-data "$PROJECT_ROOT/static:static" \
    --add-data "$PROJECT_ROOT/template:template" \
    --add-data "$PROJECT_ROOT/static/images/wallet.svg:." \
    "$PROJECT_ROOT/run_local_app.py"

chmod +x "$PROJECT_ROOT/$APP_NAME"

echo "=== 5. Cleaning up temporary files ==="
rm -rf "$PROJECT_ROOT/build_tmp" "$PROJECT_ROOT"/*.AppImage

echo "=========================================================="
echo " BINARY BUILD COMPLETED SUCCESSFULLY!"
echo " Output file: $PROJECT_ROOT/$APP_NAME"
echo " SHA-256: $(sha256sum "$PROJECT_ROOT/$APP_NAME" | awk '{print $1}')"
echo "=========================================================="

