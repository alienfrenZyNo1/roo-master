import * as net from 'net';

export function findOpenPort(startPort: number, endPort: number): Promise<number> {
    return new Promise((resolve, reject) => {
        let port = startPort;

        function tryPort() {
            if (port > endPort) {
                return reject(new Error(`No open ports found between ${startPort} and ${endPort}`));
            }

            const server = net.createServer();
            server.listen(port, () => {
                server.once('close', () => {
                    resolve(port);
                });
                server.close();
            });
            server.on('error', () => {
                port++;
                tryPort();
            });
        }

        tryPort();
    });
}