# URJI-FIT Database Setup Script
# This script guides you through setting up your Supabase database

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "   URJI-FIT Database Setup" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Load environment
$SUPABASE_URL = "https://updmcynrapoaedcenlzk.supabase.co"
$projectRef = "updmcynrapoaedcenlzk"

Write-Host "Database URL: $SUPABASE_URL" -ForegroundColor Green
Write-Host ""

Write-Host "================================================" -ForegroundColor Yellow
Write-Host "   STEP 1: Run schema.sql" -ForegroundColor Yellow
Write-Host "================================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Opening Supabase SQL Editor..." -ForegroundColor White
Write-Host "2. Copy the contents of: .\supabase\schema.sql" -ForegroundColor Cyan
Write-Host "3. Paste into SQL Editor and click RUN" -ForegroundColor White
Write-Host ""

Start-Sleep -Seconds 2
Start-Process "https://supabase.com/dashboard/project/$projectRef/sql/new"

Write-Host ""
Write-Host "Press Enter after you've run schema.sql..." -ForegroundColor Yellow
Read-Host

Write-Host ""
Write-Host "================================================" -ForegroundColor Yellow
Write-Host "   STEP 2: Run seed.sql" -ForegroundColor Yellow
Write-Host "================================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Opening another SQL Editor tab..." -ForegroundColor White
Write-Host "2. Copy the contents of: .\supabase\seed.sql" -ForegroundColor Cyan
Write-Host "3. Paste into SQL Editor and click RUN" -ForegroundColor White
Write-Host ""

Start-Sleep -Seconds 2
Start-Process "https://supabase.com/dashboard/project/$projectRef/sql/new"

Write-Host ""
Write-Host "Press Enter after you've run seed.sql..." -ForegroundColor Yellow
Read-Host

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "   Setup Complete!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Your database is now ready!" -ForegroundColor White
Write-Host ""
Write-Host "Demo Accounts (Phone + OTP):" -ForegroundColor Yellow
Write-Host ""
Write-Host "Platform Admin:  +251900000000  OTP: 999999" -ForegroundColor Cyan
Write-Host "Gym Owner 1:     +251911000001  OTP: 666666" -ForegroundColor Cyan
Write-Host "Gym Owner 2:     +251911000002  OTP: 555555" -ForegroundColor Cyan
Write-Host "Trainer (Coach): +251911000010  OTP: 222222" -ForegroundColor Cyan
Write-Host "Trainer (Mike):  +251911000011  OTP: 333333" -ForegroundColor Cyan
Write-Host "Trainer (Ruth):  +251911000012  OTP: 444444" -ForegroundColor Cyan
Write-Host "Member (Bes):    +251912345678  OTP: 123456" -ForegroundColor Cyan
Write-Host "Member (Demo):   +251912000001  OTP: 111111" -ForegroundColor Cyan
Write-Host ""
Write-Host "Test your application at: http://localhost:3000" -ForegroundColor Green
Write-Host ""
