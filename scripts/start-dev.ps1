$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot

function Test-Port {
    param([string]$Server, [int]$Port)
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $connection = $client.ConnectAsync($Server, $Port)
        return $connection.Wait(2000) -and $client.Connected
    } catch {
        return $false
    } finally {
        $client.Dispose()
    }
}

function Wait-Ready {
    param([scriptblock]$Check, [int]$TimeoutSeconds)
    $timer = [Diagnostics.Stopwatch]::StartNew()
    do {
        if (& $Check) { return $true }
        Start-Sleep -Seconds 2
    } while ($timer.Elapsed.TotalSeconds -lt $TimeoutSeconds)
    return $false
}

function Test-Docker {
    # Windows PowerShell can treat native stderr as an error even when redirected.
    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        & docker info --format '{{.ServerVersion}}' 2>$null | Out-Null
        return $LASTEXITCODE -eq 0
    } finally {
        $ErrorActionPreference = $previousPreference
    }
}

function Test-MySqlContainer {
    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        & docker compose -f docker-compose.yml exec -T mysql mysqladmin ping -h 127.0.0.1 --silent 2>$null | Out-Null
        return $LASTEXITCODE -eq 0
    } finally {
        $ErrorActionPreference = $previousPreference
    }
}

function Get-DatabaseEndpoint {
    $url = $env:SPRING_DATASOURCE_URL
    if (-not $url) {
        $configuration = Get-Content -LiteralPath 'Backend/src/main/resources/application.yml' -Raw
        $url = [regex]::Match($configuration, '(?m)^\s*url:\s*([^\r\n]+)').Groups[1].Value.Trim().Trim([char]34, [char]39)
    }
    if ($url -match '^\$\{([^}:]+)(?::([^}]*))?\}$') {
        $environmentValue = [Environment]::GetEnvironmentVariable($Matches[1])
        $defaultValue = $Matches[2]
        $url = if ($environmentValue) { $environmentValue } else { $defaultValue }
    }
    if ($url -notmatch '^jdbc:mysql://([^/:]+)(?::(\d+))?/') {
        throw 'Khong doc duoc dia chi MySQL. Kiem tra application.yml va bien moi truong.'
    }
    $databasePort = 3306
    if ($Matches[2]) { $databasePort = [int]$Matches[2] }
    return @{ Server = $Matches[1]; Port = $databasePort }
}

function Test-Backend {
    # A valid but nonexistent account exercises the DB connection as well as HTTP.
    $body = '{"maNhanVien":"__hrm_start_probe__","password":"__startup_probe__"}'
    try {
        Invoke-WebRequest -Uri 'http://localhost:8080/api/auth/login' -Method Post `
            -ContentType 'application/json' -Body $body -UseBasicParsing -TimeoutSec 3 | Out-Null
        return $false
    } catch {
        return $_.Exception.Response -and [int]$_.Exception.Response.StatusCode -eq 401
    }
}

function Test-Frontend {
    # Vite can bind only to IPv6 localhost, so check HTTP instead of an IPv4 socket.
    try {
        $response = Invoke-WebRequest -Uri 'http://localhost:5173/login' -UseBasicParsing -TimeoutSec 3
        return $response.StatusCode -eq 200
    } catch {
        return $false
    }
}

function Open-Terminal {
    param([string]$Mode)
    $launcher = Join-Path $projectRoot 'start.bat'
    $arguments = '/d /k ""' + $launcher + '" ' + $Mode + '"'
    Start-Process -FilePath $env:ComSpec -ArgumentList $arguments `
        -WorkingDirectory $projectRoot -WindowStyle Normal
}

try {
    Write-Host 'HRM AI - KHOI DONG FRONTEND VA BACKEND'
    foreach ($command in @('java.exe', 'node.exe', 'npm.cmd')) {
        if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
            throw "Khong tim thay $command. Hay kiem tra cai dat Java/Node.js va PATH."
        }
    }
    foreach ($path in @('Backend/pom.xml', 'Frontend/package.json', 'Backend/src/main/resources/application.yml')) {
        if (-not (Test-Path -LiteralPath $path)) { throw "Thieu file $path" }
    }

    $database = Get-DatabaseEndpoint
    if (-not (Test-Port -Server $database.Server -Port $database.Port)) {
        if ($database.Server -notin @('localhost', '127.0.0.1', '::1')) {
            throw "Khong ket noi duoc MySQL tai $($database.Server):$($database.Port)."
        }
        if (-not (Get-Command docker.exe -ErrorAction SilentlyContinue)) {
            throw 'Database chua chay. Hay bat MySQL hoac cai Docker Desktop.'
        }
        if (-not (Test-Docker)) {
            $desktopPath = Join-Path $env:ProgramFiles 'Docker/Docker/Docker Desktop.exe'
            if (-not (Test-Path -LiteralPath $desktopPath)) { throw 'Hay mo Docker Desktop va chay lai.' }
            Write-Host 'Dang bat Docker Desktop...'
            Start-Process -FilePath $desktopPath -WindowStyle Hidden
            if (-not (Wait-Ready -Check { Test-Docker } -TimeoutSeconds 180)) {
                throw 'Docker Desktop chua san sang sau 3 phut. Kiem tra cua so Docker Desktop.'
            }
        }
        Write-Host 'Dang khoi dong MySQL va Redis...'
        & docker compose -f docker-compose.yml up -d mysql redis
        if ($LASTEXITCODE -ne 0) { throw 'Khong khoi dong duoc MySQL/Redis. Kiem tra Docker Desktop.' }
        Write-Host 'Dang cho MySQL san sang...'
        if (-not (Wait-Ready -TimeoutSeconds 120 -Check { Test-MySqlContainer })) {
            throw 'MySQL chua san sang. Kiem tra log container hrm_mysql.'
        }
        if (-not (Test-Port -Server $database.Server -Port $database.Port)) {
            throw "Database trong cau hinh khong lang nghe tai $($database.Server):$($database.Port)."
        }
    }

    if (-not (Test-Backend)) {
        if (Test-Port -Server 'localhost' -Port 8080) {
            throw 'Cong 8080 dang bi chiem hoac backend dang loi. Kiem tra cua so HRM Backend.'
        }
        Open-Terminal -Mode 'backend'
        Write-Host 'Dang cho backend ket noi database va khoi dong...'
        if (-not (Wait-Ready -Check { Test-Backend } -TimeoutSeconds 180)) {
            throw 'Backend chua san sang. Xem loi trong cua so HRM Backend roi chay lai start.bat.'
        }
    } else {
        Write-Host 'Backend da chay.'
    }

    if (-not (Test-Frontend)) {
        Open-Terminal -Mode 'frontend'
        Write-Host 'Dang cho frontend khoi dong...'
        if (-not (Wait-Ready -Check { Test-Frontend } -TimeoutSeconds 180)) {
            throw 'Frontend chua san sang. Xem loi trong cua so HRM Frontend.'
        }
    } else {
        Write-Host 'Frontend da chay.'
    }
    Write-Host ''
    Write-Host 'DA SAN SANG: http://localhost:5173'
    Write-Host 'Dong cua so HRM Backend va HRM Frontend de dung ung dung.'
    exit 0
} catch {
    Write-Host ("[LOI] " + $_.Exception.Message) -ForegroundColor Red
    exit 1
}
