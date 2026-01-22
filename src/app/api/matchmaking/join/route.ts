import { NextRequest, NextResponse } from 'next/server';

// Matchmaking queue (in-memory for demo, use Redis in production)
interface QueueEntry {
    playerId: string;
    playerName: string;
    timestamp: number;
    sessionId: string; // Each waiting player gets their own session for invite links
}

// Global queue storage (in production, use Redis or database)
const matchmakingQueue: Map<string, QueueEntry> = new Map();

// Track which sessions have waiting players (for invite link support)
const sessionToPlayer: Map<string, string> = new Map();

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
            const existingEntry = matchmakingQueue.get(playerId)!;
            return NextResponse.json({
                status: 'queued',
                sessionId: existingEntry.sessionId,
                queuePosition: 1,
                message: 'Already in queue',
            });
        }

        // Try to find a match with existing waiting players
        const queueEntries = Array.from(matchmakingQueue.values())
            .sort((a, b) => a.timestamp - b.timestamp);

        if (queueEntries.length > 0) {
            // Match found! Remove opponent from queue
            const opponent = queueEntries[0];
            matchmakingQueue.delete(opponent.playerId);
            sessionToPlayer.delete(opponent.sessionId);

            // Use the opponent's session ID (they created it first)
            const sessionId = opponent.sessionId;

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

        // No match yet, create a 5-character session code and add to queue
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing characters
        let sessionId = '';
        for (let i = 0; i < 5; i++) {
            sessionId += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        const entry: QueueEntry = {
            playerId,
            playerName: playerName || `Player_${playerId.substring(0, 6)}`,
            timestamp: Date.now(),
            sessionId,
        };

        matchmakingQueue.set(playerId, entry);
        sessionToPlayer.set(sessionId, playerId);

        return NextResponse.json({
            status: 'queued',
            sessionId, // Return session ID for invite links
            queuePosition: 1,
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

        const entry = matchmakingQueue.get(playerId);
        if (entry) {
            sessionToPlayer.delete(entry.sessionId);
            matchmakingQueue.delete(playerId);
        }

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
