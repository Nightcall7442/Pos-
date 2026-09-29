@echo off
setlocal EnableDelayedExpansion
title Wespro
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js not found. Install it from https://nodejs.org and run this file again.
    pause
    exit /b 1
)

if not exist "backend\.env" (
    echo Creating backend\.env with default dev settings...
    (
        echo PORT=3000
        echo NODE_ENV=development
        echo DATABASE_URL="file:./dev.db"
        echo REDIS_URL="redis://localhost:6379"
        echo JWT_SECRET="dev-local-jwt-secret-change-me-please"
        echo JWT_EXPIRES_IN="15m"
        echo JWT_REFRESH_SECRET="dev-local-refresh-secret-change-me-please"
        echo JWT_REFRESH_EXPIRES_IN="7d"
        echo UPLOAD_DIR="./uploads"
        echo MAX_FILE_SIZE=5242880
        echo CORS_ORIGIN="http://localhost:5173"
        echo LOG_LEVEL="info"
    ) > "backend\.env"
)

if not exist "backend\node_modules" (
    echo [1/1] First run detected - installing dependencies, this can take a few minutes...
    call npm run setup
    if errorlevel 1 (
        echo [ERROR] npm run setup failed, see the errors above.
        pause
        exit /b 1
    )
) else (
    if not exist "frontend-admin\node_modules" (
        echo Installing frontend-admin dependencies...
        call npm install --prefix frontend-admin
    )
    if not exist "pos-terminal\node_modules" (
        echo Installing pos-terminal dependencies...
        call npm install --prefix pos-terminal
    )
    if not exist "backend\prisma\dev.db" (
        echo Database not found - creating and seeding...
        call npm run db:generate --prefix backend
        call npm run db:push --prefix backend
        call npm run db:seed --prefix backend
    )
)

echo.
echo ============================================================
echo   Wespro is starting...
echo   Admin panel:   http://localhost:5173   admin@wespro.com / admin123
echo   POS terminal:  http://localhost:5174   cashier@wespro.com / cashier123
echo ============================================================
echo.
echo Press Ctrl+C to stop all services.
echo.

start "" cmd /c "timeout /t 8 >nul && start http://localhost:5173 && start http://localhost:5174"

call npm run dev

pause
