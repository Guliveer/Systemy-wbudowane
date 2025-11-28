import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with service role key for API access
// In production, use environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * API Endpoint for Arduino RFID Access Check
 *
 * This endpoint is called by the Arduino device to verify if a token
 * has access to a specific scanner.
 *
 * Query Parameters:
 * - scannerId: The unique identifier of the scanner
 * - tokenId: The RFID UID read from the card/tag
 *
 * Response:
 * - accessGranted: boolean indicating if access should be granted
 * - scannerId: echo of the requested scanner
 * - tokenId: echo of the scanned token
 * - timestamp: server timestamp of the request
 * - userName: (optional) name of the user if access granted
 * - scannerName: (optional) name of the scanner
 *
 * Example Arduino request:
 * GET /api/v1/getAccess?scannerId=scanner-001&tokenId=A1B2C3D4
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const scannerId = searchParams.get('scannerId');
    const tokenId = searchParams.get('tokenId'); // This is the RFID UID

    // Validate required parameters
    if (!scannerId || !tokenId) {
        return NextResponse.json(
            {
                error: 'Missing required parameters',
                message: 'Both scannerId and tokenId are required',
                accessGranted: false
            },
            { status: 400 }
        );
    }

    try {
    // Create Supabase client with service role for server-side operations
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Example implementation - in production this would query the database
        //
        // Step 1: Find the token by RFID UID
        // const { data: token, error: tokenError } = await supabase
        //     .from('tokens')
        //     .select('id, user_id, is_active, name')
        //     .eq('rfid_uid', tokenId)
        //     .single();
        //
        // if (tokenError || !token || !token.is_active) {
        //     // Log the failed attempt
        //     await supabase.from('access_logs').insert({
        //         token_id: token?.id || null,
        //         scanner_id: scannerId,
        //         access_granted: false,
        //         rfid_uid: tokenId,
        //     });
        //
        //     return NextResponse.json({
        //         scannerId,
        //         tokenId,
        //         accessGranted: false,
        //         timestamp: new Date().toISOString(),
        //         reason: token ? 'Token is disabled' : 'Token not found',
        //     });
        // }
        //
        // Step 2: Check if user has access to this scanner
        // const { data: access, error: accessError } = await supabase
        //     .from('scanner_access')
        //     .select('id, expires_at')
        //     .eq('user_id', token.user_id)
        //     .eq('scanner_id', scannerId)
        //     .single();
        //
        // const hasAccess = access && (!access.expires_at || new Date(access.expires_at) > new Date());
        //
        // Step 3: Log the access attempt
        // await supabase.from('access_logs').insert({
        //     token_id: token.id,
        //     scanner_id: scannerId,
        //     access_granted: hasAccess,
        //     rfid_uid: tokenId,
        // });
        //
        // Step 4: Update token last_used_at
        // if (hasAccess) {
        //     await supabase
        //         .from('tokens')
        //         .update({ last_used_at: new Date().toISOString() })
        //         .eq('id', token.id);
        // }

        // For demo purposes, return a mock response
        // In production, replace this with actual database queries above
        const mockAccessGranted = tokenId.length === 8; // Simple mock logic

        const response = {
            scannerId,
            tokenId,
            accessGranted: mockAccessGranted,
            timestamp: new Date().toISOString(),
            // These would come from the database in production
            ...(mockAccessGranted && {
                userName: 'Demo User',
                scannerName: 'Demo Scanner'
            })
        };

        return NextResponse.json(response);
    } catch (error) {
        console.error('Access check error:', error);
        return NextResponse.json(
            {
                error: 'Internal server error',
                accessGranted: false,
                scannerId,
                tokenId,
                timestamp: new Date().toISOString()
            },
            { status: 500 }
        );
    }
}

/**
 * POST endpoint for batch access checks or logging
 * Can be used for more complex operations
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { scannerId, tokenId, action } = body;

        if (!scannerId || !tokenId) {
            return NextResponse.json({ error: 'Missing required fields', accessGranted: false }, { status: 400 });
        }

        // Handle different actions
        switch (action) {
            case 'check':
                // Same as GET but via POST
                return NextResponse.json({
                    scannerId,
                    tokenId,
                    accessGranted: true, // Mock response
                    timestamp: new Date().toISOString()
                });

            case 'log':
                // Log an access event without checking
                // Useful for offline-capable Arduino devices
                return NextResponse.json({
                    success: true,
                    message: 'Access event logged',
                    timestamp: new Date().toISOString()
                });

            default:
                return NextResponse.json({
                    scannerId,
                    tokenId,
                    accessGranted: true, // Mock response
                    timestamp: new Date().toISOString()
                });
        }
    } catch (error) {
        console.error('POST access error:', error);
        return NextResponse.json({ error: 'Invalid request body', accessGranted: false }, { status: 400 });
    }
}
