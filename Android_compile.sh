#!/bin/bash
# ==========================================================================
# Yenten Single Wallet - Production Android APK Build Script (Capacitor)
# Copyright (c) 2026 wendigo75
# Licensed under the MIT License
# ==========================================================================

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE}")" && pwd)"
ANDROID_DIR="$PROJECT_ROOT/android"
WWW_DIR="$ANDROID_DIR/www"
STATIC_TARGET="$WWW_DIR/static"
RELEASE_APK_DIR="$ANDROID_DIR/release_apk"
KEYSTORE_DIR="$ANDROID_DIR/keystore"
KEYSTORE_FILE="$KEYSTORE_DIR/yenten-release.keystore"
KEY_ALIAS="yenten-key"
KEY_PASS="yenten2026"
BUILD_MODE="release"
if [ "$1" = "--debug" ]; then
    BUILD_MODE="debug"
fi
ask_confirmation() {
    local prompt="$1"
    local response
    while true; do
        read -r -p "$prompt [y/n]: " response
        case "$response" in
            [yY]|[yY][eE][sS]) return 0 ;;
            [nN]|[nN][oO]) return 1 ;;
            *) echo "Invalid input. Please enter 'y' (yes) or 'n' (no)." ;;
        esac
    done
}
if [ -z "$ANDROID_HOME" ]; then
    if [ -d "/usr/lib/android-sdk" ]; then
        export ANDROID_HOME="/usr/lib/android-sdk"
    elif [ -d "$HOME/Android/Sdk" ]; then
        export ANDROID_HOME="$HOME/Android/Sdk"
    fi
fi
echo "=== 1. Checking prerequisites (Node.js, npm, Java, Python3, Android SDK) ==="
MISSING_APT=()
MISSING_SDK=false
command -v node >/dev/null 2>&1 || MISSING_APT+=("nodejs")
command -v npm >/dev/null 2>&1 || MISSING_APT+=("npm")
command -v java >/dev/null 2>&1 || MISSING_APT+=("openjdk-17-jdk")
command -v python3 >/dev/null 2>&1 || MISSING_APT+=("python3")
command -v unzip >/dev/null 2>&1 || MISSING_APT+=("unzip")
command -v curl >/dev/null 2>&1 || MISSING_APT+=("curl")
if [ -z "$ANDROID_HOME" ] || [ ! -d "$ANDROID_HOME" ]; then
    MISSING_SDK=true
fi
if [ ${#MISSING_APT[@]} -gt 0 ] || [ "$MISSING_SDK" = true ]; then
    echo "Warning: Some required components for building the APK are missing:"
    [ ${#MISSING_APT[@]} -gt 0 ] && echo " - System packages (apt): ${MISSING_APT[*]}"
    [ "$MISSING_SDK" = true ] && echo " - Android SDK & Command-line Tools (will be installed to $HOME/Android/Sdk)"
    echo ""
    if ask_confirmation "Do you want to automatically install the missing dependencies?"; then
        if [ ${#MISSING_APT[@]} -gt 0 ]; then
            if command -v apt-get >/dev/null 2>&1; then
                sudo apt-get update
                sudo apt-get install -y "${MISSING_APT[@]}"
            else
                echo "Error: 'apt-get' not found. Please install manually: ${MISSING_APT[*]}" >&2
                exit 1
            fi
        fi
        if [ "$MISSING_SDK" = true ]; then
            export ANDROID_HOME="$HOME/Android/Sdk"
            CMDLINE_DIR="$ANDROID_HOME/cmdline-tools"
            mkdir -p "$CMDLINE_DIR"
            echo "Downloading Android Command-line Tools..."
            TOOLS_ZIP="/tmp/cmdline-tools.zip"
            curl -fsSL "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip" -o "$TOOLS_ZIP"
            unzip -q "$TOOLS_ZIP" -d "$CMDLINE_DIR"
            mv "$CMDLINE_DIR/cmdline-tools" "$CMDLINE_DIR/latest"
            rm -f "$TOOLS_ZIP"
            export PATH="$CMDLINE_DIR/latest/bin:$ANDROID_HOME/platform-tools:$PATH"
            yes | sdkmanager --licenses >/dev/null 2>&1 || true
            sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"
        fi
        echo "Dependency installation completed!"
    else
        echo "Installation aborted by user." >&2
        exit 1
    fi
else
    echo "All prerequisites are already installed."
fi
echo "=== 2. Extracting app metadata from version.py ==="
VERSION=$(python3 -c "src=open('$PROJECT_ROOT/version.py').read(); exec(src); print(APP_VERSION if 'APP_VERSION' in locals() else '0.1.0')")
VERSION_CODE=$(python3 -c "parts='$VERSION'.split('.'); major=int(parts[0]) if len(parts)>0 and parts[0].isdigit() else 0; minor=int(parts[1]) if len(parts)>1 and parts[1].isdigit() else 1; patch=int(parts[2]) if len(parts)>2 and parts[2].isdigit() else 0; print(major*10000 + minor*100 + patch)")
[ "$VERSION_CODE" -eq 0 ] && VERSION_CODE=1
echo "Detected version: $VERSION (Android versionCode: $VERSION_CODE)"
echo "=== 3. Syncing static assets to android/www/static/ ==="
mkdir -p "$STATIC_TARGET"
rm -rf "$STATIC_TARGET"/*
cp -r "$PROJECT_ROOT/static/"* "$STATIC_TARGET/"
echo "=== 4. Installing Node.js dependencies in android/ ==="
cd "$ANDROID_DIR"
npm install --no-audit --no-fund
if [ -f "$ANDROID_DIR/capacitor.config.json" ]; then
    python3 -c "import json; p='$ANDROID_DIR/capacitor.config.json'; d=json.load(open(p, encoding='utf-8-sig')); d.pop('bundledWebRuntime', None); json.dump(d, open(p,'w'), indent=2)"
fi
echo "=== 5. Initializing and Syncing Capacitor Android ==="
if [ ! -d "$ANDROID_DIR/android" ]; then
    echo "Adding Capacitor Android platform..."
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
    printf '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#FFFFFF</color>\n</resources>\n' > "$RES_DIR/values/ic_launcher_background.xml"
fi
echo "=== 6. Injecting APK Metadata into build.gradle ==="
APP_GRADLE="$ANDROID_DIR/android/app/build.gradle"
if [ -f "$APP_GRADLE" ]; then
    sed -i "s/versionCode [0-9]*/versionCode $VERSION_CODE/" "$APP_GRADLE"
    sed -i "s/versionName \"[^\"]*\"/versionName \"$VERSION\"/" "$APP_GRADLE"
    echo "Updated build.gradle -> versionName: $VERSION, versionCode: $VERSION_CODE"
fi
echo "=== 7. Building & Signing APK ($BUILD_MODE mode) ==="
cd "$ANDROID_DIR/android"
if [ ! -f "./gradlew" ]; then
    echo "Error: gradlew not found in android/android directory." >&2
    exit 1
fi
[ -n "$ANDROID_HOME" ] && echo "sdk.dir=$ANDROID_HOME" > local.properties
chmod +x ./gradlew
mkdir -p "$RELEASE_APK_DIR"
if [ "$BUILD_MODE" = "release" ]; then
    if [ ! -f "$KEYSTORE_FILE" ]; then
        echo "No release signing keystore found at $KEYSTORE_FILE."
        if ask_confirmation "Generate a new self-signed release keystore now?"; then
            mkdir -p "$KEYSTORE_DIR"
            keytool -genkey -v -keystore "$KEYSTORE_FILE" \
                -alias "$KEY_ALIAS" -keyalg RSA -keysize 2048 -validity 10000 \
                -storepass "$KEY_PASS" -keypass "$KEY_PASS" \
                -dname "CN=Yenten Single Wallet, OU=Development, O=Yenten, L=Unknown, S=Unknown, C=XX"
            echo "Keystore generated at $KEYSTORE_FILE (Keep this file safe and do NOT commit it to Git!)."
        else
            echo "Falling back to debug build..."
            BUILD_MODE="debug"
        fi
    fi
fi
if [ "$BUILD_MODE" = "release" ]; then
    ./gradlew assembleRelease
    UNSIGNED_APK="$ANDROID_DIR/android/app/build/outputs/apk/release/app-release-unsigned.apk"
    ALIGNED_APK="$ANDROID_DIR/android/app/build/outputs/apk/release/app-release-aligned.apk"
    TARGET_APK="$RELEASE_APK_DIR/YentenSingleWallet-v$VERSION-release.apk"
    BUILD_TOOLS_DIR=$(find "$ANDROID_HOME/build-tools" -maxdepth 1 -mindepth 1 | sort -V | tail -n 1)
    if [ -z "$BUILD_TOOLS_DIR" ]; then
        echo "Error: Android build-tools not found in $ANDROID_HOME/build-tools." >&2
        exit 1
    fi
    "$BUILD_TOOLS_DIR/zipalign" -f -v 4 "$UNSIGNED_APK" "$ALIGNED_APK" >/dev/null
    "$BUILD_TOOLS_DIR/apksigner" sign --ks "$KEYSTORE_FILE" \
        --ks-key-alias "$KEY_ALIAS" --ks-pass "pass:$KEY_PASS" --key-pass "pass:$KEY_PASS" \
        --out "$TARGET_APK" "$ALIGNED_APK"
    rm -f "$ALIGNED_APK"
else
    ./gradlew assembleDebug
    SOURCE_APK="$ANDROID_DIR/android/app/build/outputs/apk/debug/app-debug.apk"
    TARGET_APK="$RELEASE_APK_DIR/YentenSingleWallet-v$VERSION-debug.apk"
    cp "$SOURCE_APK" "$TARGET_APK"
fi
if [ -f "$TARGET_APK" ]; then
    APK_SIZE=$(du -h "$TARGET_APK" | cut -f1)
    echo "=========================================================="
    echo " ANDROID BUILD COMPLETED SUCCESSFULLY!"
    echo " Mode:    ${BUILD_MODE^^}"
    echo " Version: $VERSION (code $VERSION_CODE)"
    echo " Size:    $APK_SIZE"
    echo " Output:  $TARGET_APK"
    echo "=========================================================="
else
    echo "Error: Final APK was not generated at $TARGET_APK." >&2
    exit 1
fi
