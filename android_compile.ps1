# ==============================================================================
# Yenten Single Wallet - Android APK Compilation Script (Capacitor - Windows)
# ==============================================================================
# Description:
#   Synchronizes web assets and custom launcher icons, initializes/syncs the
#   Capacitor Android project, enables cleartext/network access, configures
#   local.properties, and compiles the standalone debug APK into:
#   android\release_apk\YentenSingleWallet-v<VER>.apk
#
# Prerequisites:
#   - Node.js / npm
#   - Java JDK (17 or 21)
#   - Android SDK (platform-tools, platforms;android-34, build-tools;34.0.0)
#   - Python 3 (optional, used to parse version.py)
#
# Usage:
#   .\Android_compile.ps1
# ==============================================================================

$ErrorActionPreference = "Stop"

$ProjectRoot = $PSScriptRoot
$AndroidDir = Join-Path $ProjectRoot "android"
$StaticTarget = Join-Path $AndroidDir "www\static"
$ReleaseDir = Join-Path $AndroidDir "release_apk"

Write-Host "=== Yenten Single Wallet - Android APK Build (Windows) ===" -ForegroundColor Cyan

# 1. Legge la versione da version.py (fallback a 0.1.0 se Python non e' nel PATH)
$Version = "0.1.0"
$VersionFile = Join-Path $ProjectRoot "version.py"
if ((Get-Command python -ErrorAction SilentlyContinue) -and (Test-Path $VersionFile)) {
    Push-Location $ProjectRoot
    $pyOut = python -c "import re; m=re.search(r'__version__\s*=\s*[\x22\x27]([^\x22\x27]+)', open('version.py').read()); print(m.group(1) if m else '0.1.0')"
    Pop-Location
    if ($pyOut) { $Version = $pyOut.Trim() }
}
Write-Host "[1/6] Versione rilevata: v$Version" -ForegroundColor Green

# 2. Copia gli asset statici in android\www\static
Write-Host "[2/6] Sincronizzazione asset statici..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $StaticTarget | Out-Null
Remove-Item -Recurse -Force "$StaticTarget\*" -ErrorAction SilentlyContinue
Copy-Item -Recurse -Force "$ProjectRoot\static\*" "$StaticTarget\"

# 3. Installazione dipendenze npm, configurazione rete e Capacitor sync
Write-Host "[3/6] Configurazione rete e sync Capacitor..." -ForegroundColor Yellow
Push-Location $AndroidDir

# Assicura che capacitor.config.json permetta la navigazione e le chiamate HTTP/HTTPS
$CapConfigPath = Join-Path $AndroidDir "capacitor.config.json"
if (Test-Path $CapConfigPath) {
    $capJson = Get-Content $CapConfigPath -Raw | ConvertFrom-Json
    if (-not $capJson.server) {
        $capJson | Add-Member -NotePropertyName "server" -NotePropertyValue ([PSCustomObject]@{
            androidScheme = "http"
            cleartext = $true
            allowNavigation = @("*")
        }) -Force
    }
    $capJson | ConvertTo-Json -Depth 10 | Set-Content -Path $CapConfigPath -Encoding UTF8
}

npm install
if (-not (Test-Path "android")) {
    npx cap add android
}
npx cap sync android

# 4. Abilita usesCleartextTraffic nel AndroidManifest.xml e applica le icone Yenten
Write-Host "[4/6] Configurazione AndroidManifest e icone launcher..." -ForegroundColor Yellow
$ManifestPath = Join-Path $AndroidDir "android\app\src\main\AndroidManifest.xml"
if (Test-Path $ManifestPath) {
    $manifest = Get-Content $ManifestPath -Raw
    if ($manifest -notmatch "usesCleartextTraffic") {
        $manifest = $manifest -replace "<application", '<application android:usesCleartextTraffic="true"'
        Set-Content -Path $ManifestPath -Value $manifest -Encoding UTF8
    }
}

$ResDir = Join-Path $AndroidDir "android\app\src\main\res"
# Rimuove le icone adattive XML predefinite di Capacitor che nascondono i PNG personalizzati
Remove-Item -Recurse -Force "$ResDir\mipmap-anydpi-v26" -ErrorAction SilentlyContinue

foreach ($Density in @("mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi")) {
    $SrcIcon = Join-Path $ProjectRoot "static\images\ic_launcher_$Density.png"
    $TargetMipmap = Join-Path $ResDir "mipmap-$Density"
    if ((Test-Path $SrcIcon) -and (Test-Path $TargetMipmap)) {
        Copy-Item -Force $SrcIcon "$TargetMipmap\ic_launcher.png"
        Copy-Item -Force $SrcIcon "$TargetMipmap\ic_launcher_round.png"
    }
}

# 5. Configura local.properties e compila l'APK con Gradle
Write-Host "[5/6] Compilazione APK con Gradle..." -ForegroundColor Yellow
$NativeAndroidDir = Join-Path $AndroidDir "android"
Push-Location $NativeAndroidDir

$SdkPath = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { "C:\Android\Sdk" }
if (Test-Path $SdkPath) {
    $EscapedSdk = $SdkPath -replace '\\', '\\'
    "sdk.dir=$EscapedSdk" | Out-File -Encoding ASCII "local.properties"
}

.\gradlew.bat assembleDebug
Pop-Location
Pop-Location

# 6. Esporta l'APK finale nella cartella release_apk
Write-Host "[6/6] Esportazione APK finale..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $ReleaseDir | Out-Null
$SourceApk = Join-Path $NativeAndroidDir "app\build\outputs\apk\debug\app-debug.apk"
$DestApk = Join-Path $ReleaseDir "YentenSingleWallet-v$Version.apk"

if (Test-Path $SourceApk) {
    Copy-Item -Force $SourceApk $DestApk
    Write-Host "`nCOMPILAZIONE COMPLETATA CON SUCCESSO!" -ForegroundColor Green
    Write-Host "APK pronto in: $DestApk" -ForegroundColor Cyan
} else {
    Write-Host "`nERRORE: APK non trovato in $SourceApk" -ForegroundColor Red
    exit 1
}