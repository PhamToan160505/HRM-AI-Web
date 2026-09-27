param(
    [string]$ConfigPath = "$PSScriptRoot\..\..\src\main\resources\application.yml",
    [string]$MigrationPath = "$PSScriptRoot\..\..\src\main\resources\db\migration\V1__baseline_schema.sql",
    [int]$ExpectedTableCount = 23
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Get-ConfigValue {
    param([string]$Content, [string]$Pattern, [string]$Label)
    $match = [regex]::Match($Content, $Pattern)
    if (-not $match.Success) {
        throw "Cannot read $Label from $ConfigPath"
    }
    return $match.Groups[1].Value.Trim()
}

$content = Get-Content -LiteralPath (Resolve-Path -LiteralPath $ConfigPath) -Raw -Encoding UTF8
$jdbcUrl = Get-ConfigValue $content '(?m)^\s*url:\s*([^\r\n]+)' 'datasource URL'
$username = Get-ConfigValue $content '(?m)^\s*username:\s*([^\r\n]+)' 'datasource username'
$password = Get-ConfigValue $content '(?m)^\s*password:\s*([^\r\n]*)' 'datasource password'
$urlMatch = [regex]::Match($jdbcUrl, '^jdbc:mysql://([^/:]+)(?::(\d+))?/([^?]+)')
if (-not $urlMatch.Success) {
    throw "Only MySQL JDBC URLs are supported: $jdbcUrl"
}

$dbHost = $urlMatch.Groups[1].Value
$dbPort = if ($urlMatch.Groups[2].Success) { $urlMatch.Groups[2].Value } else { '3306' }
$testDatabase = 'hrm_ai_flyway_verify_' + (Get-Date -Format 'yyyyMMddHHmmss')
if ($testDatabase -notmatch '^hrm_ai_flyway_verify_[0-9]{14}$') {
    throw 'Unsafe temporary database name.'
}

$mysqlCommand = Get-Command mysql -ErrorAction SilentlyContinue
$mysqlExecutable = if ($mysqlCommand) {
    $mysqlCommand.Source
} else {
    'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe'
}
if (-not (Test-Path -LiteralPath $mysqlExecutable)) {
    throw 'MySQL client was not found.'
}

$migration = (Resolve-Path -LiteralPath $MigrationPath).Path.Replace('\', '/')
$previousMysqlPassword = [Environment]::GetEnvironmentVariable('MYSQL_PWD')

try {
    $env:MYSQL_PWD = $password
    & $mysqlExecutable -h $dbHost -P $dbPort -u $username -e "CREATE DATABASE ``$testDatabase`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    if ($LASTEXITCODE -ne 0) {
        throw 'Could not create the temporary verification database.'
    }

    & $mysqlExecutable -h $dbHost -P $dbPort -u $username $testDatabase -e "SOURCE $migration;"
    if ($LASTEXITCODE -ne 0) {
        throw 'Baseline V1 failed on an empty database.'
    }

    $createdTableCount = & $mysqlExecutable -h $dbHost -P $dbPort -u $username -N -B -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$testDatabase';"
    if ([int]$createdTableCount -ne $ExpectedTableCount) {
        throw "Baseline created $createdTableCount tables; expected $ExpectedTableCount."
    }

    [pscustomobject]@{
        TemporaryDatabase = $testDatabase
        CreatedTables = [int]$createdTableCount
        BaselineValid = $true
    }
} finally {
    if ($testDatabase -match '^hrm_ai_flyway_verify_[0-9]{14}$') {
        & $mysqlExecutable -h $dbHost -P $dbPort -u $username -e "DROP DATABASE IF EXISTS ``$testDatabase``;" | Out-Null
    }
    if ($null -eq $previousMysqlPassword) {
        Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
    } else {
        $env:MYSQL_PWD = $previousMysqlPassword
    }
}
