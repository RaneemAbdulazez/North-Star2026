import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK for Server-Side Contexts (Vercel Functions, API Routes)
// This file must NOT be imported in client-side components (React pages).

// 1. Safety Check: Ensure no hardcoded keys
// The following variables MUST be set in Vercel Environment Variables.
const getFirebaseAdmin = () => {
    if (admin.apps.length > 0) {
        return admin.app();
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

    return admin.initializeApp({
        credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
    });
};

// Lazy exports to prevent top-level crashes
export const getDb = () => {
    try {
        const app = getFirebaseAdmin();
        return app.firestore();
    } catch (e) {
        console.error("Failed to initialize DB:", e);
        throw e;
    }
};

export const getAuth = () => {
    try {
        const app = getFirebaseAdmin();
        return app.auth();
    } catch (e) {
        console.error("Failed to initialize Auth:", e);
        throw e;
    }
};

// For backward compatibility (tries to init immediately, might fail)
// Better to migrate consumers to use getDb()
// But to avoid breaking other files immediately, we can try-catch:
let _db: FirebaseFirestore.Firestore | undefined;
try {
    _db = getDb();
} catch (e) {
    // Ignore top-level error to allow module load
}
export const db = _db as FirebaseFirestore.Firestore;

