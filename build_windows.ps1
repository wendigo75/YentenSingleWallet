# ==========================================================================
# Yenten Single Wallet
# Copyright (c) 2026 wendigo75
# This file is part of the Yenten Single Wallet project.
# It is designed specifically to operate alongside the compiled executable. 
# This software is provided "AS IS", without warranty of any kind.
# For full license terms, see the LICENSE file in the root directory.
# ==========================================================================

$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$buildRoot = Join-Path $env:TEMP ("YentenSingleWallet-build-" + [guid]::NewGuid().ToString('N'))
$executablePath = Join-Path $projectRoot 'YentenSingleWallet.exe'
$versionSource = Get-Content -LiteralPath (Join-Path $projectRoot 'version.py') -Raw
$versionMatch = [regex]::Match($versionSource, 'APP_VERSION\s*=\s*["''](?<version>[^"'']+)["'']')
if (-not $versionMatch.Success) {
    throw 'Could not read APP_VERSION from version.py.'
}
$appVersion = $versionMatch.Groups['version'].Value
$numericVersionMatch = [regex]::Match($appVersion, '^(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)')
if (-not $numericVersionMatch.Success) {
    throw "APP_VERSION '$appVersion' must start with MAJOR.MINOR.PATCH."
}
$majorVersion = $numericVersionMatch.Groups['major'].Value
$minorVersion = $numericVersionMatch.Groups['minor'].Value
$patchVersion = $numericVersionMatch.Groups['patch'].Value
$versionResourcePath = Join-Path $buildRoot 'version_info.txt'
$iconPath = Join-Path $buildRoot 'YentenSingleWallet.ico'
New-Item -ItemType Directory -Path $buildRoot | Out-Null
try {
    Add-Type -AssemblyName System.Drawing
    $sourceIcon = [System.Drawing.Image]::FromFile(
        (Join-Path $projectRoot 'static\images\yenten.png')
    )
    $iconEntries = New-Object 'System.Collections.Generic.List[object]'
    try {
        foreach ($size in @(16, 32, 48, 256)) {
            $bitmap = New-Object System.Drawing.Bitmap -ArgumentList $size, $size
            $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
            $pngStream = New-Object System.IO.MemoryStream
            try {
                $graphics.Clear([System.Drawing.Color]::Transparent)
                $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
                $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
                $graphics.DrawImage($sourceIcon, 0, 0, $size, $size)
                $bitmap.Save($pngStream, [System.Drawing.Imaging.ImageFormat]::Png)
                $iconEntries.Add([pscustomobject]@{
                    Size = $size
                    Bytes = $pngStream.ToArray()
                })
            }
            finally {
                $pngStream.Dispose()
                $graphics.Dispose()
                $bitmap.Dispose()
            }
        }
    }
    finally {
        $sourceIcon.Dispose()
    }
    $iconFileStream = [System.IO.File]::Open(
        $iconPath,
        [System.IO.FileMode]::Create,
        [System.IO.FileAccess]::Write
    )
    $iconWriter = New-Object System.IO.BinaryWriter($iconFileStream)
    try {
        $iconWriter.Write([UInt16]0)
        $iconWriter.Write([UInt16]1)
        $iconWriter.Write([UInt16]$iconEntries.Count)
        $imageOffset = 6 + (16 * $iconEntries.Count)
        foreach ($entry in $iconEntries) {
            $dimension = if ($entry.Size -eq 256) { [byte]0 } else { [byte]$entry.Size }
            $iconWriter.Write($dimension)
            $iconWriter.Write($dimension)
            $iconWriter.Write([byte]0)
            $iconWriter.Write([byte]0)
            $iconWriter.Write([UInt16]1)
            $iconWriter.Write([UInt16]32)
            $iconWriter.Write([UInt32]$entry.Bytes.Length)
            $iconWriter.Write([UInt32]$imageOffset)
            $imageOffset += $entry.Bytes.Length
        }
        foreach ($entry in $iconEntries) {
            $iconWriter.Write([byte[]]$entry.Bytes)
        }
    }
    finally {
        $iconWriter.Dispose()
    }
    @"
VSVersionInfo(
  ffi=FixedFileInfo(
    filevers=($majorVersion, $minorVersion, $patchVersion, 0),
    prodvers=($majorVersion, $minorVersion, $patchVersion, 0),
    mask=0x3f,
    flags=0x0,
    OS=0x40004,
    fileType=0x1,
    subtype=0x0,
    date=(0, 0)
  ),
  kids=[
    StringFileInfo([
      StringTable('040904B0', [
        StringStruct('CompanyName', 'Wendigo'),
        StringStruct('FileDescription', 'YentenSingleWallet - Yenten desktop wallet'),
        StringStruct('FileVersion', '$appVersion'),
        StringStruct('InternalName', 'YentenSingleWallet'),
        StringStruct('LegalCopyright', 'Copyright (c) 2026 Wendigo'),
        StringStruct('OriginalFilename', 'YentenSingleWallet.exe'),
        StringStruct('ProductName', 'YentenSingleWallet'),
        StringStruct('ProductVersion', '$appVersion')
      ])
    ]),
    VarFileInfo([VarStruct('Translation', [1033, 1200])])
  ]
)
"@ | Set-Content -LiteralPath $versionResourcePath -Encoding ASCII
    & python -m PyInstaller `
        --clean `
        --noconfirm `
        --onefile `
        --windowed `
        --name YentenSingleWallet `
        --icon $iconPath `
        --distpath $projectRoot `
        --workpath $buildRoot `
        --specpath $buildRoot `
        --version-file $versionResourcePath `
        --collect-all webview `
        --collect-all pythonnet `
        --collect-all clr_loader `
        --add-data "$(Join-Path $projectRoot 'static');static" `
        --add-data "$(Join-Path $projectRoot 'template');template" `
        (Join-Path $projectRoot 'run_local_app.py')
    if ($LASTEXITCODE -ne 0) {
        throw "PyInstaller failed with exit code $LASTEXITCODE."
    }
    $signingThumbprint = $env:YENTEN_SIGN_CERT_THUMBPRINT
    if (-not [string]::IsNullOrWhiteSpace($signingThumbprint)) {
        $signTool = Get-Command signtool.exe -ErrorAction SilentlyContinue
        if (-not $signTool) {
            $windowsKitsPath = Join-Path ${env:ProgramFiles(x86)} 'Windows Kits\10\bin'
            if (Test-Path -LiteralPath $windowsKitsPath) {
                $signTool = Get-ChildItem -LiteralPath $windowsKitsPath -Filter signtool.exe -Recurse |
                    Where-Object { $_.FullName -match '\\x64\\signtool\.exe$' } |
                    Sort-Object -Property FullName -Descending |
                    Select-Object -First 1
            }
        }
        if (-not $signTool) {
            throw 'YENTEN_SIGN_CERT_THUMBPRINT is set, but signtool.exe was not found. Install the Windows SDK.'
        }
        $signToolPath = if ($signTool.Source) { $signTool.Source } else { $signTool.FullName }
        $normalizedThumbprint = $signingThumbprint -replace '\s', ''
        & $signToolPath sign /sha1 $normalizedThumbprint /s My /fd SHA256 /tr 'http://timestamp.digicert.com' /td SHA256 $executablePath
        if ($LASTEXITCODE -ne 0) {
            throw "Authenticode signing failed with exit code $LASTEXITCODE."
        }
        & $signToolPath verify /pa /v $executablePath
        if ($LASTEXITCODE -ne 0) {
            throw "Authenticode signature verification failed with exit code $LASTEXITCODE."
        }
        Write-Output 'Authenticode signature verified.'
    }
    else {
        Write-Warning 'Built unsigned: no signing certificate thumbprint was supplied.'
    }
    $previousExecutable = Join-Path $projectRoot 'YentenWebWallet.exe'
    if (Test-Path -LiteralPath $previousExecutable) {
        try {
            Remove-Item -LiteralPath $previousExecutable -Force
        }
        catch {
            Write-Warning "Could not remove the previous YentenWebWallet.exe (it may still be running): $_"
        }
    }
    Write-Output "Built: $executablePath (version $appVersion)"
}
finally {
    if (Test-Path -LiteralPath $buildRoot) {
        Remove-Item -LiteralPath $buildRoot -Recurse -Force
    }
}
