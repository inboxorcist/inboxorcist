# Inboxorcist Installer for Windows
# Usage: irm inboxorcist.com/install.ps1 | iex

$ErrorActionPreference = "Stop"

# Colors
function Write-Color {
    param([string]$Text, [string]$Color = "White")
    Write-Host $Text -ForegroundColor $Color
}

Write-Host ""
Write-Color "Installing Inboxorcist..." "Green"
Write-Host ""

# Detect architecture
$arch = if ([Environment]::Is64BitOperatingSystem) { "x64" } else { "x86" }

if ($arch -eq "x86") {
    Write-Color "32-bit Windows is not supported. Please use a 64-bit system." "Red"
    exit 1
}

# Install directory
$installDir = "$env:USERPROFILE\inboxorcist"

Write-Host "  OS:           " -NoNewline
Write-Color "Windows" "Cyan"
Write-Host "  Architecture: " -NoNewline
Write-Color $arch "Cyan"
Write-Host "  Install to:   " -NoNewline
Write-Color $installDir "Cyan"
Write-Host ""

# GitHub repo
$repo = "inboxorcist/inboxorcist"

Write-Color "Fetching latest release..." "Yellow"

try {
    $releases = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/latest" -Headers @{ "User-Agent" = "Inboxorcist-Installer" }
    $version = $releases.tag_name
} catch {
    Write-Color "Failed to fetch latest version: $_" "Red"
    exit 1
}

Write-Host "  Version: " -NoNewline
Write-Color $version "Cyan"
Write-Host ""

# Construct download URL
$filename = "inboxorcist-windows-$arch.zip"
$downloadUrl = "https://github.com/$repo/releases/download/$version/$filename"

Write-Color "Downloading $filename..." "Yellow"

# Create temp directory
$tempDir = Join-Path $env:TEMP "inboxorcist-install-$(Get-Random)"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

try {
    # Download
    $zipPath = Join-Path $tempDir $filename
    try {
        Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath -UseBasicParsing
    } catch {
        Write-Color "Failed to download from $downloadUrl" "Red"
        Write-Color "Make sure the release exists and includes binaries for Windows." "Yellow"
        exit 1
    }

    # Extract
    Write-Color "Extracting..." "Yellow"

    # Remove existing installation if present
    if (Test-Path $installDir) {
        # Keep .env and data folder if they exist
        $envBackup = $null
        $dataBackup = $null

        if (Test-Path "$installDir\.env") {
            $envBackup = Get-Content "$installDir\.env" -Raw
        }
        if (Test-Path "$installDir\data") {
            $dataBackup = "$tempDir\data-backup"
            Copy-Item -Path "$installDir\data" -Destination $dataBackup -Recurse
        }

        Remove-Item -Path $installDir -Recurse -Force
    }

    # Create install directory
    New-Item -ItemType Directory -Path $installDir -Force | Out-Null

    # Extract zip
    Expand-Archive -Path $zipPath -DestinationPath $installDir -Force

    # Check if files are in a subdirectory and move them up if needed
    $subDirs = Get-ChildItem -Path $installDir -Directory
    if ($subDirs.Count -eq 1 -and (Get-ChildItem -Path $installDir -File).Count -eq 0) {
        $subDir = $subDirs[0].FullName
        Get-ChildItem -Path $subDir | Move-Item -Destination $installDir
        Remove-Item -Path $subDir -Force
    }

    # Restore .env and data if backed up
    if ($envBackup) {
        Set-Content -Path "$installDir\.env" -Value $envBackup
    }
    if ($dataBackup) {
        Copy-Item -Path $dataBackup -Destination "$installDir\data" -Recurse
    }

    Write-Host ""
    Write-Color "Installation complete!" "Green"
    Write-Host ""

    Write-Host "To start Inboxorcist:"
    Write-Host "  " -NoNewline
    Write-Color "& `"$installDir\inboxorcist.exe`"" "Cyan"
    Write-Host ""

    Write-Host "To run from anywhere, add to your PATH:"
    Write-Host "  " -NoNewline
    Write-Color "[Environment]::SetEnvironmentVariable(`"PATH`", `$env:PATH + `";$installDir`", `"User`")" "Cyan"
    Write-Host "  Then restart PowerShell and run: " -NoNewline
    Write-Color "inboxorcist" "Cyan"
    Write-Host ""

    Write-Host "For more info: " -NoNewline
    Write-Color "https://github.com/$repo" "Cyan"
    Write-Host ""

    # Ask if user wants to start now
    $start = Read-Host "Start Inboxorcist now? (Y/n)"
    if ($start -ne "n" -and $start -ne "N") {
        & "$installDir\inboxorcist.exe"
    }

} finally {
    # Cleanup temp directory
    if (Test-Path $tempDir) {
        Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}
