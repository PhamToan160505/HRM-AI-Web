@echo off
echo =========================================
echo HRM AI - KHOI DONG DEV MODE (LOCAL)
echo =========================================

echo 1. Dang khoi dong Database va Redis...
docker-compose up -d mysql redis adminer

echo 2. Dang khoi dong Backend (Spring Boot)...
start "HRM Backend" cmd /k "cd Backend && mvnw spring-boot:run"

echo 3. Dang khoi dong Frontend (React/Vite)...
start "HRM Frontend" cmd /k "cd Frontend && npm run dev"

echo =========================================
echo Hoan tat! Ung dung dang chay o 2 cua so den (terminal) rieng biet.
echo =========================================
pause
