import { createServer } from 'http';
import { initializeSocketServer } from './src/lib/socket/server';

const port = parseInt(process.env.PORT || '3000', 10);
const hostname = '0.0.0.0';

const server = createServer((req, res) => {
    // Health check endpoint
    if (req.url === '/health') {
        res.statusCode = 200;
        res.end('OK');
        return;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Neon Tank Duel Socket Server Running');
});

// Initialize Socket.io
initializeSocketServer(server);

server.listen(port, hostname, () => {
    console.log(`> Socket Server ready on http://${hostname}:${port}`);
});
