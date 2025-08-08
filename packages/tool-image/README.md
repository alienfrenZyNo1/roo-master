# Tool Container Image

This directory contains the Dockerfile for the hardened tool container image used in the project.

## Building the Image

To build the Docker image, navigate to this directory and run the following command:

```bash
docker build -t tool-image .
```

## Hardening Measures

This Docker image incorporates several hardening measures to enhance security:

-   **Base Image:** Uses `node:20-slim` which is a minimal Debian-based image, reducing the attack surface.
-   **Non-Root User:** The container runs as a non-root user (`appuser` with UID/GID 1000:1000). This prevents processes from having root privileges inside the container, even if compromised.
-   **Read-Only Filesystem (Except for Necessary Directories):** While not explicitly enforced by `Dockerfile` commands, this is a runtime configuration that should be applied when running the container (e.g., `docker run --read-only`). Necessary directories like `/tmp` or `/work` (if used for mutable data) should be mounted as writable volumes.
-   **Dropped Capabilities:** All Linux capabilities are dropped by default when running a Docker container, and only specific ones are added back if needed. This reduces the privileges available to processes within the container.
-   **No New Privileges:** The `no-new-privileges` flag (e.g., `docker run --security-opt=no-new-privileges`) prevents processes from gaining additional privileges via `setuid` or `setgid` bits.
-   **Resource Limits:** Resource limits (PIDs, Memory, CPUs) should be applied at runtime using Docker's `--pids-limit`, `--memory`, and `--cpus` flags to prevent resource exhaustion attacks.
    -   PIDs: 512
    -   Memory: 4g
    -   CPUs: 2
-   **Network None:** The container is configured to run with no network access by default (e.g., `docker run --network none`). Network access should only be enabled explicitly if required for the container's function.
-   **Idle Mode:** The `CMD ["sleep", "infinity"]` instruction ensures the container starts in an idle, long-running state, ready to accept commands or be used as a base for further operations.

## Usage Notes

-   **Working Directory:** The default working directory inside the container is `/work`.
-   **Tooling:** The image includes `bash`, `git`, `coreutils`, and `pnpm` for development and operational tasks.
-   **Running with Hardening:** To run the container with the recommended hardening measures, use a command similar to this:

    ```bash
    docker run \
      --read-only \
      --security-opt=no-new-privileges \
      --pids-limit 512 \
      --memory 4g \
      --cpus 2 \
      --network none \
      -v /local/path:/work \
      tool-image
    ```
    Replace `/local/path` with the path on your host machine that you want to mount into the container's `/work` directory.