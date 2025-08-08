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
-   **Read-Only Filesystem:** The container's filesystem is made read-only using the `--read-only` flag. This prevents unauthorized modifications to the container's filesystem.
-   **Dropped Capabilities:** All Linux capabilities are dropped using the `--cap-drop=ALL` flag. This significantly reduces the privileges available to processes within the container.
-   **No New Privileges:** The `--security-opt=no-new-privileges` flag prevents processes from gaining additional privileges via `setuid` or `setgid` bits.
-   **Resource Limits:** Resource limits are applied at runtime using Docker's flags to prevent resource exhaustion attacks:
    -   PIDs: 512 (`--pids-limit=512`)
    -   Memory: 4g (`--memory=4g`)
    -   CPUs: 2 (`--cpus=2`)
-   **Network Isolation:** The container runs with no network access by default using `--network none`. This isolates the container from external network access, reducing the attack surface.
-   **No Port Exposures:** No ports are exposed by default. The container is designed to run in complete isolation without any network services accessible from outside.
-   **Health Monitoring:** A `HEALTHCHECK` instruction is included to monitor the container's status and ensure it is running properly.
-   **Idle Mode:** The `CMD ["sleep", "infinity"]` instruction ensures the container starts in an idle, long-running state, ready to accept commands or be used as a base for further operations.

## Usage Notes

-   **Working Directory:** The default working directory inside the container is `/work`.
-   **Tooling:** The image includes `bash`, `git`, `coreutils`, and `pnpm` for development and operational tasks.
-   **Running with Hardening:** To run the container with all the recommended hardening measures, use a command similar to this:

    ```bash
    docker run -d \
      --name tool-container \
      --read-only \
      --cap-drop=ALL \
      --security-opt=no-new-privileges \
      --pids-limit=512 \
      --memory=4g \
      --cpus=2 \
      --user 1000:1000 \
      --network none \
      -v /local/path:/work \
      tool-image
    ```
    
    Replace `/local/path` with the path on your host machine that you want to mount into the container's `/work` directory. The container will run with:
    
    - A read-only filesystem (except for mounted volumes)
    - All Linux capabilities dropped
    - No new privileges allowed
    - Limited to 512 processes, 4GB memory, and 2 CPU cores
    - Running as non-root user (UID/GID 1000:1000)
    - No network access (completely isolated)
    - No ports exposed to the host