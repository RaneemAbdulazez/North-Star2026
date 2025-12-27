import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// CORS Headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*', // Adjust this to specific extension ID for better security if needed
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export function middleware(request: NextRequest) {
    // 1. Handle API Routes (CORS)
    if (request.nextUrl.pathname.startsWith('/api')) {
        // Handle OPTIONS method for Preflight
        if (request.method === 'OPTIONS') {
            return NextResponse.json({}, { headers: corsHeaders });
        }

        // Add CORS headers to the actual response
        const response = NextResponse.next();
        Object.entries(corsHeaders).forEach(([key, value]) => {
            response.headers.set(key, value);
        });
        return response;
    }

    // 2. Bypass Static Files & Next.js Internals
    // This prevents the "404" on root or other static assets by simply letting them pass through.
    // The mapping to index.html is handled by vercel.json rewrites, not here.
    return NextResponse.next();
}

// Configure paths that trigger this middleware
export const config = {
    matcher: [
        '/api/:path*',
        // We intentionally do NOT match root '/' here to allow vercel.json to handle the SPA fallback naturally.
        // If you need global logic, you can add '/' but be careful not to loop.
    ],
};
