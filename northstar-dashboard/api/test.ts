import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from '../src/lib/firebaseAdmin.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        console.log("Health Check - Initializing Admin...");

        // This will throw if env vars are missing
        const db = getDb();

        // 1. Simple DB Check
        const collections = await db.listCollections();
        const collectionIds = collections.map(col => col.id);

        return res.status(200).json({
            status: 'ok',
            message: 'Firebase Admin Connected',
            collections: collectionIds,
            projectId: process.env.FIREBASE_PROJECT_ID
        });
    } catch (error: any) {
        console.error("Health Check Failed:", error);
        return res.status(500).json({
            status: 'error',
            error: error.message,
            help: "Ensure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY are set in Vercel."
        });
    }
}
