import { initializeApp, getApps, getApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin SDK for Server-Side Contexts (Vercel Functions, API Routes)
// This file must NOT be imported in client-side components (React pages).

const getFirebaseAdmin = () => {
    // Check if any app is already initialized
    if (getApps().length > 0) {
        return getApp();
    }

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
        throw new Error(
            "⚠️ FIREBASE ADMIN ERROR: Missing Environment Variables. " +
            "Ensure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY are set in Vercel."
        );
    }

    // Initialize the default app
    return initializeApp({
        credential: cert({
            projectId,
            clientEmail,
            privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, '\n'),
        }),
    });
};

// Lazy exports to prevent top-level crashes
export const getDb = () => {
    try {
        const app = getFirebaseAdmin();
        return getFirestore(app);
    } catch (e) {
        console.error("Failed to initialize DB:", e);
        throw e;
    }
};

// Auth export removed or updated if needed (currently not used in the failing path)
export const getAuth = () => {
    // If you need auth, import { getAuth } from 'firebase-admin/auth';
    // For now throwing error to keep minimal changes
    throw new Error("Auth not implemented with modular imports yet");
};

// For backward compatibility (tries to init immediately, might fail)
let _db: FirebaseFirestore.Firestore | undefined;
try {
    _db = getDb();
} catch (e) {
    // Ignore top-level error to allow module load
}
export const db = _db as FirebaseFirestore.Firestore;

