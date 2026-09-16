@echo off
echo =========================================
echo HRM AI - KHOI DONG HE THONG BANG DOCKER
echo (Dung de chay tren may tinh khac)
echo =========================================

echo Dang build va khoi dong toan bo he thong...
echo (Qua trinh nay co the mat vai phut o lan chay dau tien)

docker-compose -f docker-compose.prod.yml up --build -d

echo =========================================
echo HOAN TAT! He thong dang chay ngam (background).
echo.
echo Vui long truy cap cac duong link sau:
echo - Trang web (Frontend): http://localhost
echo - API Backend: http://localhost:8080
echo - Quan ly Database: http://localhost:8081
echo =========================================
pause
