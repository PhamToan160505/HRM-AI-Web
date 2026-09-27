param(
    [string]$ConfigPath = "$PSScriptRoot\..\..\src\main\resources\application.yml",
    [string]$BaselinePath = "$PSScriptRoot\..\..\src\main\resources\db\migration\V1__baseline_schema.sql",
    [string]$MigrationPath = "$PSScriptRoot\..\..\src\main\resources\db\migration\V2__recruitment_state_machine.sql",
    [string]$AuditBaselinePath = "$PSScriptRoot\..\..\src\main\resources\db\migration\V3__baseline_legacy_recruitment_audit.sql"
)

$ErrorActionPreference = 'Stop'
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
$testDatabase = 'hrm_ai_recruitment_verify_' + (Get-Date -Format 'yyyyMMddHHmmss')
if ($testDatabase -notmatch '^hrm_ai_recruitment_verify_[0-9]{14}$') {
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

$baseline = (Resolve-Path -LiteralPath $BaselinePath).Path.Replace('\', '/')
$migration = (Resolve-Path -LiteralPath $MigrationPath).Path.Replace('\', '/')
$auditBaseline = (Resolve-Path -LiteralPath $AuditBaselinePath).Path.Replace('\', '/')
$previousMysqlPassword = [Environment]::GetEnvironmentVariable('MYSQL_PWD')

try {
    $env:MYSQL_PWD = $password
    & $mysqlExecutable -h $dbHost -P $dbPort -u $username -e "CREATE DATABASE ``$testDatabase`` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"
    if ($LASTEXITCODE -ne 0) { throw 'Could not create the temporary verification database.' }

    & $mysqlExecutable -h $dbHost -P $dbPort -u $username $testDatabase -e "SOURCE $baseline;"
    if ($LASTEXITCODE -ne 0) { throw 'Baseline V1 failed.' }

    $fixtureSql = @"
INSERT INTO users (active, created_at, email, ho_ten, password_hash, role, so_nguoi_phu_thuoc)
VALUES (b'1', NOW(6), 'migration@example.test', 'Migration Test', 'not-used', 'ADMIN', 0);
INSERT INTO job_requisitions (reason, requester_id, so_luong, status, target_role, title)
VALUES ('Migration fixture', 1, 1, 'PENDING_CEO', 'NHAN_VIEN', 'Legacy requisition');
INSERT INTO job_postings (so_luong_tuyen, han_nop_ho_so, ngay_bat_dau, description, dia_diem, slug, status, title, hinh_thuc_lam_viec, target_role)
VALUES (1, DATE_ADD(NOW(6), INTERVAL 7 DAY), NOW(6), 'Migration fixture', 'HCM', 'legacy-posting', 'CLOSED', 'Legacy posting', 'FULL_TIME', 'NHAN_VIEN');
INSERT INTO applications (fraud_flagged, job_posting_id, email, full_name, phone, approval_status, is_priority, needs_verification)
VALUES (b'0', 1, 'candidate@example.test', 'Candidate Test', '0900000000', 'NEW', b'0', b'0');
"@
    & $mysqlExecutable -h $dbHost -P $dbPort -u $username $testDatabase -e $fixtureSql
    if ($LASTEXITCODE -ne 0) { throw 'Could not create legacy fixtures.' }

    & $mysqlExecutable -h $dbHost -P $dbPort -u $username $testDatabase -e "SOURCE $migration;"
    if ($LASTEXITCODE -ne 0) { throw 'Recruitment migration V2 failed.' }

    & $mysqlExecutable -h $dbHost -P $dbPort -u $username $testDatabase -e "SOURCE $auditBaseline;"
    if ($LASTEXITCODE -ne 0) { throw 'Recruitment audit baseline V3 failed.' }

    $result = & $mysqlExecutable -h $dbHost -P $dbPort -u $username -N -B $testDatabase -e @"
SELECT CONCAT_WS('|',
    (SELECT approval_status FROM applications WHERE id = 1),
    (SELECT status FROM job_requisitions WHERE id = 1),
    (SELECT status FROM job_postings WHERE id = 1),
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '$testDatabase'),
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = '$testDatabase' AND table_name IN ('applications','job_requisitions','job_postings') AND column_name = 'version'),
    (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = '$testDatabase' AND index_name IN ('uk_application_posting_email','uk_application_posting_phone')),
    (SELECT COUNT(*) FROM application_transition_logs WHERE action = 'LEGACY_BASELINE')
);
"@
    $expected = 'PENDING_HR_CV_REVIEW|PENDING_APPROVAL|PAUSED|24|3|4|3'
    if ($result.Trim() -ne $expected) {
        throw "Unexpected verification result: $result (expected $expected)"
    }

    [pscustomobject]@{
        TemporaryDatabase = $testDatabase
        LegacyApplicationMappedTo = 'PENDING_HR_CV_REVIEW'
        LegacyRequisitionMappedTo = 'PENDING_APPROVAL'
        LegacyPostingMappedTo = 'PAUSED'
        Tables = 24
        VersionColumns = 3
        LegacyAuditBaselines = 3
        MigrationValid = $true
    }
} finally {
    if ($testDatabase -match '^hrm_ai_recruitment_verify_[0-9]{14}$') {
        & $mysqlExecutable -h $dbHost -P $dbPort -u $username -e "DROP DATABASE IF EXISTS ``$testDatabase``;" | Out-Null
    }
    if ($null -eq $previousMysqlPassword) {
        Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
    } else {
        $env:MYSQL_PWD = $previousMysqlPassword
    }
}
