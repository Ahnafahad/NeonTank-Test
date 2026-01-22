import { NextResponse } from 'next/server';

// Socket.io initialization endpoint
// Note: In Next.js App Router, Socket.io requires a custom server setup
// This route provides information about the socket connection

export async function GET() {
    // Return socket server configuration
    return NextResponse.json({
        message: 'Socket.io server info',
        status: 'available',
        transports: ['websocket', 'polling'],
        path: '/socket.io',
        note: 'Connect to the root URL with socket.io-client',
    });
}

export async function POST() {
    return NextResponse.json({
        error: 'Socket connections should be made via socket.io-client, not REST API',
        usage: "import { io } from 'socket.io-client'; const socket = io('http://localhost:3000');",
    }, { status: 400 });
}
