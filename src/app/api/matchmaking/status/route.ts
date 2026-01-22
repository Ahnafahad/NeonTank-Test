import { NextRequest, NextResponse } from 'next/server';

// Reference to the same queue from join route (in production, use shared storage)
// For now, this is a placeholder that returns status based on query params

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const playerId = searchParams.get('playerId');

        if (!playerId) {
            return NextResponse.json(
                { error: 'Player ID is required' },
                { status: 400 }
            );
        }

        // In a real implementation, this would check:
        // 1. Redis/database for queue position
        // 2. Whether a match was found
        // 3. Session details if matched

        // For demo purposes, return a placeholder response
        return NextResponse.json({
            status: 'queued',
            queuePosition: 1,
            estimatedWait: 30, // seconds
            message: 'Searching for opponent...',
        });
    } catch (error) {
        console.error('[Matchmaking] Status error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
