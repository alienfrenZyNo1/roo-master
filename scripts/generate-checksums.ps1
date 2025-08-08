# Roo Master Checksum Generation Script for CI
# This script generates checksums for distribution packages

param(
    [Parameter(Mandatory=$true)]
    [string]$FilePath,
    [switch]$Force = $false
)

if (-not (Test-Path $FilePath -PathType Leaf)) {
    Write-Host "Error: File not found: $FilePath" -ForegroundColor Red
    exit 1
}

# Check if running in CI environment
if ($env:CI -eq "true") {
    $Force = $true
}

# Generate SHA256 checksum
try {
    $sha256 = Get-FileHash -Path $FilePath -Algorithm SHA256
    $sha256.Hash + " *" + $FilePath | Out-File "$FilePath.sha256" -Encoding ASCII
    Write-Host "SHA256 checksum created: $FilePath.sha256" -ForegroundColor Green
    
    # Generate MD5 checksum
    $md5 = Get-FileHash -Path $FilePath -Algorithm MD5
    $md5.Hash + " *" + $FilePath | Out-File "$FilePath.md5" -Encoding ASCII
    Write-Host "MD5 checksum created: $FilePath.md5" -ForegroundColor Green
    
    Write-Host "Checksum generation completed successfully!" -ForegroundColor Green
}
catch {
    Write-Host "Error generating checksums: $_" -ForegroundColor Red
    exit 1
}