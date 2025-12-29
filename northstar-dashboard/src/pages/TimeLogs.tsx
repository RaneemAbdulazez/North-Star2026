import { motion } from 'framer-motion';
import { History, Calendar, Clock, Search, Zap, Briefcase, Trash2, Pencil } from 'lucide-react';
import { useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { EditLogModal } from '../components/EditLogModal';

// API Helpers
const API_BASE = "https://north-star2026.vercel.app/api/time-logs";

const deleteLog = async (id: string, type: 'work_log' | 'habit_log') => {
    const res = await fetch(`${API_BASE}/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, type })
    });
    if (!res.ok) throw new Error("Failed to delete log");
    return res.json();
};

interface LogItem {
    id: string;
    type: 'work' | 'habit';
    name: string;
    date: { seconds: number } | Date;
    duration: string;
    rawDate: number; // for sorting
    notes?: string;
}

export default function TimeLogs() {
    const [logs, setLogs] = useState<LogItem[]>([]);
    const [loading, setLoading] = useState(true);

    // Edit State
    const [editingLog, setEditingLog] = useState<LogItem | null>(null);
    const [isEditOpen, setIsEditOpen] = useState(false);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                // Fetch Work Logs
                const workQ = query(collection(db, "work_logs"), orderBy("date", "desc"), limit(50));
                const workSnap = await getDocs(workQ);
                const workLogs = workSnap.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        type: 'work',
                        name: data.task_name || data.project_name || 'Unknown Project', // Use task_name if available
                        date: data.date,
                        duration: `${data.hours}h`,
                        rawDate: typeof data.date === 'string' ? new Date(data.date).getTime() : (data.date?.seconds || 0),
                        notes: data.notes
                    } as LogItem;
                });

                // Fetch Habit Logs
                const habitQ = query(collection(db, "habit_logs"), orderBy("completed_at", "desc"), limit(50));
                const habitSnap = await getDocs(habitQ);
                const habitLogs = habitSnap.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        type: 'habit',
                        name: data.habit_name || 'Unknown Habit',
                        date: data.completed_at,
                        duration: `${data.actual_minutes}m`, // Show minutes for habits
                        rawDate: typeof data.completed_at === 'string' ? new Date(data.completed_at).getTime() : (data.completed_at?.seconds || 0),
                        notes: '-'
                    } as LogItem;
                });

                // Merge and Sort
                const allLogs = [...workLogs, ...habitLogs].sort((a, b) => b.rawDate - a.rawDate);
                setLogs(allLogs);

            } catch (error) {
                console.error("Error loading logs:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchLogs();
    }, []);

    const handleDelete = async (id: string, type: 'work' | 'habit') => {
        if (!confirm("Are you sure you want to delete this log?")) return;
        try {
            await deleteLog(id, type === 'work' ? 'work_log' : 'habit_log');
            // Optimistic update
            setLogs(prev => prev.filter(l => l.id !== id));
        } catch (error) {
            console.error("Delete failed:", error);
            alert("Failed to delete log");
        }
    };

    const handleEditClick = (log: LogItem) => {
        if (log.type !== 'work') {
            alert("Editing is only supported for Work Logs currently.");
            return;
        }
        setEditingLog(log);
        setIsEditOpen(true);
    };

    const handleUpdateLog = async (id: string, newName: string, newDuration: number) => {
        const res = await fetch(`${API_BASE}/edit`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                logId: id,
                newTaskName: newName,
                newDuration: newDuration,
                type: 'work_log'
            })
        });

        if (!res.ok) throw new Error("Failed to update log");

        // Optimistic Update
        setLogs(prev => prev.map(l => {
            if (l.id === id) {
                return {
                    ...l,
                    name: newName,
                    duration: `${newDuration}h`,
                };
            }
            return l;
        }));
    };

    const formatDate = (date: any) => {
        if (!date) return '-';
        let d: Date;

        if (typeof date === 'string') {
            d = new Date(date);
        } else if ('seconds' in date) {
            d = new Date(date.seconds * 1000);
        } else {
            d = date;
        }

        return d.toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
        });
    };

    return (
        <div className="max-w-6xl mx-auto">
            <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3 text-sm text-slate-400 mb-2 font-mono">
                        <span className="text-blue-500">Home</span>
                        <span>/</span>
                        <span>History</span>
                    </div>
                    <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                        <div className="p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
                            <History size={24} className="text-purple-400" />
                        </div>
                        Activity History
                    </h1>
                    <p className="text-slate-400 mt-2 ml-14 max-w-lg">
                        A combined history of your projects and habits.
                    </p>
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                    <input
                        type="text"
                        placeholder="Search logs..."
                        className="bg-slate-900/50 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 w-full md:w-64"
                    />
                </div>
            </header>

            <div className="bg-surface backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden shadow-glass">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/5 bg-white/5">
                                <th className="p-5 text-xs font-bold text-slate-300 uppercase tracking-wider">Date</th>
                                <th className="p-5 text-xs font-bold text-slate-300 uppercase tracking-wider">Activity</th>
                                <th className="p-5 text-xs font-bold text-slate-300 uppercase tracking-wider">Type</th>
                                <th className="p-5 text-xs font-bold text-slate-300 uppercase tracking-wider">Duration</th>
                                <th className="p-5 text-xs font-bold text-slate-300 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-slate-500 animate-pulse">Loading history...</td>
                                </tr>
                            ) : logs.length > 0 ? (
                                logs.map((log, index) => (
                                    <motion.tr
                                        key={log.id}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        className="hover:bg-white/5 transition-colors group"
                                    >
                                        <td className="p-5">
                                            <div className="flex items-center gap-2 text-slate-300 text-sm font-mono">
                                                <Calendar size={14} className="text-slate-500" />
                                                {formatDate(log.date)}
                                            </div>
                                        </td>
                                        <td className="p-5">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)] ${log.type === 'work' ? 'bg-blue-500' : 'bg-green-500'}`} />
                                                <span className="font-medium text-white text-sm">{log.name}</span>
                                            </div>
                                        </td>
                                        <td className="p-5">
                                            <div className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md w-fit border ${log.type === 'work'
                                                ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                                : 'bg-green-500/10 text-green-400 border-green-500/20'
                                                }`}>
                                                {log.type === 'work' ? <Briefcase size={12} /> : <Zap size={12} />}
                                                {log.type === 'work' ? 'Project' : 'Habit'}
                                            </div>
                                        </td>
                                        <td className="p-5">
                                            <div className="flex items-center gap-2 text-slate-300 text-sm font-mono bg-slate-900/50 px-2 py-1 rounded-lg w-fit border border-white/5">
                                                <Clock size={14} className="text-slate-500" />
                                                {log.duration}
                                            </div>
                                        </td>
                                        <td className="p-5 text-right">
                                            <div className="flex justify-end items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {/* Edit Button */}
                                                <button
                                                    onClick={() => handleEditClick(log)}
                                                    className="p-2 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                                                    title="Edit Log"
                                                >
                                                    <Pencil size={16} />
                                                </button>
                                                {/* Delete Button */}
                                                <button
                                                    onClick={() => handleDelete(log.id, log.type)}
                                                    className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                    title="Delete Log"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-slate-500">No logs found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <EditLogModal
                isOpen={isEditOpen}
                onClose={() => setIsEditOpen(false)}
                onSave={handleUpdateLog}
                log={editingLog ? {
                    id: editingLog.id,
                    name: editingLog.name,
                    duration: parseFloat(editingLog.duration) // Parse "2.5h" -> 2.5
                } : null}
            />
        </div>
    );
}
