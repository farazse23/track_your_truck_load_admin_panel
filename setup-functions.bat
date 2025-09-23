@echo off
echo 🚀 Track Your Truck Load - Cloud Functions Setup
echo =====================================
echo.

echo 📋 This script will set up Firebase Cloud Functions for real-time status updates
echo.

REM Check prerequisites
echo ✅ Checking prerequisites...
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is not installed. Please install Node.js first.
    pause
    exit /b 1
)

firebase --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Firebase CLI not found. Installing...
    npm install -g firebase-tools
)

echo.
echo 🔧 Setting up Cloud Functions...
echo.

REM Initialize Firebase project (if not already done)
if not exist firebase.json (
    echo 📝 Initializing Firebase project...
    firebase init functions
) else (
    echo ✅ Firebase project already initialized
)

REM Install function dependencies
echo 📦 Installing dependencies...
cd functions
npm install
cd ..

echo.
echo ✅ Setup completed!
echo.
echo 🚀 Next steps:
echo    1. Run: deploy-functions.bat
echo    2. Check Firebase Console for deployed functions
echo    3. Test with mobile app status updates
echo.
echo 📖 Read CLOUD_FUNCTIONS_README.md for detailed integration guide
echo.

pause
