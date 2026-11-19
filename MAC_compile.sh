#!/bin/bash
# ==========================================================================
# Yenten Single Wallet - Standalone macOS Application Compilation Script
# Copyright (c) 2026 wendigo75
#
# This file is part of the Yenten Single Wallet project.
# It is designed specifically to operate alongside the compiled executable. 
# You are free to use, modify, and distribute this software, provided that
# proper credit/mention is given to the original author in all
# copies or substantial portions of the software.
# This software is provided "AS IS", without warranty of any kind.
# For full license terms, see the LICENSE file in the root directory.
# ==========================================================================

set -e
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_NAME="YentenSingleWallet"
ARCH=$(uname -m)
echo "=== 1. Checking system prerequisites and dependencies ==="
if ! xcode-select -p >/dev/null 2>&1; then
    echo "Xcode Command Line Tools are missing."
    read -r -p "Would you like to install Xcode Command Line Tools now? [Y/n]: " RESPONSE
    case "$RESPONSE" in
        [yY][eE][sS]|[yY]|"")
            xcode-select --install
            echo "Please complete the Apple installation popup, then re-run this script."
            exit 1
            ;;
        *)
            echo "Build aborted by user."
            exit 1
            ;;
    esac
fi
if ! command -v brew >/dev/null 2>&1; then
    echo "Homebrew package manager is not installed."
    read -r -p "Would you like to install Homebrew automatically from the official installer? [Y/n]: " RESPONSE
    case "$RESPONSE" in
        [yY][eE][sS]|[yY]|"")
            /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
            export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
            ;;
        *)
            echo "Build aborted by user. Install Homebrew from https://brew.sh and try again."
            exit 1
            ;;
    esac
fi
MISSING_PKGS=()
REQUIRED_PKGS=(python)
for pkg in "${REQUIRED_PKGS[@]}"; do
    if ! brew list "$pkg" >/dev/null 2>&1; then
        MISSING_PKGS+=("$pkg")
    fi
done
if [ ${#MISSING_PKGS[@]} -gt 0 ]; then
    echo ""
    echo "Detected package manager: Homebrew (macOS)"
    echo "The following required system dependencies are missing:"
    echo " -> ${MISSING_PKGS[*]}"
    echo ""
    read -r -p "Would you like to install them automatically from official repositories? [Y/n]: " RESPONSE
    case "$RESPONSE" in
        [yY][eE][sS]|[yY]|"")
            echo "Installing dependencies..."
            brew install "${MISSING_PKGS[@]}"
            ;;
        *)
            echo "Build aborted by user. Please install the missing dependencies manually and try again."
            exit 1
            ;;
    esac
else
    echo "All system dependencies are already installed!"
fi

BREW_PYTHON="$(brew --prefix python 2>/dev/null || true)/bin/python3"
if [ ! -x "$BREW_PYTHON" ]; then
    BREW_PYTHON="python3"
fi
echo "=== 2. Setting up Python virtual environment ==="
rm -rf "$PROJECT_ROOT/venv"
"$BREW_PYTHON" -m venv "$PROJECT_ROOT/venv"
source "$PROJECT_ROOT/venv/bin/activate"
pip install --upgrade pip
pip install -r "$PROJECT_ROOT/requirements-macos.txt"
echo "=== 3. Extracting version from version.py ==="
VERSION=$(python3 -c "src=open('$PROJECT_ROOT/version.py').read(); exec(src); print(APP_VERSION if 'APP_VERSION' in locals() else '0.1.0')")
echo "Detected version: $VERSION | Architecture: $ARCH"
echo "=== 4. Building standalone macOS bundle (.app) with PyInstaller ==="
rm -rf "$PROJECT_ROOT/$APP_NAME" "$PROJECT_ROOT/$APP_NAME.app" "$PROJECT_ROOT/build_tmp"
pyinstaller \
    --clean \
    --noconfirm \
    --onedir \
    --windowed \
    --name "$APP_NAME" \
    --paths "$PROJECT_ROOT/mac" \
    --paths "$PROJECT_ROOT" \
    --distpath "$PROJECT_ROOT" \
    --workpath "$PROJECT_ROOT/build_tmp" \
    --specpath "$PROJECT_ROOT/build_tmp" \
    --collect-all webview \
    --add-data "$PROJECT_ROOT/static:static" \
    --add-data "$PROJECT_ROOT/template:template" \
    --add-data "$PROJECT_ROOT/static/images/wallet.svg:." \
    "$PROJECT_ROOT/mac/run_local_app.py"
echo "=== 5. Cleaning up temporary files and signing bundle ==="
rm -rf "$PROJECT_ROOT/build_tmp" "$PROJECT_ROOT/$APP_NAME"
if [ -d "$PROJECT_ROOT/$APP_NAME.app" ]; then
    codesign --force --deep --sign - "$PROJECT_ROOT/$APP_NAME.app" || true
    ARCHIVE_NAME="${APP_NAME}-v${VERSION}-macOS-${ARCH}.zip"
    rm -f "$PROJECT_ROOT/$ARCHIVE_NAME"
    ditto -c -k --keepParent "$PROJECT_ROOT/$APP_NAME.app" "$PROJECT_ROOT/$ARCHIVE_NAME"
else
    echo "ERROR: $APP_NAME.app was not generated."
    exit 1
fi
echo "=========================================================="
echo " MACOS BUILD COMPLETED SUCCESSFULLY!"
echo " App Bundle: $PROJECT_ROOT/$APP_NAME.app"
echo " Release Archive: $PROJECT_ROOT/$ARCHIVE_NAME"
echo " SHA-256: $(shasum -a 256 "$PROJECT_ROOT/$ARCHIVE_NAME" | awk '{print $1}')"
echo "=========================================================="