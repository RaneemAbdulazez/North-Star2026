
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

if (!getApps().length) {
    initializeApp({
        credential: cert(serviceAccount),
    });
}

const db = getFirestore();

async function checkTokens() {
    console.log("Checking tokens for user 'default'...");
    try {
        const doc = await db.collection('users').doc('default').collection('integrations').doc('google').get();
        if (doc.exists) {
            console.log("Tokens FOUND ✅");
            const data = doc.data();
            console.log("Fields:", Object.keys(data || {}));
            console.log("Updated At:", data?.updatedAt);
        } else {
            console.log("Tokens MISSING ❌");
        }
    } catch (error) {
        console.error("Error checking tokens:", error);
    }
}

checkTokens();
