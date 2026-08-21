# SW-OpenC64 local launcher. Double-click launch.bat, or:
#   powershell -ExecutionPolicy Bypass -File .\launch.ps1
$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot

$NodeVersion = "v22.18.0"
$Tools = Join-Path $PSScriptRoot ".tools"
$PortableNodeDir = Join-Path $Tools "node"
$Url = "http://127.0.0.1:8082/"

function Test-OpenC64 {
  try {
    $req = [System.Net.WebRequest]::Create($Url)
    $req.Timeout = 1500
    $req.Method = "GET"
    $resp = $req.GetResponse()
    $ok = [int]$resp.StatusCode -ge 200 -and [int]$resp.StatusCode -lt 500
    $resp.Close()
    return $ok
  } catch {
    return $false
  }
}

function Open-Browser {
  Write-Host "Opening $Url"
  Start-Process $Url
}

if (Test-OpenC64) {
  Write-Host "SW-OpenC64 is already running."
  Open-Browser
  exit 0
}

function Find-NodeExe {
  foreach ($name in @("node.exe", "node")) {
    $cmd = Get-Command $name -ErrorAction SilentlyContinue
    if ($cmd -and $cmd.Source -and (Test-Path $cmd.Source)) { return $cmd.Source }
  }
  $portable = Join-Path $PortableNodeDir "node.exe"
  if (Test-Path $portable) { return $portable }
  return $null
}

function Install-PortableNode {
  $zipName = "node-$NodeVersion-win-x64.zip"
  $url = "https://nodejs.org/dist/$NodeVersion/$zipName"
  New-Item -ItemType Directory -Force -Path $Tools | Out-Null
  $zip = Join-Path $Tools $zipName
  Write-Host "Node.js not found. Downloading portable $NodeVersion (~30 MB)..."
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
  $extract = Join-Path $Tools "extract"
  if (Test-Path $extract) { Remove-Item -Recurse -Force $extract }
  Expand-Archive -Path $zip -DestinationPath $extract
  $inner = Get-ChildItem $extract -Directory | Select-Object -First 1
  if (-not $inner) { throw "Node zip did not contain a folder" }
  if (Test-Path $PortableNodeDir) { Remove-Item -Recurse -Force $PortableNodeDir }
  Move-Item $inner.FullName $PortableNodeDir
  Remove-Item $zip -Force
  Remove-Item $extract -Recurse -Force -ErrorAction SilentlyContinue
  Write-Host "Portable Node installed at $PortableNodeDir"
}

$node = Find-NodeExe
if (-not $node) {
  Install-PortableNode
  $node = Join-Path $PortableNodeDir "node.exe"
}
if (-not (Test-Path $node)) { throw "Could not find or install Node.js" }

$nodeDir = Split-Path -Parent $node
$env:Path = "$nodeDir;$env:Path"
$npm = Join-Path $nodeDir "npm.cmd"
if (-not (Test-Path $npm)) { $npm = "npm.cmd" }

Write-Host "Using Node: $(& $node -v)"

if (-not (Test-Path (Join-Path $PSScriptRoot "node_modules"))) {
  Write-Host "Installing dependencies (first run, a few minutes)..."
  & $npm install
  if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
}

Write-Host "Starting SW-OpenC64 at $Url"
Write-Host "Leave this window open while you play. Close it to stop the emulator host."

$watcher = Start-Job -ScriptBlock {
  $url = $using:Url
  for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 1
    try {
      $req = [System.Net.WebRequest]::Create($url)
      $req.Timeout = 1000
      $resp = $req.GetResponse()
      $resp.Close()
      Start-Process $url
      return
    } catch {
      # still starting
    }
  }
}

try {
  & $npm run dev
  if ($LASTEXITCODE -ne 0 -and (Test-OpenC64)) {
    Write-Host "Port 8082 is already serving SW-OpenC64."
    Open-Browser
    exit 0
  }
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Dev server exited. If you saw 'Port 8082 is already in use', just open $Url"
    exit $LASTEXITCODE
  }
} finally {
  Stop-Job $watcher -ErrorAction SilentlyContinue
  Remove-Job $watcher -Force -ErrorAction SilentlyContinue
}
