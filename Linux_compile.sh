#!/bin/bash
# ==========================================================================
# Yenten Single Wallet - Standalone Linux Compilation & Packaging Script
# Copyright (c) 2026 wendigo75
# Licensed under the MIT License
# ==========================================================================
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE}")" && pwd)"
APP_NAME="YentenSingleWallet"
ICON_PATH="$PROJECT_ROOT/static/app_icon.svg"
RELEASE_DIR="$PROJECT_ROOT/release_package"
PACKAGE_NAME="YentenSingleWallet-Linux-x86_64"
TARGET_DIR="$RELEASE_DIR/$PACKAGE_NAME"

echo "=== 1. Controllo ambiente Python ==="
if ! command -v python3 >/dev/null 2>&1; then
    echo "Errore: python3 non è installato." >&2
    exit 1
fi

if [ ! -d "$PROJECT_ROOT/venv" ]; then
    echo "Creazione ambiente virtuale venv..."
    python3 -m venv "$PROJECT_ROOT/venv"
fi

echo "Attivazione venv e installazione dipendenze Linux..."
source "$PROJECT_ROOT/venv/bin/activate"
pip install --upgrade pip
pip install -r "$PROJECT_ROOT/requirements-linux.txt"

echo "=== 2. Estrazione versione da version.py ==="
VERSION=$(python3 -c "import os; src=open('version.py').read(); exec(src); print(APP_VERSION if 'APP_VERSION' in locals() else '0.1.0')")
echo "Versione rilevata: $VERSION"

echo "=== 3. Compilazione del binario Standalone con PyInstaller ==="
pyinstaller \
    --clean \
    --noconfirm \
    --onefile \
    --windowed \
    --name "$APP_NAME" \
    --distpath "$PROJECT_ROOT" \
    --collect-all webview \
    --add-data "$PROJECT_ROOT/static:static" \
    --add-data "$PROJECT_ROOT/template:template" \
    --add-data "$PROJECT_ROOT/static/app_icon.svg:." \
    "$PROJECT_ROOT/run_local_app.py"

echo "=== 4. Creazione pacchetto di distribuzione per Linux ==="
rm -rf "$RELEASE_DIR"
mkdir -p "$TARGET_DIR"

# Copia il binario, l'icona, licenza e README
cp "$PROJECT_ROOT/$APP_NAME" "$TARGET_DIR/"
cp "$ICON_PATH" "$TARGET_DIR/app_icon.svg"
if [ -f "$PROJECT_ROOT/README.md" ]; then
    cp "$PROJECT_ROOT/README.md" "$TARGET_DIR/"
fi
if [ -f "$PROJECT_ROOT/LICENSE" ]; then
    cp "$PROJECT_ROOT/LICENSE" "$TARGET_DIR/"
fi

# Genera il file .desktop all'interno del pacchetto
cat <<EOF > "$TARGET_DIR/yentensinglewallet.desktop"
[Desktop Entry]
Version=$VERSION
Type=Application
Name=Yenten Single Wallet
Comment=A secure, lightweight standalone single wallet for Yenten coin (YTN)
Exec=./$APP_NAME
Icon=./app_icon.svg
Terminal=false
Categories=Office;Finance;Crypto;
StartupWMClass=$APP_NAME
EOF

# Genera uno script di installazione opzionale 1-click per l'utente finale
cat <<EOF > "$TARGET_DIR/install.sh"
#!/bin/bash
set -e
INSTALL_DIR="\$HOME/.local/share/yentensinglewallet"
APPS_DIR="\$HOME/.local/share/applications"
ICONS_DIR="\$HOME/.local/share/icons"

echo "Installazione di Yenten Single Wallet..."
mkdir -p "\$INSTALL_DIR"
mkdir -p "\$APPS_DIR"
mkdir -p "\$ICONS_DIR"

cp "$APP_NAME" "\$INSTALL_DIR/"
cp "app_icon.svg" "\$ICONS_DIR/yenten-wallet.svg"

cat <<DESKTOP > "\$APPS_DIR/yentensinglewallet.desktop"
[Desktop Entry]
Version=$VERSION
Type=Application
Name=Yenten Single Wallet
Comment=A secure, lightweight standalone single wallet for Yenten coin (YTN)
Exec=\$INSTALL_DIR/$APP_NAME
Icon=\$ICONS_DIR/yenten-wallet.svg
Terminal=false
Categories=Office;Finance;Crypto;
StartupWMClass=$APP_NAME
DESKTOP

chmod +x "\$INSTALL_DIR/$APP_NAME"
chmod +x "\$APPS_DIR/yentensinglewallet.desktop"

echo "Installazione completata con successo! L'app è ora nel tuo menu di sistema."
EOF

chmod +x "$TARGET_DIR/install.sh"
chmod +x "$TARGET_DIR/$APP_NAME"

echo "=== 5. Creazione archivio tar.gz per GitHub Releases ==="
cd "$RELEASE_DIR"
tar -czf "$PACKAGE_NAME.tar.gz" "$PACKAGE_NAME"
mv "$PACKAGE_NAME.tar.gz" "$PROJECT_ROOT/"
cd "$PROJECT_ROOT"

echo "=========================================================="
echo " COMPILAZIONE E IMPACCHETTAMENTO COMPLETATI CON SUCCESSO!"
echo " Binario standalone: $PROJECT_ROOT/$APP_NAME"
echo " Archivio Release:   $PROJECT_ROOT/$PACKAGE_NAME.tar.gz"
echo "=========================================================="

