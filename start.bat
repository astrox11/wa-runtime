@echo off
echo Starting Whatsaly Server...
echo.
echo Make sure you have:
echo - Go installed (go version 1.21+)
echo - Bun installed (bun --version)
echo.
echo Running Go server on port 8000...
go run cmd/server/main.go
pause
