#Requires -Version 5.0
$ErrorActionPreference = "Stop"

# ─── 프로젝트 루트 이동 ───
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Resolve-Path "$ScriptDir\..").Path
Set-Location $ProjectRoot

Write-Host "[INFO] 프로젝트 루트: $ProjectRoot" -ForegroundColor Blue

# ─── 버전 추출 ───
$PackageJson = Get-Content "server\package.json" -Raw | ConvertFrom-Json
$Version = $PackageJson.version
if (-not $Version) { $Version = "1.0.0" }

$Date = Get-Date -Format "yyyy-MM-dd"
$Output = "WebManager-${Date}.zip"

Write-Host "[INFO] 버전: $Version" -ForegroundColor Blue
Write-Host "[INFO] 패키징 중... → $Output" -ForegroundColor Blue

if (Test-Path $Output) { Remove-Item $Output }

# ─── 포함할 파일 수집 (제외 패턴 적용) ───
$IncludePaths = @("client", "server", "Dockerfile", ".dockerignore")
$ExcludePatterns = @(
    "client\node_modules\*",
    "server\node_modules\*",
    "server\.env",
    "server\uploads\*",
    ".git\*",
    "*.zip",
    "*.tar"
)

$FilesToInclude = @()
foreach ($path in $IncludePaths) {
    $fullPath = Join-Path $ProjectRoot $path
    if (Test-Path $fullPath -PathType Leaf) {
        $FilesToInclude += $fullPath
    }
    elseif (Test-Path $fullPath -PathType Container) {
        $files = Get-ChildItem -Path $fullPath -Recurse -File
        foreach ($file in $files) {
            $relativePath = $file.FullName.Substring($ProjectRoot.Length + 1)
            $excluded = $false
            foreach ($pattern in $ExcludePatterns) {
                if ($relativePath -like $pattern) {
                    $excluded = $true
                    break
                }
            }
            if (-not $excluded) {
                $FilesToInclude += $file.FullName
            }
        }
    }
}

Write-Host "[INFO] 파일 수: $($FilesToInclude.Count)개" -ForegroundColor Blue

# ─── ZIP 생성 ───
try {
    $TempDir = Join-Path ([System.IO.Path]::GetTempPath()) "WebManager-pack-$(Get-Date -Format 'yyyyMMddHHmmss')"
    New-Item -ItemType Directory -Path $TempDir | Out-Null

    foreach ($file in $FilesToInclude) {
        $relativePath = $file.Substring($ProjectRoot.Length + 1)
        $destPath = Join-Path $TempDir $relativePath
        $destDir = Split-Path -Parent $destPath
        if (-not (Test-Path $destDir)) {
            New-Item -ItemType Directory -Path $destDir -Force | Out-Null
        }
        Copy-Item -Path $file -Destination $destPath
    }

    $OutputPath = Join-Path $ProjectRoot $Output
    Compress-Archive -Path "$TempDir\*" -DestinationPath $OutputPath -Force
}
finally {
    if ($TempDir -and (Test-Path $TempDir)) {
        Remove-Item -Path $TempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

$Size = "{0:N1} MB" -f ((Get-Item $Output).Length / 1MB)
Write-Host "[OK] 패키징 완료: $Output ($Size)" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " $Output 생성 완료" -ForegroundColor Green
Write-Host "" -ForegroundColor Green
Write-Host " 다음 단계:" -ForegroundColor Green
Write-Host "   1. FTP로 Linux PC에 업로드" -ForegroundColor Green
Write-Host "   2. SSH 접속 후 build-image.sh 실행" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
