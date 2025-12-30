import { getDb } from './api/_lib/firebaseAdmin.js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env.local manually for the script
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

async function verifyConnection() {
    console.log("🔍 Checking Firebase Configuration...");

    const checkEnv = (key: string) => {
        const val = process.env[key];
        if (!val) {
            console.error(`❌ Missing ${key}`);
            return false;
        }
        console.log(`✅ ${key} is present ` + (key.includes('KEY') ? '(length: ' + val.length + ')' : ''));
        return true;
    };

    if (!checkEnv('FIREBASE_PROJECT_ID') || !checkEnv('FIREBASE_CLIENT_EMAIL') || !checkEnv('FIREBASE_PRIVATE_KEY')) {
        console.error("⚠️  Stopping verification due to missing env vars.");
        process.exit(1);
    }

    try {
        console.log("Attempting to initialize DB and fetch a test document...");
        const db = getDb();

        // Try listing collections or reading a dummy doc
        const collections = await db.listCollections();
        console.log(`✅ Connection Successful! Found ${collections.length} collections.`);
        collections.forEach(c => console.log(`   - ${c.id}`));

    } catch (error: any) {
        console.error("❌ Firebase Connection Failed:");
        console.error(error.message);
        if (error.message.includes("PEM routines")) {
            console.error("👉 This is likely a Private Key formatting issue. The .replace(/\\\\n/g, '\\n') fix should handle this in production.");
        }
    }
}

verifyConnection();
