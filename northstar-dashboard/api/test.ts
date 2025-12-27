import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../src/lib/firebaseAdmin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        // 1. Verify Env Vars (Safe Log)
        console.log("Health Check - Firebase Admin:", {
            projectId: process.env.FIREBASE_PROJECT_ID ? 'Set' : 'Missing',
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL ? 'Set' : 'Missing',
        });

        // 2. Simple DB Check
        const collections = await db.listCollections();
        const collectionIds = collections.map(col => col.id);

        return res.status(200).json({
            status: 'ok',
            message: 'Firebase Admin Connected',
            collections: collectionIds
        });
    } catch (error: any) {
        console.error("Health Check Failed:", error);
        return res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
}
