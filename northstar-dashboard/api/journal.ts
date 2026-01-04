import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from './_lib/firebaseAdmin.js';
import { FieldValue } from 'firebase-admin/firestore';

// Helper to handle CORS
const allowCors = (fn: any) => async (req: VercelRequest, res: VercelResponse) => {
    const allowedOrigins = [
        'http://localhost:5173',
        'https://north-star2026.vercel.app',
        'chrome-extension://clnclimmpkjodcfjhbpgpobpkkbhpdpm',
        'chrome-extension://lnbmhdpfadgociijpokfoeqlppjcpmih'
    ];

    const origin = req.headers.origin;

    if (origin && (allowedOrigins.includes(origin) || origin.startsWith('http'))) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
        res.setHeader('Access-Control-Allow-Origin', '*');
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-CSRF-Token, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    return await fn(req, res);
};

async function handler(req: VercelRequest, res: VercelResponse) {
    const db = getDb();
    const action = req.query.action as string;

    try {
        // --- GET: Fetch History or Single Entry ---
        if (req.method === 'GET') {
            const userId = req.query.userId as string;
            if (!userId) {
                return res.status(400).json({ error: 'Missing userId' });
            }

            if (action === 'history') {
                // Fetch last 30 days for correlation analysis
                const endDate = new Date();
                const startDate = new Date();
                startDate.setDate(startDate.getDate() - 30);

                const snapshot = await db.collection('daily_journals')
                    .where('userId', '==', userId)
                    .where('date', '>=', startDate.toISOString().split('T')[0]) // Simple string comparison for ISO dates
                    .orderBy('date', 'asc')
                    .get();

                const history = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                return res.status(200).json({ history });
            } else if (action === 'today' || req.query.date) {
                // Fetch single entry
                const dateStr = (req.query.date as string) || new Date().toISOString().split('T')[0];
                // Doc ID convention: userId_YYYY-MM-DD to enforce uniqueness easily or query by field
                // Let's use query by field 'date' + 'userId' to be safe, or composite ID.
                // Using Query for flexibility:

                const snapshot = await db.collection('daily_journals')
                    .where('userId', '==', userId)
                    .where('date', '==', dateStr)
                    .limit(1)
                    .get();

                if (snapshot.empty) {
                    return res.status(200).json({ entry: null });
                }

                return res.status(200).json({ entry: { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } });
            }
        }

        // --- POST: Upsert (Create or Update) ---
        if (req.method === 'POST') {
            const { userId, date, mood_rating, mindset_shift, brain_dump, tags, associated_work_minutes } = req.body;

            if (!userId || !date || mood_rating === undefined) {
                return res.status(400).json({ error: 'Missing required fields (userId, date, mood_rating)' });
            }

            const journalCollection = db.collection('daily_journals');

            // Check if exists
            const existingQuery = await journalCollection
                .where('userId', '==', userId)
                .where('date', '==', date)
                .limit(1)
                .get();

            const docData = {
                userId,
                date,
                mood_rating: Number(mood_rating),
                mindset_shift: mindset_shift || '',
                brain_dump: brain_dump || '',
                tags: Array.isArray(tags) ? tags : [],
                associated_work_minutes: Number(associated_work_minutes) || 0,
                updated_at: FieldValue.serverTimestamp()
            };

            if (!existingQuery.empty) {
                // Update
                const docId = existingQuery.docs[0].id;
                await journalCollection.doc(docId).update(docData);
                return res.status(200).json({ success: true, id: docId, message: 'Journal updated' });
            } else {
                // Create
                const newDocRef = await journalCollection.add({
                    ...docData,
                    created_at: FieldValue.serverTimestamp()
                });
                return res.status(200).json({ success: true, id: newDocRef.id, message: 'Journal created' });
            }
        }

        return res.status(405).json({ error: `Method ${req.method} not allowed` });

    } catch (error: any) {
        console.error("Journal API Error:", error);
        return res.status(500).json({ error: error.message });
    }
}

export default allowCors(handler);
