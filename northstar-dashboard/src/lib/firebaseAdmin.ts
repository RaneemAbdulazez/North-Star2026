import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK for Server-Side Contexts (Vercel Functions, API Routes)
// This file must NOT be imported in client-side components (React pages).

// 1. Safety Check: Ensure no hardcoded keys
// The following variables MUST be set in Vercel Environment Variables.
const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;

// Debug Log (Safety Check) - Remove in production if strict logs are needed
console.log("Firebase Admin Init Check:", {
    hasProjectId: !!projectId,
    hasClientEmail: !!clientEmail,
    hasPrivateKey: !!privateKey,
    projectIdValue: projectId // Safe to log ID
});

if (!projectId || !clientEmail || !privateKey) {
    console.error(
        "⚠️ FIREBASE ADMIN ERROR: Missing Environment Variables.\n" +
        "Ensure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY are set in Vercel."
    );
} else {
    const firebaseAdminConfig = {
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'), // Critical Fix for newline chars
    };

    if (!admin.apps.length) {
        try {
            admin.initializeApp({
                credential: admin.credential.cert(firebaseAdminConfig),
            });
            // console.log("✅ Firebase Admin Initialized Successfully");
        } catch (error) {
            console.error("❌ Firebase Admin Initialization Failed:", error);
        }
    }
}

export const db = admin.firestore();
export const auth = admin.auth();
