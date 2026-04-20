# This script creates a clean ZIP file of the project to share with friends.
# It automatically excludes heavy folders like node_modules and .next.

$sourcePath = ".\"
$zipFileName = "ADLS-Explorer-Shareable.zip"
$destinationPath = ".\$zipFileName"

# Remove existing zip if it exists
if (Test-Path $destinationPath) {
    Remove-Item $destinationPath -Force
}

Write-Host "Packaging ADLS Explorer for sharing..." -ForegroundColor Cyan

# Create a temporary folder
$tempFolder = ".\temp_adls_package"
New-Item -ItemType Directory -Path $tempFolder -Force | Out-Null

# Copy items, excluding node_modules, .next, and git
Get-ChildItem -Path $sourcePath -Exclude "node_modules", ".next", ".git", "temp_adls_package", $zipFileName, "dist", ".electron-builder" | 
    Copy-Item -Destination $tempFolder -Recurse -Force

# Zip the temp folder
Write-Host "Compressing files..." -ForegroundColor Yellow
Compress-Archive -Path "$tempFolder\*" -DestinationPath $destinationPath -Force

# Clean up temp folder
Remove-Item -Path $tempFolder -Recurse -Force

Write-Host "Success! You can now send '$zipFileName' to your friends." -ForegroundColor Green
Write-Host "All they need to do is extract the ZIP and double-click 'Start-ADLS-Explorer.bat'." -ForegroundColor Green
Write-Host ""
Write-Host "Press any key to exit..."
$Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") | Out-Null
