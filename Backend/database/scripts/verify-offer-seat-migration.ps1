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
$testDatabase = 'hrm_ai_offer_verify_' + (Get-Date -Format 'yyyyMMddHHmmss')
if ($testDatabase -notmatch '^hrm_ai_offer_verify_[0-9]{14}$') { throw 'Unsafe temporary database name.' }

$mysqlCommand = Get-Command mysql -ErrorAction SilentlyContinue
$mysqlExecutable = if ($mysqlCommand) { $mysqlCommand.Source } else { 'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe' }
if (-not (Test-Path -LiteralPath $mysqlExecutable)) { throw 'MySQL client was not found.' }

$migrationFiles = 1..11 | ForEach-Object {
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
INSERT INTO job_requisitions
  (reason, requester_id, so_luong, status, target_role, title, description, budget)
VALUES ('Offer fixture', 1, 2, 'POSTED', 'NHAN_VIEN', 'Backend Engineer',
        'Build and operate backend services', '10000000 - 20000000 VNĐ');
INSERT INTO job_postings
  (co_thoa_thuan, so_luong_tuyen, han_nop_ho_so, ngay_bat_dau, description, dia_diem,
   slug, status, title, hinh_thuc_lam_viec, job_requisition_id, target_role)
VALUES (b'0', 2, DATE_ADD(NOW(6), INTERVAL 30 DAY), NOW(6), 'Backend role', 'HCM',
        'backend-engineer-fixture', 'OPEN', 'Backend Engineer', 'FULL_TIME', 1, 'NHAN_VIEN');
INSERT INTO applications
  (fraud_flagged, job_posting_id, email, full_name, phone, approval_status, is_priority, needs_verification)
VALUES (b'0', 1, 'candidate@example.test', 'Candidate', '0900000001', 'OFFER_APPROVED', b'0', b'0');
"@
    & $mysqlExecutable -h $dbHost -P $dbPort -u $username $testDatabase -e $fixtureSql
    if ($LASTEXITCODE -ne 0) { throw 'Could not create offer fixtures.' }

    foreach ($migration in $migrationFiles[1..10]) {
        & $mysqlExecutable -h $dbHost -P $dbPort -u $username $testDatabase -e "SOURCE $migration;"
        if ($LASTEXITCODE -ne 0) { throw "Migration failed: $migration" }
    }

    $result = & $mysqlExecutable -h $dbHost -P $dbPort -u $username -N -B $testDatabase -e @"
SELECT CONCAT_WS('|',
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '$testDatabase'
        AND table_name IN ('offers','hiring_seats','offer_dispatches','seat_events','outbox_events','recruitment_tasks')),
    (SELECT COUNT(*) FROM hiring_seats WHERE kind = 'STANDARD' AND status = 'AVAILABLE'),
    (SELECT COUNT(*) FROM seat_events WHERE event_type = 'CREATED'),
    (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = '$testDatabase'
        AND table_name = 'offer_dispatches' AND index_name = 'uk_offer_dispatch_active_offer'),
    (SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema = '$testDatabase'
        AND trigger_name IN ('trg_offer_terms_immutable','trg_seat_event_no_update','trg_seat_event_no_delete'))
);
"@
    $expected = '6|2|2|1|3'
    if ($result.Trim() -ne $expected) {
        throw "Unexpected Stage 4 verification result: $result (expected $expected)"
    }

    & $mysqlExecutable -h $dbHost -P $dbPort -u $username $testDatabase -e @"
INSERT INTO offers
  (application_id, version_number, status, base_salary, allowances_json, probation_months,
   probation_salary_rate, expected_start_date, contract_terms, salary_out_of_range, created_by)
VALUES (1, 1, 'APPROVED', 15000000, JSON_OBJECT(), 2, 85, DATE_ADD(CURDATE(), INTERVAL 30 DAY),
        'Fixture terms', b'0', 1);
UPDATE hiring_seats SET status = 'RESERVED', application_id = 1, offer_id = 1 WHERE seat_number = 1;
INSERT INTO offer_dispatches
  (offer_id, seat_id, status, dispatch_key, response_token_hash, response_deadline, sent_by)
VALUES (1, 1, 'ACTIVE', 'dispatch-fixture-1', REPEAT('a', 64), DATE_ADD(NOW(6), INTERVAL 7 DAY), 1);
"@
    if ($LASTEXITCODE -ne 0) { throw 'Could not create immutable offer fixture.' }

    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    & $mysqlExecutable -h $dbHost -P $dbPort -u $username $testDatabase -e "UPDATE offers SET base_salary = 16000000 WHERE id = 1;" 2>&1 | Out-Null
    $immutableExitCode = $LASTEXITCODE
    & $mysqlExecutable -h $dbHost -P $dbPort -u $username $testDatabase -e "UPDATE seat_events SET reason = 'tampered' WHERE id = 1;" 2>&1 | Out-Null
    $appendOnlyExitCode = $LASTEXITCODE
    & $mysqlExecutable -h $dbHost -P $dbPort -u $username $testDatabase -e "INSERT INTO offer_dispatches (offer_id, seat_id, status, dispatch_key, response_token_hash, response_deadline, sent_by) VALUES (1, 1, 'ACTIVE', 'dispatch-fixture-2', REPEAT('b', 64), DATE_ADD(NOW(6), INTERVAL 8 DAY), 1);" 2>&1 | Out-Null
    $duplicateActiveDispatchExitCode = $LASTEXITCODE
    & $mysqlExecutable -h $dbHost -P $dbPort -u $username $testDatabase -e "UPDATE hiring_seats SET status = 'RESERVED', application_id = 1, offer_id = 1 WHERE seat_number = 2;" 2>&1 | Out-Null
    $duplicateSeatHolderExitCode = $LASTEXITCODE
    $ErrorActionPreference = $previousErrorActionPreference
    if ($immutableExitCode -eq 0) { throw 'Approved offer immutability guard did not reject UPDATE.' }
    if ($appendOnlyExitCode -eq 0) { throw 'Seat event append-only guard did not reject UPDATE.' }
    if ($duplicateActiveDispatchExitCode -eq 0) { throw 'Unique ACTIVE dispatch guard did not reject the second dispatch.' }
    if ($duplicateSeatHolderExitCode -eq 0) { throw 'Unique active seat holder guard did not reject the second seat.' }

    $stage5Result = & $mysqlExecutable -h $dbHost -P $dbPort -u $username -N -B $testDatabase -e @"
SELECT CONCAT_WS('|',
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '$testDatabase'
        AND table_name IN ('persons','identity_reviews','employees','employment_records','compensation_records',
                           'preboarding_checklists','preboarding_items','lifecycle_events','inbox_events')),
    (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = '$testDatabase'
        AND table_name = 'employees' AND index_name IN ('uk_employee_application','uk_employee_conversion')),
    (SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema = '$testDatabase'
        AND trigger_name IN ('trg_lifecycle_event_no_update','trg_lifecycle_event_no_delete')),
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = '$testDatabase'
        AND table_name = 'account_creation_requests' AND column_name IN ('employee_id','mode','user_id','retry_count'))
);
"@
    if ($stage5Result.Trim() -ne '9|2|2|4') {
        throw "Unexpected Stage 5 verification result: $stage5Result (expected 9|2|2|4)"
    }

    $stage67Result = & $mysqlExecutable -h $dbHost -P $dbPort -u $username -N -B $testDatabase -e @"
SELECT CONCAT_WS('|',
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '$testDatabase'
        AND table_name IN ('candidate_consents','application_documents','interviews',
                           'interview_participants','interview_feedbacks','salary_negotiations')),
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = '$testDatabase'
        AND table_name = 'job_postings' AND column_name = 'criteria_definition'),
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = '$testDatabase'
        AND table_name = 'ai_analyses'
        AND column_name IN ('model_output','computed_result','started_at','duration_ms')),
    (SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_schema = '$testDatabase'
        AND constraint_name IN ('chk_interview_round','chk_interview_time','chk_interview_score',
                                'chk_salary_negotiation_positive'))
);
"@
    if ($stage67Result.Trim() -ne '6|1|4|4') {
        throw "Unexpected Stage 6/7 verification result: $stage67Result (expected 6|1|4|4)"
    }

    [pscustomobject]@{
        TemporaryDatabase = $testDatabase
        Stage4Tables = 6
        BackfilledStandardSeats = 2
        BackfilledSeatEvents = 2
        UniqueActiveDispatchGuard = $true
        OfferTermsImmutable = $true
        SeatEventsAppendOnly = $true
        DuplicateActiveDispatchRejected = $true
        DuplicateSeatHolderRejected = $true
        Stage5Tables = 9
        EmployeeIdempotencyGuards = 2
        LifecycleEventsAppendOnly = $true
        AiAndInterviewTables = 6
        StructuredCriteriaColumn = $true
        AiSeparatedOutputColumns = 4
        InterviewDatabaseChecks = 4
        MigrationValid = $true
    }
} finally {
    if ($testDatabase -match '^hrm_ai_offer_verify_[0-9]{14}$') {
        & $mysqlExecutable -h $dbHost -P $dbPort -u $username -e "DROP DATABASE IF EXISTS ``$testDatabase``;" | Out-Null
    }
    if ($null -eq $previousMysqlPassword) {
        Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
    } else {
        $env:MYSQL_PWD = $previousMysqlPassword
    }
}
