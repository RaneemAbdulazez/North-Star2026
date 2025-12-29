import { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from '../../src/lib/firebaseAdmin';

// Helper to handle CORS
const allowCors = (fn: any) => async (req: VercelRequest, res: VercelResponse) => {
    const allowedOrigins = [
        'http://localhost:5173',
        'https://north-star2026.vercel.app',
        'chrome-extension://clnclimmpkjodcfjhbpgpobpkkbhpdpm',
        'chrome-extension://lnbmhdpfadgociijpokfoeqlppjcpmih'
    ];

    const origin = req.headers.origin;

    if (origin && allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
        res.setHeader('Access-Control-Allow-Origin', '*');
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-CSRF-Token, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    return await fn(req, res);
};

async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        const db = getDb();
        const now = new Date();

        let startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        if (req.query.date) {
            startOfDay = new Date(req.query.date as string);
        }

        const logsRef = db.collection('work_logs');
        const snapshot = await logsRef
            .where('date', '>=', startOfDay.toISOString())
            .get();

        let totalHours = 0;
        let projectBreakdown: { [key: string]: number } = {};

        snapshot.forEach((doc: any) => {
            const data = doc.data();
            const h = parseFloat(data.hours) || 0;
            totalHours += h;
            if (data.project_id) {
                projectBreakdown[data.project_id] = (projectBreakdown[data.project_id] || 0) + h;
            }
        });

        const habitsRef = db.collection('habit_logs');
        const habitSnap = await habitsRef
            .where('completed_at', '>=', startOfDay.toISOString())
            .get();

        let habitHours = 0;
        habitSnap.forEach((doc: any) => {
            const data = doc.data();
            const mins = parseFloat(data.total_actual_minutes) || 0;
            habitHours += mins / 60;
        });

        const grandTotal = totalHours + habitHours;
        const DAILY_TARGET = 5.9;

        return res.status(200).json({
            date: startOfDay.toISOString(),
            total_hours: grandTotal,
            work_hours: totalHours,
            habit_hours: habitHours,
            daily_target: DAILY_TARGET,
            progress_percent: Math.min((grandTotal / DAILY_TARGET) * 100, 100),
            projects: projectBreakdown
        });

    } catch (error) {
        console.error("Error fetching daily stats:", error);
        return res.status(500).json({ error: 'Failed to fetch daily stats' });
    }
}

export default allowCors(handler);
