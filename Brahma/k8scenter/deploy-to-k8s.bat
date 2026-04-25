@echo off
setlocal enabledelayedexpansion

echo.
echo ===================================================
echo   KubeVision / k8scenter - Deploy to Kubernetes
echo ===================================================
echo.

cd /d "%~dp0"

REM ── 1. Check kubectl ─────────────────────────────────────────────────────────
echo [1/6] Checking Kubernetes cluster...
kubectl cluster-info >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Cannot reach Kubernetes cluster.
    echo   Open Docker Desktop ^> Settings ^> Kubernetes ^> Enable Kubernetes ^> Apply ^& Restart
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('kubectl config current-context') do set CONTEXT=%%i
echo  OK - Context: %CONTEXT%
echo.

REM ── 2. Build backend image ────────────────────────────────────────────────────
echo [2/6] Building backend image...
docker build -t kubevision-backend:latest ./backend
if %errorlevel% neq 0 (
    echo ERROR: Backend build failed.
    pause
    exit /b 1
)
echo  OK - Backend image built
echo.

REM ── 3. Build frontend image ───────────────────────────────────────────────────
echo [3/6] Building frontend image...
docker build -t kubevision-frontend:latest ./frontend
if %errorlevel% neq 0 (
    echo ERROR: Frontend build failed.
    pause
    exit /b 1
)
echo  OK - Frontend image built
echo.

REM ── 4. Load images into Kubernetes nodes ─────────────────────────────────────
echo [4/6] Loading images into Kubernetes nodes (this may take a minute)...

REM Detect which kind nodes are running
set NODES_FOUND=0
for /f "tokens=*" %%n in ('docker ps --filter "ancestor=kindest/node:v1.34.3" --format "{{.Names}}" 2^>nul') do (
    set NODES_FOUND=1
    echo  Loading kubevision-backend into %%n...
    docker save kubevision-backend:latest | docker exec -i %%n ctr -n k8s.io images import -
    if !errorlevel! neq 0 (
        echo  WARNING: Could not load backend image into %%n - trying alternate tag...
        docker save kubevision-backend:latest | docker exec -i %%n ctr -n k8s.io images import - 2>nul
    )
    echo  Loading kubevision-frontend into %%n...
    docker save kubevision-frontend:latest | docker exec -i %%n ctr -n k8s.io images import -
    if !errorlevel! neq 0 (
        echo  WARNING: Could not load frontend image into %%n
    )
)

REM Also try common node names explicitly in case ancestor filter missed them
docker ps --format "{{.Names}}" | findstr /i "control-plane worker" >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%n in ('docker ps --format "{{.Names}}" 2^>nul ^| findstr /i "control-plane worker"') do (
        set NODES_FOUND=1
        echo  Loading images into %%n...
        docker save kubevision-backend:latest  | docker exec -i %%n ctr -n k8s.io images import - >nul 2>&1
        docker save kubevision-frontend:latest | docker exec -i %%n ctr -n k8s.io images import - >nul 2>&1
    )
)

if %NODES_FOUND% equ 0 (
    echo  WARNING: No kind nodes detected. Trying default node names...
    docker save kubevision-backend:latest  | docker exec -i desktop-control-plane ctr -n k8s.io images import - >nul 2>&1
    docker save kubevision-backend:latest  | docker exec -i desktop-worker          ctr -n k8s.io images import - >nul 2>&1
    docker save kubevision-frontend:latest | docker exec -i desktop-control-plane ctr -n k8s.io images import - >nul 2>&1
    docker save kubevision-frontend:latest | docker exec -i desktop-worker          ctr -n k8s.io images import - >nul 2>&1
)

echo  OK - Images loaded into cluster nodes
echo.

REM ── 5. Deploy to Kubernetes ───────────────────────────────────────────────────
echo [5/6] Deploying to Kubernetes...

REM Clean up any previous broken deployment
kubectl delete namespace k8scenter --ignore-not-found=true --timeout=60s >nul 2>&1
echo  Waiting for namespace cleanup...
kubectl wait --for=delete namespace/k8scenter --timeout=60s >nul 2>&1

kubectl apply -f k8s-manifests/full-deploy.yaml
if %errorlevel% neq 0 (
    echo ERROR: kubectl apply failed.
    pause
    exit /b 1
)
echo  OK - Manifests applied
echo.

REM ── Wait for rollout ─────────────────────────────────────────────────────────
echo  Waiting for pods to be ready (up to 3 minutes)...
kubectl rollout status deployment/k8scenter-backend  -n k8scenter --timeout=180s
kubectl rollout status deployment/k8scenter-frontend -n k8scenter --timeout=180s
echo  OK - All pods ready
echo.

REM ── 6. Get login token ────────────────────────────────────────────────────────
echo [6/6] Generating login token...
kubectl create token k8scenter-backend -n k8scenter --duration=24h > "%TEMP%\k8scenter-token.txt" 2>nul
if %errorlevel% neq 0 (
    kubectl create token default -n default --duration=24h > "%TEMP%\k8scenter-token.txt" 2>nul
)

set /p TOKEN=<"%TEMP%\k8scenter-token.txt"

for /f "tokens=*" %%i in ('kubectl config view --minify -o jsonpath^="{.clusters[0].cluster.server}"') do set API_SERVER=%%i

echo.
echo ===================================================
echo   k8scenter is LIVE!
echo ===================================================
echo.
echo   Open browser:  http://localhost:30080
echo.
echo   Login - Auth Type  : Bearer Token
echo   Login - Server URL : %API_SERVER%
echo.
echo   Token (copy everything between the lines):
echo   -----------------------------------------------
type "%TEMP%\k8scenter-token.txt"
echo.
echo   -----------------------------------------------
echo.
echo   Pod status:
kubectl get pods -n k8scenter
echo.
pause
