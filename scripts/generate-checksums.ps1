# Roo Master Checksum Generation Script
# This script generates checksums for distribution packages

param(
    [Parameter(Mandatory=$true)]
    [string]$FilePath
)

if (-not (Test-Path $FilePath -PathType Leaf)) {
    Write-Host "Error: File not found: $FilePath" -ForegroundColor Red
    exit 1
}

# Generate SHA256 checksum
$sha256 = Get-FileHash -Path $FilePath -Algorithm SHA256
$sha256.Hash | Out-File "$FilePath.sha256"
Write-Host "SHA256 checksum created: $FilePath.sha256" -ForegroundColor Green

# Generate MD5 checksum
$md5 = Get-FileHash -Path $FilePath -Algorithm MD5
$md5.Hash | Out-File "$FilePath.md5"
Write-Host "MD5 checksum created: $FilePath.md5" -ForegroundColor Green

Write-Host "Checksum generation completed successfully!" -ForegroundColor Green