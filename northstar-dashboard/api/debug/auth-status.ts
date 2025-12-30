import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from '../../_lib/firebaseAdmin.js';

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
    try {
        const db = getDb();

        // 1. Check Tokens
        const tokenDoc = await db.collection('users').doc('default').collection('integrations').doc('google').get();

        // 2. Check Last Error
        const errorDoc = await db.collection('_debug').doc('auth_error').get();

        const html = `
        <html>
            <body style="font-family: monospace; background: #0f172a; color: #fff; padding: 20px;">
                <h1>Auth Status Diagnostic</h1>
                
                <div style="margin-bottom: 20px; padding: 15px; border-radius: 8px; background: ${tokenDoc.exists ? '#059669' : '#dc2626'}">
                    <h2>1. Tokens Status</h2>
                    <p><strong>Found:</strong> ${tokenDoc.exists ? 'YES' : 'NO'}</p>
                    ${tokenDoc.exists ? `<pre>${JSON.stringify(Object.keys(tokenDoc.data() || {}), null, 2)}</pre>` : ''}
                    ${tokenDoc.exists ? `<p>Updated: ${tokenDoc.data()?.updatedAt}</p>` : ''}
                </div>

                <div style="padding: 15px; border-radius: 8px; background: #1e293b; border: 1px solid #334155;">
                    <h2>2. Last Recorded Error</h2>
                    ${errorDoc.exists ? `
                        <div style="color: #f87171; font-weight: bold;">${errorDoc.data()?.error}</div>
                        <div style="color: #94a3b8; font-size: 12px; margin-top: 5px;">${errorDoc.data()?.timestamp}</div>
                        <pre style="color: #cbd5e1; font-size: 10px; overflow: auto; max-height: 200px;">${errorDoc.data()?.stack}</pre>
                    ` : '<p style="color: #94a3b8">No recent auth errors logged.</p>'}
                </div>
            </body>
        </html>
        `;

        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(html);

    } catch (error: any) {
        return res.status(500).send(`<h1>Check Failed</h1><pre>${error.stack}</pre>`);
    }
}

export default allowCors(handler);
