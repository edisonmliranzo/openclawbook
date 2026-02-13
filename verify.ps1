#!/usr/bin/env powershell

# OpenClaw Deployment - Verification Checklist (Windows)
# Run this script to verify all components are properly set up

Write-Host ""
Write-Host "  OpenClaw Deployment Verification" -ForegroundColor Cyan
Write-Host ""

$errors = 0
$warnings = 0
$success = 0

# Function to check file exists
function Test-File {
  param(
    [string]$Name,
    [string]$Path
  )
  
  if (Test-Path $Path -PathType Leaf) {
    Write-Host "✓ $Name" -ForegroundColor Green
    $script:success++
  } else {
    Write-Host "✗ $Name (missing: $Path)" -ForegroundColor Red
    $script:errors++
  }
}

# Function to check directory exists
function Test-Directory {
  param(
    [string]$Name,
    [string]$Path
  )
  
  if (Test-Path $Path -PathType Container) {
    Write-Host "✓ $Name" -ForegroundColor Green
    $script:success++
  } else {
    Write-Host "✗ $Name (missing: $Path)" -ForegroundColor Red
    $script:errors++
  }
}

# Function to check file content
function Test-FileContent {
  param(
    [string]$Name,
    [string]$Path,
    [string]$Pattern
  )
  
  if ((Test-Path $Path -PathType Leaf) -and (Select-String -Path $Path -Pattern $Pattern -Quiet)) {
    Write-Host "✓ $Name" -ForegroundColor Green
    $script:success++
  } else {
    Write-Host "✗ $Name" -ForegroundColor Red
    $script:errors++
  }
}

Write-Host "Checking directories..." -ForegroundColor Yellow
Test-Directory "src/" "src"
Test-Directory "server/" "server"
Test-Directory "examples/" "examples"
Write-Host ""

Write-Host "Checking core files..." -ForegroundColor Yellow
Test-File "server/index.js" "server/index.js"
Test-File "server/package.json" "server/package.json"
Test-File "package.json" "package.json"
Write-Host ""

Write-Host "Checking setup scripts..." -ForegroundColor Yellow
Test-File "setup_human.js" "examples/setup_human.js"
Test-File "agent_runner.cjs" "examples/agent_runner.cjs"
Test-File "agent_client_cli.js" "examples/agent_client_cli.js"
Test-File "quickstart.js" "examples/quickstart.js"
Write-Host ""

Write-Host "Checking documentation..." -ForegroundColor Yellow
Test-File "QUICKSTART.md" "QUICKSTART.md"
Test-File "DEPLOYMENT_GUIDE.md" "DEPLOYMENT_GUIDE.md"
Test-File "DEPLOYMENT_SUMMARY.md" "DEPLOYMENT_SUMMARY.md"
Test-File "examples/README.md" "examples/README.md"
Write-Host ""

Write-Host "Checking npm scripts..." -ForegroundColor Yellow
Test-FileContent "npm dev:server" "package.json" '"dev:server"'
Test-FileContent "npm setup-human" "package.json" '"setup-human"'
Test-FileContent "npm setup-agent" "package.json" '"setup-agent"'
Test-FileContent "npm agent-cli" "package.json" '"agent-cli"'
Test-FileContent "npm quickstart" "package.json" '"quickstart"'
Write-Host ""

Write-Host "Checking npm dependencies..." -ForegroundColor Yellow
if (Select-String -Path "server/package.json" -Pattern "nodemailer" -Quiet) {
  Write-Host "✓ nodemailer in server/package.json" -ForegroundColor Green
  $success++
}

Write-Host ""
Write-Host "Checking API endpoints..." -ForegroundColor Yellow
Test-FileContent "POST agents claim-invite" "server/index.js" "/api/agents/claim-invite"
Test-FileContent "GET agents me" "server/index.js" "/api/agents/me"
Test-FileContent "POST posts" "server/index.js" "'/api/posts'"
Test-FileContent "GET users" "server/index.js" "'/api/users"
Test-FileContent "Email sending" "server/index.js" "sendTokenEmail"
Write-Host ""

Write-Host "  Verification Summary" -ForegroundColor Cyan
Write-Host ""
Write-Host "✓ Success:   $success" -ForegroundColor Green
Write-Host "! Warnings: $warnings" -ForegroundColor Yellow
Write-Host "✗ Errors:    $errors" -ForegroundColor Red
Write-Host ""

if ($errors -eq 0) {
  Write-Host "SUCCESS! Ready to deploy." -ForegroundColor Green
  Write-Host ""
  Write-Host "Next steps:" -ForegroundColor Cyan
  Write-Host "  npm run dev:server    # Terminal 1" -ForegroundColor White
  Write-Host "  npm run dev           # Terminal 2" -ForegroundColor White
  Write-Host "  npm run quickstart    # Terminal 3" -ForegroundColor White
  exit 0
} else {
  Write-Host "ERROR! Please fix issues above." -ForegroundColor Red
  exit 1
}
