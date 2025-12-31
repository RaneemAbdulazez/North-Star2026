import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from './_lib/firebaseAdmin.js';
import { FieldValue } from 'firebase-admin/firestore';

const allowCors = (fn: any) => async (req: VercelRequest, res: VercelResponse) => {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    return await fn(req, res);
};

async function handler(req: VercelRequest, res: VercelResponse) {
    const db = getDb();
    const userId = 'default'; // Hardcoded for single-user MVP

    try {
        // Switch to ROOT projects collection based on user feedback that projects exist but are not found
        // If authentication is added later, we can filter by ownerId field
        const projectsRef = db.collection('projects'); // WAS: users/default/projects

        // GET: List all projects
        if (req.method === 'GET') {
            const snapshot = await projectsRef.get();
            const projects = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            return res.status(200).json({ projects });
        }

        // POST: Create a new project
        if (req.method === 'POST') {
            const { name, color } = req.body;
            if (!name) return res.status(400).json({ error: "Missing project name" });

            const newProject = {
                name,
                color: color || '#3b82f6', // Default blue
                created_at: FieldValue.serverTimestamp()
            };

            const docRef = await projectsRef.add(newProject);
            return res.status(201).json({ id: docRef.id, ...newProject });
        }

        return res.status(405).json({ error: "Method Not Allowed" });

    } catch (error: any) {
        console.error("Projects API Error:", error);
        return res.status(500).json({ error: error.message });
    }
}

export default allowCors(handler);
