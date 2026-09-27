param(
    [string]$ConfigPath = "$PSScriptRoot\..\..\src\main\resources\application.yml",
    [string]$OutputDirectory = "$PSScriptRoot\..\backups"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Get-RequiredMatch {
    param(
        [string]$Content,
        [string]$Pattern,
        [string]$Label
    )

    $match = [regex]::Match($Content, $Pattern)
    if (-not $match.Success) {
        throw "Không đọc được $Label từ $ConfigPath"
    }
    return $match.Groups[1].Value.Trim()
}

function Resolve-ConfigValue {
    param([string]$Value)

    $placeholder = [regex]::Match($Value, '^\$\{([A-Za-z_][A-Za-z0-9_]*)(?::([^}]*))?\}$')
    if (-not $placeholder.Success) {
        return $Value
    }

    $environmentValue = [Environment]::GetEnvironmentVariable($placeholder.Groups[1].Value)
    if (-not [string]::IsNullOrWhiteSpace($environmentValue)) {
        return $environmentValue
    }
    if ($placeholder.Groups[2].Success) {
        return $placeholder.Groups[2].Value
    }
    throw "Thiếu biến môi trường $($placeholder.Groups[1].Value)"
}

$resolvedConfig = (Resolve-Path -LiteralPath $ConfigPath).Path
$content = Get-Content -LiteralPath $resolvedConfig -Raw -Encoding UTF8
$jdbcUrl = Resolve-ConfigValue (Get-RequiredMatch $content '(?m)^\s*url:\s*([^\r\n]+)' 'datasource URL')
$username = Resolve-ConfigValue (Get-RequiredMatch $content '(?m)^\s*username:\s*([^\r\n]+)' 'datasource username')
$password = Resolve-ConfigValue (Get-RequiredMatch $content '(?m)^\s*password:\s*([^\r\n]*)' 'datasource password')

$urlMatch = [regex]::Match($jdbcUrl, '^jdbc:mysql://([^/:]+)(?::(\d+))?/([^?]+)')
if (-not $urlMatch.Success) {
    throw "Chỉ hỗ trợ JDBC MySQL URL, nhận được: $jdbcUrl"
}

$dbHost = $urlMatch.Groups[1].Value
$dbPort = if ($urlMatch.Groups[2].Success) { $urlMatch.Groups[2].Value } else { '3306' }
$dbName = $urlMatch.Groups[3].Value

$dumpCommand = Get-Command mysqldump -ErrorAction SilentlyContinue
$dumpExecutable = if ($dumpCommand) {
    $dumpCommand.Source
} else {
    'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqldump.exe'
}
if (-not (Test-Path -LiteralPath $dumpExecutable)) {
    throw 'Không tìm thấy mysqldump. Hãy cài MySQL Client hoặc thêm mysqldump vào PATH.'
}

$resolvedOutput = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Force -Path $resolvedOutput | Out-Null
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupPath = Join-Path $resolvedOutput "$dbName-$timestamp.sql"
$previousMysqlPassword = [Environment]::GetEnvironmentVariable('MYSQL_PWD')

try {
    $env:MYSQL_PWD = $password
    & $dumpExecutable `
        -h $dbHost `
        -P $dbPort `
        -u $username `
        --single-transaction `
        --routines `
        --triggers `
        --events `
        --no-tablespaces `
        --default-character-set=utf8mb4 `
        --databases $dbName `
        --result-file=$backupPath

    if ($LASTEXITCODE -ne 0) {
        throw "mysqldump thất bại với mã $LASTEXITCODE"
    }
} finally {
    if ($null -eq $previousMysqlPassword) {
        Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
    } else {
        $env:MYSQL_PWD = $previousMysqlPassword
    }
}

$backup = Get-Item -LiteralPath $backupPath
if ($backup.Length -le 0) {
    throw 'File backup rỗng.'
}

$hash = Get-FileHash -LiteralPath $backupPath -Algorithm SHA256
$hashPath = "$backupPath.sha256"
[System.IO.File]::WriteAllText($hashPath, "$($hash.Hash)  $($backup.Name)`r`n")

[pscustomobject]@{
    Database = $dbName
    BackupPath = $backup.FullName
    Bytes = $backup.Length
    Sha256 = $hash.Hash
    ChecksumPath = $hashPath
}
