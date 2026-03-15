$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host ("=" * 70) -ForegroundColor Cyan
Write-Host "  Weave Public Repo Security Check" -ForegroundColor Cyan
Write-Host ("=" * 70) -ForegroundColor Cyan
Write-Host ""

$errors = 0
$warnings = 0

function Add-Error($message) {
    $script:errors++
    Write-Host "[ERROR] $message" -ForegroundColor Red
}

function Add-Warning($message) {
    $script:warnings++
    Write-Host "[WARN]  $message" -ForegroundColor Yellow
}

function Add-Ok($message) {
    Write-Host "[OK]    $message" -ForegroundColor Green
}

Write-Host "[1/6] Checking private key content..." -ForegroundColor Yellow
$privateKeyHits = git grep -n -i "BEGIN PRIVATE KEY" -- . ":(exclude)scripts/security-check.ps1" 2>$null
if ($privateKeyHits) {
    Add-Error "Found private key content in tracked files."
    $privateKeyHits | ForEach-Object { Write-Host "        $_" -ForegroundColor DarkRed }
} else {
    Add-Ok "No private key content found."
}

Write-Host ""
Write-Host "[2/6] Checking generator scripts..." -ForegroundColor Yellow
$generatorHits = git ls-files | Select-String "generate-activation-codes|generate-keypair"
if ($generatorHits) {
    Add-Error "Found activation-code generator scripts in tracked files."
    $generatorHits | ForEach-Object { Write-Host "        $($_.Line)" -ForegroundColor DarkRed }
} else {
    Add-Ok "No generator scripts found."
}

Write-Host ""
Write-Host "[3/6] Checking sensitive docs..." -ForegroundColor Yellow
$sensitiveDocHits = git ls-files | Select-String "PRIVATE_KEY_SETUP|OPEN_SOURCE_CHECKLIST|ACTIVATION_SYSTEM|GIT_CLEANUP"
if ($sensitiveDocHits) {
    Add-Warning "Found internal or security-process document names."
    $sensitiveDocHits | ForEach-Object { Write-Host "        $($_.Line)" -ForegroundColor DarkYellow }
} else {
    Add-Ok "No internal security docs found."
}

Write-Host ""
Write-Host "[4/6] Checking local hard-coded paths..." -ForegroundColor Yellow
$pathHits = git grep -n -i "C:\\Users\\lihua\|obsidian luman" -- . ":(exclude)scripts/security-check.ps1" 2>$null
if ($pathHits) {
    Add-Warning "Found local machine paths in tracked files."
    $pathHits | ForEach-Object { Write-Host "        $_" -ForegroundColor DarkYellow }
} else {
    Add-Ok "No local machine paths found."
}

Write-Host ""
Write-Host "[5/6] Checking missing-doc references..." -ForegroundColor Yellow
$missingDocRefs = git grep -n "INSTALLATION.md\|DEVELOPMENT.md\|OPEN_SOURCE_CHECKLIST.md\|PRIVATE_KEY_SETUP.md" -- . ":(exclude)scripts/security-check.ps1" 2>$null
if ($missingDocRefs) {
    Add-Warning "Found references to files that may not exist in the public repo."
    $missingDocRefs | ForEach-Object { Write-Host "        $_" -ForegroundColor DarkYellow }
} else {
    Add-Ok "No stale internal doc references found."
}

Write-Host ""
Write-Host "[6/6] Checking git history for private keys..." -ForegroundColor Yellow
$historyHits = git log --all --full-history -S "BEGIN PRIVATE KEY" --oneline 2>$null
if ($historyHits) {
    Add-Warning "Git history still contains commits related to private key content."
    $historyHits | ForEach-Object { Write-Host "        $_" -ForegroundColor DarkYellow }
} else {
    Add-Ok "No private-key history hits found."
}

Write-Host ""
Write-Host ("=" * 70) -ForegroundColor Cyan
Write-Host "  Summary" -ForegroundColor Cyan
Write-Host ("=" * 70) -ForegroundColor Cyan
Write-Host ""
Write-Host "Errors:   $errors" -ForegroundColor $(if ($errors -gt 0) { "Red" } else { "Green" })
Write-Host "Warnings: $warnings" -ForegroundColor $(if ($warnings -gt 0) { "Yellow" } else { "Green" })
Write-Host ""

if ($errors -gt 0) {
    Write-Host "Public repo is not clean enough yet." -ForegroundColor Red
    exit 1
}

if ($warnings -gt 0) {
    Write-Host "Public repo is usable, but there are still cleanup items worth reviewing." -ForegroundColor Yellow
    exit 0
}

Write-Host "Public repo checks passed." -ForegroundColor Green
exit 0
