import type { VercelRequest, VercelResponse } from '@vercel/node';

const allowCors = (fn: any) => async (req: VercelRequest, res: VercelResponse) => {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,DELETE,PATCH,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    return await fn(req, res);
};

async function handler(req: VercelRequest, res: VercelResponse) {
    const checks = {
        GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
        GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI, // Safe to show
        FIREBASE_PROJECT_ID: !!process.env.FIREBASE_PROJECT_ID,
        FIREBASE_CLIENT_EMAIL: !!process.env.FIREBASE_CLIENT_EMAIL,
        FIREBASE_PRIVATE_KEY: !!process.env.FIREBASE_PRIVATE_KEY,
        FIREBASE_KEY_LENGTH: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.length : 0,
        NODE_ENV: process.env.NODE_ENV
    };

    const html = `
    <html>
        <body style="font-family: monospace; background: #0f172a; color: #fff; padding: 20px;">
            <h1>Environment Check</h1>
            <pre style="background: #1e293b; padding: 20px; border-radius: 8px;">${JSON.stringify(checks, null, 2)}</pre>
            <p style="color: #94a3b8; margin-top: 20px;">Timestamp: ${new Date().toISOString()}</p>
        </body>
    </html>
    `;

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(html);
}

export default allowCors(handler);
