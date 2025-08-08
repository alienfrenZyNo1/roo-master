#!/bin/bash

# Script to push the Docker image to a container registry
# Usage: ./push-image.sh [registry-url]

set -e

# Default to Docker Hub if no registry is specified
REGISTRY=${1:-docker.io/roo-master}
IMAGE_NAME="tool-image"
VERSION="1.0.0"

# Tag the image for the registry
echo "Tagging image for registry: $REGISTRY"
docker tag "roo-master/$IMAGE_NAME:$VERSION" "$REGISTRY/$IMAGE_NAME:$VERSION"

# Also tag as latest
docker tag "roo-master/$IMAGE_NAME:$VERSION" "$REGISTRY/$IMAGE_NAME:latest"

# Push the versioned image
echo "Pushing image $REGISTRY/$IMAGE_NAME:$VERSION"
docker push "$REGISTRY/$IMAGE_NAME:$VERSION"

# Push the latest image
echo "Pushing image $REGISTRY/$IMAGE_NAME:latest"
docker push "$REGISTRY/$IMAGE_NAME:latest"

echo "Image pushed successfully to $REGISTRY/$IMAGE_NAME:$VERSION and $REGISTRY/$IMAGE_NAME:latest"