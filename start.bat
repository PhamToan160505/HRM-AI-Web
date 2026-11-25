@echo off
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0"
if /i "%~1"=="backend" goto backend
if /i "%~1"=="frontend" goto frontend

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-dev.ps1"
if errorlevel 1 goto failed
pause
exit /b 0

:backend
cd /d "%~dp0Backend"
title HRM Backend
if exist "apache-maven-3.9.9\bin\mvn.cmd" (
    call "apache-maven-3.9.9\bin\mvn.cmd" spring-boot:run
    goto backend_done
)
where mvn.cmd >nul 2>&1
if not errorlevel 1 (
    call mvn.cmd spring-boot:run
    goto backend_done
)
call mvnw.cmd spring-boot:run
:backend_done
if errorlevel 1 echo [LOI] Backend dung do loi. Xem log phia tren.
exit /b

:frontend
cd /d "%~dp0Frontend"
title HRM Frontend
if not exist "node_modules\.bin\vite.cmd" (
    echo Dang cai thu vien frontend cho lan chay dau tien...
    call npm.cmd install
    if errorlevel 1 (
        echo [LOI] Cai thu vien that bai. Kiem tra ket noi mang va phien ban Node.js.
        exit /b 1
    )
)
call npm.cmd run dev -- --port 5173 --strictPort
if errorlevel 1 echo [LOI] Frontend dung do loi. Xem log phia tren.
exit /b

:failed
pause
exit /b 1
