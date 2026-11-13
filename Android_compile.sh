#!/bin/bash
# ==========================================================================
# Yenten Single Wallet - Android APK Compilation Script (Capacitor)
# Copyright (c) 2026 wendigo75
# Licensed under the MIT License
# ==========================================================================
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ANDROID_DIR="$PROJECT_ROOT/android"
WWW_DIR="$ANDROID_DIR/www"
STATIC_TARGET="$WWW_DIR/static"
RELEASE_APK_DIR="$ANDROID_DIR/release_apk"

if [ -z "$ANDROID_HOME" ]; then
    if [ -d "/usr/lib/android-sdk" ]; then
        export ANDROID_HOME="/usr/lib/android-sdk"
    elif [ -d "$HOME/Android/Sdk" ]; then
        export ANDROID_HOME="$HOME/Android/Sdk"
    fi
fi
echo "=== 1. Controllo prerequisiti (Node.js, npm, Java/Android SDK) ==="
if ! command -v node >/dev/null 2>&1; then
    echo "Errore: Node.js non è installato. Installalo per compilare l'APK Android." >&2
    exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
    echo "Errore: npm non è installato." >&2
    exit 1
fi

echo "=== 2. Estrazione versione da version.py ==="
VERSION=$(python3 -c "import os; src=open('version.py').read(); exec(src); print(APP_VERSION if 'APP_VERSION' in locals() else '0.1.0')")
echo "Versione rilevata: $VERSION"

echo "=== 3. Sincronizzazione asset statici in android/www/static/ ==="
mkdir -p "$STATIC_TARGET"
rm -rf "$STATIC_TARGET"/*
cp -r "$PROJECT_ROOT/static/"* "$STATIC_TARGET/"

echo "=== 4. Installazione dipendenze Node.js in android/ ==="
cd "$ANDROID_DIR"
npm install

echo "=== 5. Inizializzazione e Sincronizzazione Capacitor Android ==="
if [ ! -d "$ANDROID_DIR/android" ]; then
    echo "Aggiunta piattaforma Capacitor Android..."
    npx cap add android
fi

npx cap sync android
RES_DIR="$ANDROID_DIR/android/app/src/main/res"
for DENSITY in mdpi hdpi xhdpi xxhdpi xxxhdpi; do
    if [ -f "$PROJECT_ROOT/static/images/ic_launcher_${DENSITY}.png" ] && [ -d "$RES_DIR/mipmap-${DENSITY}" ]; then
        cp "$PROJECT_ROOT/static/images/ic_launcher_${DENSITY}.png" "$RES_DIR/mipmap-${DENSITY}/ic_launcher.png"
        cp "$PROJECT_ROOT/static/images/ic_launcher_${DENSITY}.png" "$RES_DIR/mipmap-${DENSITY}/ic_launcher_round.png"
    fi
done
if [ -f "$PROJECT_ROOT/static/images/ic_launcher_foreground.png" ] && [ -d "$RES_DIR/mipmap-xxxhdpi" ]; then
    for DENSITY in mdpi hdpi xhdpi xxhdpi xxxhdpi; do
        cp "$PROJECT_ROOT/static/images/ic_launcher_foreground.png" "$RES_DIR/mipmap-${DENSITY}/ic_launcher_foreground.png"
    done
fi
if [ -f "$RES_DIR/values/ic_launcher_background.xml" ]; then
    cat << 'EOF' > "$RES_DIR/values/ic_launcher_background.xml"
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#FFFFFF</color>
</resources>
EOF
fi

echo "=== 6. Compilazione APK tramite Gradle ==="
cd "$ANDROID_DIR/android"
if [ -f "./gradlew" ]; then
    [ -n "$ANDROID_HOME" ] && echo "sdk.dir=$ANDROID_HOME" > local.properties    
    chmod +x ./gradlew
    ./gradlew assembleDebug
else
    echo "Errore: gradlew non trovato nella cartella android/android." >&2
    exit 1
fi

echo "=== 7. Copia dell'APK generato in release_apk/ ==="
mkdir -p "$RELEASE_APK_DIR"
SOURCE_APK="$ANDROID_DIR/android/app/build/outputs/apk/debug/app-debug.apk"
TARGET_APK="$RELEASE_APK_DIR/YentenSingleWallet-v$VERSION.apk"

if [ -f "$SOURCE_APK" ]; then
    cp "$SOURCE_APK" "$TARGET_APK"
    echo "=========================================================="
    echo " COMPILAZIONE ANDROID COMPLETATA CON SUCCESSO!"
    echo " APK generato in: $TARGET_APK"
    echo "=========================================================="
else
    echo "Attenzione: APK non trovato nel percorso atteso ($SOURCE_APK)." >&2
    echo "Controlla eventuali errori di Gradle sopra." >&2
    exit 1
fi
