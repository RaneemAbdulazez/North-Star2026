import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Target, Zap, Clock, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';

interface DailyStats {
    total_hours: number;
    daily_target: number;
    progress_percent: number;
    projects: Record<string, number>;
}

export function DailyProgressCard() {
    const [stats, setStats] = useState<DailyStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchDailyStats() {
            try {
                // Use the new API endpoint
                const res = await fetch('/api/time-logs/daily-stats');
                const data = await res.json();
                setStats(data);
            } catch (error) {
                console.error("Failed to fetch daily stats:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchDailyStats();
    }, []);

    if (loading) return <div className="h-48 bg-surface/50 rounded-3xl animate-pulse" />;
    if (!stats) return null;

    const { total_hours, daily_target, progress_percent } = stats;
    const hoursLeft = Math.max(0, daily_target - total_hours);
    const isTargetMet = total_hours >= daily_target;

    // Traffic Light Logic (Mocked for now as we need "project daily average requirements")
    // For now, we'll list projects worked on today.
    const activeProjects = Object.entries(stats.projects).sort(([, a], [, b]) => b - a);

    return (
        <section className="bg-gradient-to-br from-indigo-900/40 to-slate-900/80 border border-indigo-500/20 rounded-3xl p-6 relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[60px] pointer-events-none" />

            <div className="flex flex-col lg:flex-row items-center justify-between gap-8 relative z-10">

                {/* Main Progress Ring */}
                <div className="flex items-center gap-6">
                    <div className="relative w-32 h-32">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                            <path className="text-slate-700/50" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                            <motion.path
                                initial={{ strokeDasharray: "0, 100" }}
                                animate={{ strokeDasharray: `${Math.min(progress_percent, 100)}, 100` }}
                                transition={{ duration: 1.5, ease: "easeOut" }}
                                className={isTargetMet ? "text-green-400" : "text-indigo-400"}
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                                strokeLinecap="round"
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className={`text-2xl font-bold ${isTargetMet ? "text-green-400" : "text-white"}`}>
                                {Math.round(progress_percent)}%
                            </span>
                            <span className="text-[10px] text-slate-400 uppercase tracking-widest">Daily</span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded-lg ${isTargetMet ? "bg-green-500/20 text-green-400" : "bg-indigo-500/20 text-indigo-400"}`}>
                                {isTargetMet ? <CheckCircle size={18} /> : <Target size={18} />}
                            </div>
                            <h3 className="text-xl font-bold text-white">Today's Focus</h3>
                        </div>
                        <p className="text-slate-400 text-sm">
                            {isTargetMet
                                ? "Daily target crushed! 🚀"
                                : <span><strong className="text-white">{hoursLeft.toFixed(1)}h</strong> left to reach your {daily_target}h goal.</span>
                            }
                        </p>
                        <div className="flex items-center gap-4 text-xs font-mono text-slate-500 mt-2">
                            <span className="flex items-center gap-1"><Clock size={12} /> {total_hours.toFixed(1)}h Done</span>
                            <span className="flex items-center gap-1"><Zap size={12} /> {daily_target}h Target</span>
                        </div>
                    </div>
                </div>

                {/* Vertical Divider */}
                <div className="hidden lg:block w-px h-24 bg-white/10" />

                {/* Active Projects List */}
                <div className="flex-1 w-full lg:max-w-md">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <TrendingUp size={14} /> Active Engines
                    </h4>
                    <div className="space-y-3">
                        {activeProjects.length > 0 ? (
                            activeProjects.slice(0, 3).map(([pid, hrs]) => (
                                <div key={pid} className="flex items-center justify-between bg-black/20 p-2.5 rounded-xl border border-white/5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                        <span className="text-sm text-slate-200 font-medium">Project ID: {pid.substring(0, 8)}...</span>
                                    </div>
                                    <span className="text-sm font-bold text-green-400">{hrs.toFixed(1)}h</span>
                                </div>
                            ))
                        ) : (
                            <div className="text-sm text-slate-500 italic flex items-center gap-2">
                                <AlertCircle size={14} /> No active work logged today yet.
                            </div>
                        )}
                        {/* Placeholder for "Lagging" Projects - Logic would go here */}
                    </div>
                </div>

            </div>
        </section>
    );
}
