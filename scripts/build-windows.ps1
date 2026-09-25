# Freedom Browser - Windows Native Build & Packaging Script
# Requires: Node.js (build-time only), Rust (build-time only), Visual Studio Build Tools, WebView2 Runtime (installed by default on Win 10/11)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " FREEDOM BROWSER - WINDOWS BUILD SCRIPT" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# Check for Rust
if (-not (Get-Command "cargo" -ErrorAction SilentlyContinue)) {
    Write-Error "Rust and Cargo are required for building. Please install Rust via rustup (https://rustup.rs)."
    exit 1
}

# Check for Node
if (-not (Get-Command "npm" -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js and npm are required during development build phase."
    exit 1
}

Write-Host "[+] Step 1: Building frontend assets with Vite..." -ForegroundColor Green
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Frontend build failed."
    exit $LASTEXITCODE
}

Write-Host "[+] Step 2: Compiling Freedom.exe with Tauri and WebView2..." -ForegroundColor Green
Set-Location src-tauri
cargo build --release
if ($LASTEXITCODE -ne 0) {
    Write-Error "Rust backend compilation failed."
    exit $LASTEXITCODE
}

Write-Host "[+] Step 3: Packaging Windows Portable & Installer bundles..." -ForegroundColor Green
cargo tauri build --bundles nsis,msi
if ($LASTEXITCODE -ne 0) {
    Write-Error "Packaging failed."
    exit $LASTEXITCODE
}

Set-Location ..

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Freedom.exe successfully built!" -ForegroundColor Green
Write-Host " Release location: src-tauri/target/release/Freedom.exe" -ForegroundColor Green
Write-Host " NSIS Installer: src-tauri/target/release/bundle/nsis/Freedom_1.0.0_x64-setup.exe" -ForegroundColor Green
Write-Host " Note: End users do NOT need Node.js, npm, or Rust installed." -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan
