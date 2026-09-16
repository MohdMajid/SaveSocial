@echo off
setlocal
title Video Downloader

if not exist ".venv\Scripts\python.exe" (
    echo Creating Python environment...
    python -m venv .venv
)

call .venv\Scripts\activate

echo Updating downloader dependencies...
python -m pip install --upgrade pip
pip install -U -r requirements.txt

REM yt-dlp now needs a supported JavaScript runtime for full YouTube support.
set "DENO_BIN=%USERPROFILE%\.deno\bin\deno.exe"
if not exist "%DENO_BIN%" (
    echo.
    echo Deno runtime not found. Installing Deno for YouTube support...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "iwr https://deno.land/install.ps1 -useb | iex"
)

if exist "%DENO_BIN%" (
    set "PATH=%USERPROFILE%\.deno\bin;%PATH%"
)

if exist "%~dp0bin" (
    set "PATH=%~dp0bin;%PATH%"
)

echo.
echo Starting server...
echo Local PC: http://127.0.0.1:8000
echo Mobile Phone (SaveSocial App): http://192.168.1.3:8000
python -m uvicorn app:app --host 0.0.0.0 --port 8000 --reload
pause
