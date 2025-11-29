import { createClient } from '@/utils/supabase/server';
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

// Database function response type
interface DbFunctionResponse {
    success: boolean;
    error?: string;
    error_code?: string;
    access?: {
        granted: boolean;
        until?: string;
        denyReason?: string;
    };
    data?: {
        token: string;
        user: string;
        scanner: string;
    };
    timestamp?: string;
}

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

        // Create Supabase client
        const supabase = await createClient();

        // Call the database function
        const {data, error} = await supabase.rpc('check_rfid_access', {
            p_scanner_id: scanner,
            p_token_uid: token
        });

        if (error) {
            console.error('RPC error:', error);
            console.error('RPC error details:', JSON.stringify(error, null, 2));

            // Check if the function doesn't exist
            if (error.message?.includes('function') || error.code === '42883') {
                return NextResponse.json(
                    {
                        access: {granted: false},
                        error: 'Database function not found. Please run the SQL migration.',
                        timestamp
                    },
                    {status: 500}
                );
            }

            return NextResponse.json(
                {
                    access: {granted: false},
                    error: `Database error: ${error.message || 'Unknown error'}`,
                    timestamp
                },
                {status: 500}
            );
        }

        const result = data as DbFunctionResponse;

        // Handle function errors
        if (!result.success) {
            const errorCodeToStatus: Record<string, number> = {
                TOKEN_NOT_FOUND: 404,
                USER_NOT_FOUND: 404,
                SCANNER_NOT_FOUND: 404,
                TOKEN_DISABLED: 403,
                SCANNER_DISABLED: 403,
                USER_DISABLED: 403,
                ACCESS_DISABLED: 403,
                ACCESS_EXPIRED: 403,
                NO_ACCESS: 403
            };

            const status = result.error_code ? errorCodeToStatus[result.error_code] || 500 : 500;

            return NextResponse.json(
                {
                    access: {granted: false},
                    error: result.error || 'Unknown error',
                    timestamp
                },
                {status}
            );
        }

        // Return success response
        return NextResponse.json(
            {
                access: result.access!,
                data: result.data!,
                timestamp: result.timestamp || timestamp
            },
            {status: result.access!.granted ? 200 : 403}
        );
    } catch (error) {
        console.error('POST access error:', error);
        console.error('Error details:', error instanceof Error ? error.message : String(error));
        return NextResponse.json(
            {
                access: {granted: false},
                error: error instanceof Error ? error.message : 'Internal server error',
                timestamp
            },
            {status: 500}
        );
    }
}
