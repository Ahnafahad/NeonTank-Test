import { NextRequest, NextResponse } from 'next/server';

// Matchmaking queue (in-memory for demo, use Redis in production)
interface QueueEntry {
    playerId: string;
    playerName: string;
    timestamp: number;
}

// Global queue storage (in production, use Redis or database)
const matchmakingQueue: Map<string, QueueEntry> = new Map();

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { playerId, playerName } = body;

        if (!playerId) {
            return NextResponse.json(
                { error: 'Player ID is required' },
                { status: 400 }
            );
        }

        // Check if player is already in queue
        if (matchmakingQueue.has(playerId)) {
            return NextResponse.json(
                { error: 'Player already in queue' },
                { status: 409 }
            );
        }

        // Add to queue
        const entry: QueueEntry = {
            playerId,
            playerName: playerName || `Player_${playerId.substring(0, 6)}`,
            timestamp: Date.now(),
        };
        matchmakingQueue.set(playerId, entry);

        // Try to find a match
        const queueEntries = Array.from(matchmakingQueue.values())
            .filter((e) => e.playerId !== playerId)
            .sort((a, b) => a.timestamp - b.timestamp);

        if (queueEntries.length > 0) {
            // Match found! Remove both players from queue
            const opponent = queueEntries[0];
            matchmakingQueue.delete(playerId);
            matchmakingQueue.delete(opponent.playerId);

            // Generate session ID
            const sessionId = 'session_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);

            return NextResponse.json({
                status: 'matched',
                sessionId,
                opponent: {
                    playerId: opponent.playerId,
                    playerName: opponent.playerName,
                },
                message: 'Match found!',
            });
        }

        // No match yet, return queue position
        const queuePosition = Array.from(matchmakingQueue.values())
            .filter((e) => e.timestamp <= entry.timestamp)
            .length;

        return NextResponse.json({
            status: 'queued',
            queuePosition,
            message: 'Waiting for opponent...',
        });
    } catch (error) {
        console.error('[Matchmaking] Join error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const playerId = searchParams.get('playerId');

        if (!playerId) {
            return NextResponse.json(
                { error: 'Player ID is required' },
                { status: 400 }
            );
        }

        matchmakingQueue.delete(playerId);

        return NextResponse.json({
            status: 'removed',
            message: 'Left matchmaking queue',
        });
    } catch (error) {
        console.error('[Matchmaking] Leave error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
