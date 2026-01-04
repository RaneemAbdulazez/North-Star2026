export interface DailyJournal {
    id?: string; // Firestore Document ID (usually the date YYYY-MM-DD or auto-id)
    userId: string;

    // Core Data
    date: string; // ISO 8601 Date String (YYYY-MM-DD) for easy querying
    mood_rating: number; // 1-5
    mindset_shift?: string; // Short text
    brain_dump?: string; // Long text

    // Context
    tags: string[]; // e.g. ["period_start", "sick", "travel"]
    associated_work_minutes: number; // Snapshotted work total for correlation

    // Metadata
    created_at: any; // Firestore Timestamp
    updated_at: any; // Firestore Timestamp
}

// Helper for clients to define allowable tags
export const CYCLIST_TAGS = {
    PERIOD_START: 'period_start',
    PERIOD_HEAVY: 'period_heavy',
    SICK: 'sick',
    BURNOUT_WARNING: 'burnout_warning',
    HIGH_ENERGY: 'high_energy' // Could imply HIGHER target?
};
