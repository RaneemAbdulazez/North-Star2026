import type { VercelRequest, VercelResponse } from '@vercel/node';
// import { getDb } from '../../_lib/firebaseAdmin.js'; // Commented out to isolate

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
    const logs: string[] = [];
    const log = (msg: string) => logs.push(msg);

    try {
        log("Starting Handler...");

        // 1. Dynamic Import (Modular SDK)
        log("Importing firebase-admin/app...");
        const { initializeApp, getApps, cert } = await import('firebase-admin/app');
        const { getFirestore } = await import('firebase-admin/firestore');

        log("Modules imported.");

        // 2. Parse Key
        log("Parsing Private Key...");
        const rawKey = process.env.FIREBASE_PRIVATE_KEY || "";
        const privateKey = rawKey.replace(/\\n/g, '\n').replace(/^"|"$/g, '');

        log(`Key Length: ${privateKey.length}`);
        log(`Starts with Header: ${privateKey.startsWith('-----BEGIN PRIVATE KEY-----')}`);

        // 3. Init App
        log("Initializing App...");
        if (getApps().length === 0) {
            initializeApp({
                credential: cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: privateKey,
                }),
            });
            log("App Initialized.");
        } else {
            log("App already initialized.");
        }

        // 4. Test DB
        log("Testing Firestore...");
        const db = getFirestore();
        await db.collection('_debug').doc('connection_test_isolated').set({
            status: 'isolated_check_ok',
            time: new Date().toISOString()
        });
        log("Write Success.");

        const html = `
        <html>
            <body style="font-family: monospace; background: #0f172a; color: #fff; padding: 20px;">
                <h1>✅ ISOLATED CHECK SUCCESS</h1>
                <pre style="background: #1e293b; padding: 20px;">${logs.join('\n')}</pre>
            </body>
        </html>
        `;
        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(html);

    } catch (error: any) {
        const html = `
        <html>
            <body style="font-family: monospace; background: #0f172a; color: #fff; padding: 20px;">
                <h1>🔥 CRASH CAUGHT</h1>
                <div style="color: #f87171; margin-bottom: 10px;">${error.message}</div>
                <pre style="background: #1e293b; padding: 20px;">Logs:\n${logs.join('\n')}\n\nStack:\n${error.stack}</pre>
            </body>
        </html>
        `;
        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(html); // Return 200 so we see the HTML, not Vercel 500 page
    }
}

export default allowCors(handler);
