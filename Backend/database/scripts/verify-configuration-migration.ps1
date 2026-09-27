param(
    [string]$ConfigPath = "$PSScriptRoot\..\..\src\main\resources\application.yml",
    [string]$BaselinePath = "$PSScriptRoot\..\..\src\main\resources\db\migration\V1__baseline_schema.sql",
    [string]$StateMachinePath = "$PSScriptRoot\..\..\src\main\resources\db\migration\V2__recruitment_state_machine.sql",
    [string]$AuditPath = "$PSScriptRoot\..\..\src\main\resources\db\migration\V3__baseline_legacy_recruitment_audit.sql",
    [string]$ConfigurationPath = "$PSScriptRoot\..\..\src\main\resources\db\migration\V4__configuration_and_scoring_versions.sql"
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
$testDatabase = 'hrm_ai_configuration_verify_' + (Get-Date -Format 'yyyyMMddHHmmss')
if ($testDatabase -notmatch '^hrm_ai_configuration_verify_[0-9]{14}$') { throw 'Unsafe temporary database name.' }

$mysqlCommand = Get-Command mysql -ErrorAction SilentlyContinue
$mysqlExecutable = if ($mysqlCommand) { $mysqlCommand.Source } else { 'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe' }
if (-not (Test-Path -LiteralPath $mysqlExecutable)) { throw 'MySQL client was not found.' }

$migrationFiles = @($BaselinePath, $StateMachinePath, $AuditPath, $ConfigurationPath) |
    ForEach-Object { (Resolve-Path -LiteralPath $_).Path.Replace('\', '/') }
$previousMysqlPassword = [Environment]::GetEnvironmentVariable('MYSQL_PWD')

try {
    $env:MYSQL_PWD = $password
    & $mysqlExecutable -h $dbHost -P $dbPort -u $username -e "CREATE DATABASE ``$testDatabase`` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"
    if ($LASTEXITCODE -ne 0) { throw 'Could not create the temporary verification database.' }

    & $mysqlExecutable -h $dbHost -P $dbPort -u $username $testDatabase -e "SOURCE $($migrationFiles[0]);"
    if ($LASTEXITCODE -ne 0) { throw 'Baseline V1 failed.' }

    $fixtureSql = @"
INSERT INTO users (active, created_at, email, ho_ten, password_hash, role, so_nguoi_phu_thuoc)
VALUES (b'1', NOW(6), 'configuration@example.test', 'Configuration Test', 'not-used', 'ADMIN', 0);
INSERT INTO job_requisitions (reason, requester_id, so_luong, status, target_role, title)
VALUES ('Configuration fixture', 1, 1, 'POSTED', 'NHAN_VIEN', 'Legacy requisition');
INSERT INTO job_postings (so_luong_tuyen, han_nop_ho_so, ngay_bat_dau, description, requirements, dia_diem, slug, status, title, hinh_thuc_lam_viec, target_role, job_requisition_id)
VALUES (1, DATE_ADD(NOW(6), INTERVAL 7 DAY), NOW(6), 'Backend engineering role', 'Java and Spring', 'HCM', 'configuration-posting', 'OPEN', 'Backend Engineer', 'FULL_TIME', 'NHAN_VIEN', 1);
INSERT INTO applications (fraud_flagged, job_posting_id, email, full_name, phone, approval_status, is_priority, needs_verification)
VALUES (b'0', 1, 'candidate@example.test', 'Candidate Test', '0900000000', 'NEW', b'0', b'0');
"@
    & $mysqlExecutable -h $dbHost -P $dbPort -u $username $testDatabase -e $fixtureSql
    if ($LASTEXITCODE -ne 0) { throw 'Could not create legacy fixtures.' }

    foreach ($migration in $migrationFiles[1..3]) {
        & $mysqlExecutable -h $dbHost -P $dbPort -u $username $testDatabase -e "SOURCE $migration;"
        if ($LASTEXITCODE -ne 0) { throw "Migration failed: $migration" }
    }

    $result = & $mysqlExecutable -h $dbHost -P $dbPort -u $username -N -B $testDatabase -e @"
SELECT CONCAT_WS('|',
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '$testDatabase' AND table_name IN ('system_configurations','scoring_profiles','scoring_parameters','legal_parameters','redaction_rules','injection_patterns','common_phrases','screening_criteria_sets','ai_analyses')),
    (SELECT COUNT(*) FROM scoring_profiles WHERE status = 'ACTIVE'),
    (SELECT COUNT(*) FROM scoring_parameters),
    (SELECT COUNT(*) FROM job_postings WHERE criteria_version_id IS NOT NULL AND scoring_profile_version_id IS NOT NULL),
    (SELECT COUNT(*) FROM screening_criteria_sets WHERE status = 'CONFIRMED'),
    (SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema = '$testDatabase' AND trigger_name IN ('trg_scoring_parameters_no_update','trg_scoring_parameters_no_delete'))
);
"@
    $expected = '9|1|12|1|1|2'
    if ($result.Trim() -ne $expected) {
        throw "Unexpected Stage 2 verification result: $result (expected $expected)"
    }

    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    & $mysqlExecutable -h $dbHost -P $dbPort -u $username $testDatabase -e "UPDATE scoring_parameters SET parameter_value = '999' LIMIT 1;" 2>&1 | Out-Null
    $immutableExitCode = $LASTEXITCODE
    $ErrorActionPreference = $previousErrorActionPreference
    if ($immutableExitCode -eq 0) { throw 'Immutable scoring parameter trigger did not reject UPDATE.' }

    [pscustomobject]@{
        TemporaryDatabase = $testDatabase
        ConfigurationTables = 9
        ActiveProfiles = 1
        ScoringParameters = 12
        LockedLegacyPostings = 1
        ImmutableUpdateRejected = $true
        MigrationValid = $true
    }
} finally {
    if ($testDatabase -match '^hrm_ai_configuration_verify_[0-9]{14}$') {
        & $mysqlExecutable -h $dbHost -P $dbPort -u $username -e "DROP DATABASE IF EXISTS ``$testDatabase``;" | Out-Null
    }
    if ($null -eq $previousMysqlPassword) {
        Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
    } else {
        $env:MYSQL_PWD = $previousMysqlPassword
    }
}
