# Base image
FROM node:20-slim

# Install necessary packages and create a non-root user
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    bash \
    git \
    coreutils \
    curl \
    ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN npm install -g pnpm

# Create a non-root user with UID/GID 1000
RUN groupadd --gid 1000 appuser && \
    useradd --uid 1000 --gid appuser --shell /bin/bash --create-home appuser

# Set up proper permissions for the non-root user
# Ensure /work directory exists and is owned by appuser
WORKDIR /work
RUN chown appuser:appuser /work

# Switch to the non-root user
USER appuser

# Configure the container to start in idle mode (sleep/long-running)
CMD ["sleep", "infinity"]