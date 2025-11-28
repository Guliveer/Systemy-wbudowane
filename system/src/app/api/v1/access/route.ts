import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

interface ResponseAccess {
    granted: boolean;
    until?: string;
    denyReason?: string;
}

interface ResponseData {
    token: string;
    user: string;
    scanner: string;
}

interface SuccessResponse {
    access: ResponseAccess;
    data: ResponseData;
    timestamp: string;
}

interface ErrorResponse {
    access: { granted: false };
    error: string;
    timestamp: string;
}

type Response = SuccessResponse | ErrorResponse;

// Initialize Supabase client with secret API key for API access
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseSecretKey = process.env.SUPABASE_SECRET_API_KEY!;

/**
 * Verifies if an RFID token has access to a specific scanner.
 * Used by Arduino/ESP devices to check access permissions.
 *
 * @route POST /api/v1/access
 * @access public
 *
 * @param request - The incoming HTTP request
 * @param request.scanner - UUID of the scanner
 * @param request.token - RFID UID read from the card/tag
 *
 * @example Request Body
 * {
 *   "scanner": "550e8400-e29b-41d4-a716-446655440000",
 *   "token": "A1B2C3D4"
 * }
 *
 * @returns JSON response with access decision
 *
 * @throws {400} Missing required fields (scanner or token)
 * @throws {403} Token is disabled, Scanner is disabled, or Access denied
 * @throws {404} Token not found, User not found, or Scanner not found
 * @throws {500} Internal server error
 */
export async function POST(request: Request): Promise<NextResponse<Response>> {
    const timestamp = new Date().toISOString();

    try {
        const body = await request.json();
        const {scanner, token} = body;

        // Validate required parameters
        if (!scanner || !token) {
            return NextResponse.json(
                {
                    access: {granted: false},
                    error: 'Missing required fields. Both scanner and token are required.',
                    timestamp
                },
                {status: 400}
            );
        }

        // Create Supabase client with service role for server-side operations
        const supabase = createClient(supabaseUrl, supabaseSecretKey);

        // Step 1: Find the token by RFID UID
        const {
            data: tokenData,
            error: tokenError
        } = await supabase.from('tokens').select('id, user_id, is_active, name').eq('rfid_uid', token).single();

        if (tokenError || !tokenData) {
            // Token not found
            return NextResponse.json(
                {
                    access: {granted: false},
                    error: 'Token not found',
                    timestamp
                },
                {status: 404}
            );
        }

        if (!tokenData.is_active) {
            // Token is disabled
            return NextResponse.json(
                {
                    access: {granted: false},
                    error: 'Token is disabled',
                    timestamp
                },
                {status: 403}
            );
        }

        // Step 2: Get user information
        const {
            data: userData,
            error: userError
        } = await supabase.from('users').select('id, email').eq('id', tokenData.user_id).single();

        if (userError || !userData) {
            return NextResponse.json(
                {
                    access: {granted: false},
                    error: 'User not found',
                    timestamp
                },
                {status: 404}
            );
        }

        // Step 3: Get scanner information
        const {
            data: scannerData,
            error: scannerError
        } = await supabase.from('scanners').select('id, is_active').eq('id', scanner).single();

        if (scannerError || !scannerData) {
            return NextResponse.json(
                {
                    access: {granted: false},
                    error: 'Scanner not found',
                    timestamp
                },
                {status: 404}
            );
        }

        if (!scannerData.is_active) {
            return NextResponse.json(
                {
                    access: {granted: false},
                    error: 'Scanner is disabled',
                    timestamp
                },
                {status: 403}
            );
        }

        // Step 4: Check if user has access to this scanner
        const {data: accessData} = await supabase.from('scanner_access').select('id, expires_at').eq('user_id', tokenData.user_id).eq('scanner_id', scanner).single();

        const hasAccess = accessData && (!accessData.expires_at || new Date(accessData.expires_at) > new Date());

        // Step 5: Log the access attempt
        await supabase.from('access_logs').insert({
            token_id: tokenData.id,
            scanner_id: scanner,
            access_granted: hasAccess,
            rfid_uid: token
        });

        // Step 6: Update token last_used_at if access granted
        if (hasAccess) {
            await supabase.from('tokens').update({last_used_at: new Date().toISOString()}).eq('id', tokenData.id);
        }

        // Build access object with granted status, optional until, and optional denyReason
        const buildAccess = () => ({
            granted: hasAccess,
            ...(accessData?.expires_at && {until: accessData.expires_at}),
            ...(!hasAccess && {denyReason: 'Access denied for this scanner'})
        });

        return NextResponse.json(
            {
                access: buildAccess(),
                token: token,
                user: userData.email,
                scanner: scanner,
                timestamp
            },
            {status: hasAccess ? 200 : 403}
        );
    } catch (error) {
        console.error('POST access error:', error);
        return NextResponse.json(
            {
                access: {granted: false},
                error: 'Internal server error',
                timestamp
            },
            {status: 500}
        );
    }
}
