export interface Project {
    id: string;
    name: string;
    color: string;
    budget?: number; // Added as per requirement
}

export interface Goal {
    id: string;
    title: string;
    projectId: string; // Links to Project
    weekId: string;
    estimated_hours: number;
    status: 'todo' | 'in_progress' | 'done';
}

export interface Task {
    id: string;
    title: string;
    estimated_minutes: number;
    scheduled_date: string | null;
    status: 'todo' | 'done';
    goalId?: string; // Links to Goal (if part of hierarchy)
    duration?: number; // Added alias for compatibility if needed, though estimated_minutes is primary
}
