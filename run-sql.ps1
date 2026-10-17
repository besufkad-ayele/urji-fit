# PowerShell script to run SQL files against Supabase
# Usage: .\run-sql.ps1

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "   URJI-FIT Database Setup Script" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Load environment variables
$envFile = ".\.env.local"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match "^\s*([^#][^=]+)=(.+)$") {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
    Write-Host "✓ Environment variables loaded" -ForegroundColor Green
} else {
    Write-Host "✗ .env.local file not found!" -ForegroundColor Red
    exit 1
}

$SUPABASE_URL = $env:NEXT_PUBLIC_SUPABASE_URL
$SERVICE_KEY = $env:SUPABASE_SERVICE_ROLE_KEY

if (-not $SUPABASE_URL -or -not $SERVICE_KEY) {
    Write-Host "✗ Missing Supabase credentials in .env.local" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Supabase URL: $SUPABASE_URL" -ForegroundColor Green
Write-Host ""

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "   Method 1: Using Supabase Dashboard (Recommended)" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Open your Supabase Dashboard:" -ForegroundColor White
Write-Host "   https://supabase.com/dashboard/project/updmcynrapoaedcenlzk" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. Go to: SQL Editor (left sidebar)" -ForegroundColor White
Write-Host ""
Write-Host "3. Click 'New Query'" -ForegroundColor White
Write-Host ""
Write-Host "4. Copy and paste the contents of:" -ForegroundColor White
Write-Host "   .\supabase\schema.sql" -ForegroundColor Yellow
Write-Host "   Then click 'Run'" -ForegroundColor White
Write-Host ""
Write-Host "5. After schema.sql succeeds, create another 'New Query'" -ForegroundColor White
Write-Host ""
Write-Host "6. Copy and paste the contents of:" -ForegroundColor White
Write-Host "   .\supabase\seed.sql" -ForegroundColor Yellow
Write-Host "   Then click 'Run'" -ForegroundColor White
Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "   Method 2: Using psql Command Line" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "If you have PostgreSQL client (psql) installed:" -ForegroundColor White
Write-Host ""

# Extract project ref from URL
$projectRef = ($SUPABASE_URL -replace "https://", "" -replace ".supabase.co", "")
$dbHost = "db.$projectRef.supabase.co"

Write-Host "Run these commands:" -ForegroundColor Yellow
Write-Host ""
$schemaCmd = "psql ""postgresql://postgres.[password]@$dbHost:5432/postgres"" -f .\supabase\schema.sql"
$seedCmd = "psql ""postgresql://postgres.[password]@$dbHost:5432/postgres"" -f .\supabase\seed.sql"
Write-Host $schemaCmd -ForegroundColor Cyan
Write-Host $seedCmd -ForegroundColor Cyan
Write-Host ""
Write-Host "Replace [password] with your database password from Supabase Dashboard" -ForegroundColor Gray
Write-Host "Go to: Settings > Database to find your password" -ForegroundColor Gray
Write-Host ""

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "   Method 3: Using Supabase CLI" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "If you have Supabase CLI installed:" -ForegroundColor White
Write-Host ""
Write-Host "supabase db push" -ForegroundColor Cyan
Write-Host ""

Write-Host "================================================" -ForegroundColor Green
Write-Host "   Demo Accounts" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "After running the SQL files, you can login with:" -ForegroundColor White
Write-Host ""
Write-Host "Platform Admin:" -ForegroundColor Yellow
Write-Host "  Phone: +251900000000" -ForegroundColor White
Write-Host "  OTP:   999999" -ForegroundColor Cyan
Write-Host ""
Write-Host "Gym Owner 1:" -ForegroundColor Yellow
Write-Host "  Phone: +251911000001" -ForegroundColor White
Write-Host "  OTP:   666666" -ForegroundColor Cyan
Write-Host ""
Write-Host "Gym Owner 2:" -ForegroundColor Yellow
Write-Host "  Phone: +251911000002" -ForegroundColor White
Write-Host "  OTP:   555555" -ForegroundColor Cyan
Write-Host ""
Write-Host "Trainer (Demo Coach):" -ForegroundColor Yellow
Write-Host "  Phone: +251911000010" -ForegroundColor White
Write-Host "  OTP:   222222" -ForegroundColor Cyan
Write-Host ""
Write-Host "Trainer (Mike):" -ForegroundColor Yellow
Write-Host "  Phone: +251911000011" -ForegroundColor White
Write-Host "  OTP:   333333" -ForegroundColor Cyan
Write-Host ""
Write-Host "Trainer (Ruth):" -ForegroundColor Yellow
Write-Host "  Phone: +251911000012" -ForegroundColor White
Write-Host "  OTP:   444444" -ForegroundColor Cyan
Write-Host ""
Write-Host "Member (Bes):" -ForegroundColor Yellow
Write-Host "  Phone: +251912345678" -ForegroundColor White
Write-Host "  OTP:   123456" -ForegroundColor Cyan
Write-Host ""
Write-Host "Member (Demo):" -ForegroundColor Yellow
Write-Host "  Phone: +251912000001" -ForegroundColor White
Write-Host "  OTP:   111111" -ForegroundColor Cyan
Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host ""

# Open Supabase Dashboard
$confirm = Read-Host "Would you like to open Supabase Dashboard now? (Y/n)"
if ($confirm -ne "n" -and $confirm -ne "N") {
    Start-Process "https://supabase.com/dashboard/project/$projectRef/editor"
    Write-Host "✓ Opening Supabase Dashboard in browser..." -ForegroundColor Green
}

Write-Host ""
Write-Host "Script completed!" -ForegroundColor Green
Write-Host ""
