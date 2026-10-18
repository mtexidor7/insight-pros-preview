@echo off
rem Double-click to preview the Insight Pros site at http://localhost:5173
cd /d "%~dp0"
start "" http://localhost:5173
npx -y http-server@14.1.1 . -a 127.0.0.1 -p 5173 -c-1
