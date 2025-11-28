import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Initialize Supabase client with service role key for API access
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface AccessInfo {
    granted: boolean;
    until?: string;
    denyReason?: string;
}

interface TokenInfo {
    rfid: string;
    name?: string;
}

interface UserInfo {
    email: string;
    fullName?: string;
    role: "root" | "admin" | "user";
}

interface ScannerInfo {
    id: string;
    name: string;
    location: string;
    direction: "entry" | "exit" | "both";
    description?: string;
}

interface ResponseData {
    token: TokenInfo;
    user: UserInfo;
    scanner: ScannerInfo;
}

interface SuccessResponse {
    access: AccessInfo;
    data: ResponseData;
    timestamp: string;
}

interface ErrorResponse {
    access: { granted: false };
    error: string;
    timestamp: string;
}

type Response = SuccessResponse | ErrorResponse;

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
 * @returns {Response} JSON response with access decision
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
                    error: "Missing required fields. Both scanner and token are required.",
                    timestamp,
                },
                {status: 400}
            );
        }

        // Create Supabase client with service role for server-side operations
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Step 1: Find the token by RFID UID
        const {
            data: tokenData,
            error: tokenError
        } = await supabase.from("tokens").select("id, user_id, is_active, name").eq("rfid_uid", token).single();

        if (tokenError || !tokenData) {
            // Token not found
            return NextResponse.json(
                {
                    access: {granted: false},
                    error: "Token not found",
                    timestamp,
                },
                {status: 404}
            );
        }

        if (!tokenData.is_active) {
            // Token is disabled
            return NextResponse.json(
                {
                    access: {granted: false},
                    error: "Token is disabled",
                    timestamp,
                },
                {status: 403}
            );
        }

        // Step 2: Get user information
        const {
            data: userData,
            error: userError
        } = await supabase.from("users").select("id, email, full_name, role").eq("id", tokenData.user_id).single();

        if (userError || !userData) {
            return NextResponse.json(
                {
                    access: {granted: false},
                    error: "User not found",
                    timestamp,
                },
                {status: 404}
            );
        }

        // Helper to build user object with optional fields
        const buildUser = () => ({
            email: userData.email,
            ...(userData.full_name && {fullName: userData.full_name}),
            role: userData.role,
        });

        // Step 3: Get scanner information
        const {
            data: scannerData,
            error: scannerError
        } = await supabase.from("scanners").select("id, name, location, description, reader_type, is_active").eq("id", scanner).single();

        if (scannerError || !scannerData) {
            return NextResponse.json(
                {
                    access: {granted: false},
                    error: "Scanner not found",
                    timestamp,
                },
                {status: 404}
            );
        }

        // Helper to build scanner object with optional fields
        const buildScanner = () => ({
            id: scanner,
            name: scannerData.name,
            location: scannerData.location,
            direction: scannerData.reader_type,
            ...(scannerData.description && {description: scannerData.description}),
        });

        if (!scannerData.is_active) {
            return NextResponse.json(
                {
                    access: {granted: false},
                    error: "Scanner is disabled",
                    timestamp,
                },
                {status: 403}
            );
        }

        // Step 4: Check if user has access to this scanner
        const {data: accessData} = await supabase.from("scanner_access").select("id, expires_at").eq("user_id", tokenData.user_id).eq("scanner_id", scanner).single();

        const hasAccess = accessData && (!accessData.expires_at || new Date(accessData.expires_at) > new Date());

        // Step 5: Log the access attempt
        await supabase.from("access_logs").insert({
            token_id: tokenData.id,
            scanner_id: scanner,
            access_granted: hasAccess,
            rfid_uid: token,
        });

        // Step 6: Update token last_used_at if access granted
        if (hasAccess) {
            await supabase.from("tokens").update({last_used_at: new Date().toISOString()}).eq("id", tokenData.id);
        }

        // Build access object with granted status, optional until, and optional denyReason
        const buildAccess = () => ({
            granted: hasAccess,
            ...(accessData?.expires_at && {until: accessData.expires_at}),
            ...(!hasAccess && {denyReason: "Access denied for this scanner"}),
        });

        return NextResponse.json(
            {
                access: buildAccess(),
                data: {
                    token: {rfid: token, name: tokenData.name},
                    user: buildUser(),
                    scanner: buildScanner(),
                },
                timestamp,
            },
            {status: hasAccess ? 200 : 403}
        );
    } catch (error) {
        console.error("POST access error:", error);
        return NextResponse.json(
            {
                access: {granted: false},
                error: "Internal server error",
                timestamp,
            },
            {status: 500}
        );
    }
}
