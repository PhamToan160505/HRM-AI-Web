param(
    [string]$ConfigPath = "$PSScriptRoot\..\..\src\main\resources\application.yml",
    [string]$MigrationDirectory = "$PSScriptRoot\..\..\src\main\resources\db\migration"
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Get-ConfigValue {
    param([string]$Content, [string]$Pattern, [string]$Label)
    $match = [regex]::Match($Content, $Pattern)
    if (-not $match.Success) { throw "Cannot read $Label from $ConfigPath" }
    return $match.Groups[1].Value.Trim()
}

$content = Get-Content -LiteralPath (Resolve-Path -LiteralPath $ConfigPath) -Raw -Encoding UTF8
$jdbcUrl = Get-ConfigValue $content '(?m)^\s*url:\s*([^\r\n]+)' 'datasource URL'
$username = Get-ConfigValue $content '(?m)^\s*username:\s*([^\r\n]+)' 'datasource username'
$password = Get-ConfigValue $content '(?m)^\s*password:\s*([^\r\n]*)' 'datasource password'
$urlMatch = [regex]::Match($jdbcUrl, '^jdbc:mysql://([^/:]+)(?::(\d+))?/([^?]+)')
if (-not $urlMatch.Success) { throw "Only MySQL JDBC URLs are supported: $jdbcUrl" }

$dbHost = $urlMatch.Groups[1].Value
$dbPort = if ($urlMatch.Groups[2].Success) { $urlMatch.Groups[2].Value } else { '3306' }
$testDatabase = 'hrm_ai_approval_verify_' + (Get-Date -Format 'yyyyMMddHHmmss')
if ($testDatabase -notmatch '^hrm_ai_approval_verify_[0-9]{14}$') { throw 'Unsafe temporary database name.' }

$mysqlCommand = Get-Command mysql -ErrorAction SilentlyContinue
$mysqlExecutable = if ($mysqlCommand) { $mysqlCommand.Source } else { 'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe' }
if (-not (Test-Path -LiteralPath $mysqlExecutable)) { throw 'MySQL client was not found.' }

$migrationFiles = 1..5 | ForEach-Object {
    $version = $_
    $path = Get-ChildItem -LiteralPath $MigrationDirectory -Filter "V${version}__*.sql" -File
    if (@($path).Count -ne 1) { throw "Expected exactly one V$version migration." }
    $path.FullName.Replace('\', '/')
}
$previousMysqlPassword = [Environment]::GetEnvironmentVariable('MYSQL_PWD')

try {
    $env:MYSQL_PWD = $password
    & $mysqlExecutable -h $dbHost -P $dbPort -u $username -e "CREATE DATABASE ``$testDatabase`` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"
    if ($LASTEXITCODE -ne 0) { throw 'Could not create temporary verification database.' }

    & $mysqlExecutable -h $dbHost -P $dbPort -u $username $testDatabase -e "SOURCE $($migrationFiles[0]);"
    if ($LASTEXITCODE -ne 0) { throw 'Baseline V1 failed.' }

    $fixtureSql = @"
INSERT INTO users (active, created_at, email, ho_ten, ma_nhan_vien, password_hash, role, so_nguoi_phu_thuoc)
VALUES
  (b'1', NOW(6), 'requester@example.test', 'Requester', '88000001', 'not-used', 'GIAM_DOC_PHONG_BAN', 0),
  (b'1', NOW(6), 'ceo@example.test', 'CEO Approver', '99000002', 'not-used', 'CEO', 0),
  (b'1', NOW(6), 'admin@example.test', 'Admin Fallback', '99000001', 'not-used', 'ADMIN', 0);
INSERT INTO job_requisitions (reason, requester_id, so_luong, status, target_role, title, description)
VALUES ('Approval fixture', 1, 1, 'PENDING_CEO', 'NHAN_VIEN', 'Backend Engineer', 'Build and operate backend services');
"@
    & $mysqlExecutable -h $dbHost -P $dbPort -u $username $testDatabase -e $fixtureSql
    if ($LASTEXITCODE -ne 0) { throw 'Could not create approval fixtures.' }

    foreach ($migration in $migrationFiles[1..4]) {
        & $mysqlExecutable -h $dbHost -P $dbPort -u $username $testDatabase -e "SOURCE $migration;"
        if ($LASTEXITCODE -ne 0) { throw "Migration failed: $migration" }
    }

    $result = & $mysqlExecutable -h $dbHost -P $dbPort -u $username -N -B $testDatabase -e @"
SELECT CONCAT_WS('|',
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '$testDatabase' AND table_name IN ('approval_policies','approval_requests','approval_steps')),
    (SELECT COUNT(*) FROM approval_policies WHERE status = 'ACTIVE'),
    (SELECT COUNT(*) FROM approval_requests WHERE entity_type = 'JOB_REQUISITION' AND status = 'OPEN'),
    (SELECT COUNT(*) FROM approval_steps WHERE status = 'PENDING'),
    (SELECT resolved_approver_id FROM approval_steps LIMIT 1),
    (SELECT id FROM users WHERE role = 'CEO' LIMIT 1),
    (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = '$testDatabase' AND table_name = 'approval_requests' AND index_name = 'uk_approval_request_open_entity'),
    (SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema = '$testDatabase' AND trigger_name = 'trg_approval_policy_no_delete')
);
"@
    $expected = '3|5|1|1|2|2|1|1'
    if ($result.Trim() -ne $expected) {
        throw "Unexpected Stage 3 verification result: $result (expected $expected)"
    }

    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    & $mysqlExecutable -h $dbHost -P $dbPort -u $username $testDatabase -e "DELETE FROM approval_policies LIMIT 1;" 2>&1 | Out-Null
    $deleteExitCode = $LASTEXITCODE
    $ErrorActionPreference = $previousErrorActionPreference
    if ($deleteExitCode -eq 0) { throw 'Approval policy delete guard did not reject DELETE.' }

    [pscustomobject]@{
        TemporaryDatabase = $testDatabase
        ApprovalTables = 3
        ActivePolicies = 5
        BackfilledOpenRequests = 1
        ResolvedApprover = 'CEO'
        UniqueOpenRequestGuard = $true
        PolicyDeleteRejected = $true
        MigrationValid = $true
    }
} finally {
    if ($testDatabase -match '^hrm_ai_approval_verify_[0-9]{14}$') {
        & $mysqlExecutable -h $dbHost -P $dbPort -u $username -e "DROP DATABASE IF EXISTS ``$testDatabase``;" | Out-Null
    }
    if ($null -eq $previousMysqlPassword) {
        Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
    } else {
        $env:MYSQL_PWD = $previousMysqlPassword
    }
}
