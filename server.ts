import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { initializeSocketServer } from './src/lib/socket/server';

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

// Initialize Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    const server = createServer(async (req, res) => {
        try {
            const parsedUrl = parse(req.url!, true);
            await handle(req, res, parsedUrl);
        } catch (err) {
            console.error('Error occurred handling', req.url, err);
            res.statusCode = 500;
            res.end('internal server error');
        }
    });

    // Initialize Socket.io
    const io = initializeSocketServer(server);

    // Handle upgrade requests manually if needed, though socket.io usually handles this
    server.on('upgrade', (req, socket, head) => {
        // Socket.io handles this automatically when attached to http server
    });

    server.listen(port, hostname, () => {
        console.log(`> Ready on http://${hostname}:${port}`);
        console.log(`> Socket.io server running`);
    });
});
