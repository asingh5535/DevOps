@echo off
echo.
echo ===================================================
echo   KubeVision - Starting Port Forwards
echo ===================================================
echo.

REM Kill any existing port-forwards
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8090 " 2^>nul') do taskkill /PID %%p /F >nul 2>&1
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8091 " 2^>nul') do taskkill /PID %%p /F >nul 2>&1

echo  Starting frontend port-forward  (localhost:8090 -> frontend:80)...
start /B kubectl port-forward svc/frontend 8090:80 -n k8scenter

echo  Starting backend port-forward   (localhost:8091 -> backend:8080)...
start /B kubectl port-forward svc/backend  8091:8080 -n k8scenter

timeout /t 3 >nul

echo.
echo  Done!
echo.
echo   Open browser : http://localhost:8090
echo.
echo  (Keep this window open while using KubeVision)
echo.
pause
