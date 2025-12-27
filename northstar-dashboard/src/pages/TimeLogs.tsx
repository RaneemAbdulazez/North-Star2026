import { motion } from 'framer-motion';
import { History, Calendar, Clock, Search } from 'lucide-react';
import { useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';

interface WorkLog {
    id: string;
    project_name: string;
    date: { seconds: number };
    hours: number;
    notes?: string;
    pillar_id?: string;
}

export default function TimeLogs() {
    const [logs, setLogs] = useState<WorkLog[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const q = query(collection(db, "work_logs"), orderBy("date", "desc"), limit(50));
                const querySnapshot = await getDocs(q);
                const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkLog));
                setLogs(data);
            } catch (error) {
                console.error("Error loading logs:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchLogs();
    }, []);

    const formatDate = (seconds: number) => {
        return new Date(seconds * 1000).toLocaleDateString('en-US', {
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
                        Time Logs
                    </h1>
                    <p className="text-slate-400 mt-2 ml-14 max-w-lg">
                        A history of your deep work sessions.
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
                                <th className="p-5 text-xs font-bold text-slate-300 uppercase tracking-wider">Project</th>
                                <th className="p-5 text-xs font-bold text-slate-300 uppercase tracking-wider">Duration</th>
                                <th className="p-5 text-xs font-bold text-slate-300 uppercase tracking-wider">Notes</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-slate-500 animate-pulse">Loading history...</td>
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
                                                {formatDate(log.date?.seconds)}
                                            </div>
                                        </td>
                                        <td className="p-5">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                                                <span className="font-medium text-white text-sm">{log.project_name}</span>
                                            </div>
                                        </td>
                                        <td className="p-5">
                                            <div className="flex items-center gap-2 text-slate-300 text-sm font-mono bg-slate-900/50 px-2 py-1 rounded-lg w-fit border border-white/5">
                                                <Clock size={14} className="text-slate-500" />
                                                {log.hours}h
                                            </div>
                                        </td>
                                        <td className="p-5">
                                            <span className="text-slate-400 text-sm line-clamp-1 group-hover:text-slate-300 transition-colors">
                                                {log.notes || "-"}
                                            </span>
                                        </td>
                                    </motion.tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-slate-500">No logs found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
