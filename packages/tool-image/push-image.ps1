# Script to push the Docker image to a container registry
# Usage: .\push-image.ps1 [-RegistryUrl <registry-url>]

param(
    [string]$RegistryUrl = "docker.io/roo-master"
)

$ErrorActionPreference = "Stop"

$ImageName = "tool-image"
$Version = "1.0.0"

# Tag the image for the registry
Write-Host "Tagging image for registry: $RegistryUrl"
docker tag "roo-master/$ImageName`:$Version" "$RegistryUrl/$ImageName`:$Version"

# Also tag as latest
docker tag "roo-master/$ImageName`:$Version" "$RegistryUrl/$ImageName`:latest"

# Push the versioned image
Write-Host "Pushing image $RegistryUrl/$ImageName`:$Version"
docker push "$RegistryUrl/$ImageName`:$Version"

# Push the latest image
Write-Host "Pushing image $RegistryUrl/$ImageName`:latest"
docker push "$RegistryUrl/$ImageName`:latest"

Write-Host "Image pushed successfully to $RegistryUrl/$ImageName`:$Version and $RegistryUrl/$ImageName`:latest"