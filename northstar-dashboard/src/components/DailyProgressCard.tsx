import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Target, TrendingUp, AlertCircle, CheckCircle, Activity, Footprints, Calendar, Sun, Moon, CloudSun } from 'lucide-react';

interface DailyStats {
    total_hours: number;
    daily_target: number;
    progress_percent: number;
    projects: Record<string, number>;
}

interface Project {
    id: string;
    name: string;
}

interface Props {
    projectsList?: Project[];
}

export function DailyProgressCard({ projectsList = [] }: Props) {
    const [stats, setStats] = useState<DailyStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [timeOfDay, setTimeOfDay] = useState<'morning' | 'noon' | 'evening' | 'celebration'>('morning');

    const today = new Date();
    const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    const currentHour = today.getHours();

    // Q1 Countdown Logic
    const q1Deadline = new Date('2026-03-31T23:59:59');
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysLeft = Math.ceil((q1Deadline.getTime() - today.getTime()) / msPerDay);

    useEffect(() => {
        // Determine time of day Theme
        if (currentHour >= 5 && currentHour < 11) setTimeOfDay('morning');
        else if (currentHour >= 11 && currentHour < 17) setTimeOfDay('noon');
        else setTimeOfDay('evening');

        async function fetchDailyStats() {
            try {
                const res = await fetch('/api/time-logs?action=daily-stats');

                if (!res.ok) {
                    console.warn(`Daily Stats API Error: ${res.status}`);
                    return; // Fail gracefully
                }

                // Verify JSON
                const contentType = res.headers.get("content-type");
                if (!contentType || !contentType.includes("application/json")) {
                    console.warn("Daily Stats API returned non-JSON.");
                    return;
                }

                const data = await res.json();
                setStats(data);

                // Override theme if goal met
                if (data.total_hours >= 6) {
                    setTimeOfDay('celebration');
                }

            } catch (error) {
                console.error("Failed to fetch daily stats:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchDailyStats();
    }, [currentHour]);

    if (loading) return <div className="h-64 bg-surface/50 rounded-3xl animate-pulse" />;
    if (!stats) return null;

    const { total_hours, daily_target, progress_percent } = stats;
    const hoursLeft = Math.max(0, daily_target - total_hours);
    const isTargetMet = total_hours >= 6; // Strict 6h check for celebration

    // Resolve Contextual Message
    let message = `Let's seize the day! ${daily_target}h target ahead.`;
    if (progress_percent > 10 && progress_percent < 50) message = "Good start! You're warming up. Keep the pace!";
    if (progress_percent >= 50 && progress_percent < 80) message = "Halfway there! The runner's high is kicking in. 🏃";
    if (progress_percent >= 80 && !isTargetMet) message = "Final stretch! Just a bit more to the finish line.";
    if (isTargetMet) message = "Daily Goal Achieved! You are officially on track for your 425h Q1 target.";

    // Sort and Humanize Projects
    const activeProjects = Object.entries(stats.projects)
        .sort(([, a], [, b]) => b - a)
        .map(([id, hrs]) => {
            const proj = projectsList.find(p => p.id === id);
            return { name: proj?.name || "Unknown Project", hours: hrs };
        });

    // Theme Config
    const themes = {
        morning: {
            bg: "from-sky-900/40 to-blue-900/40",
            accent: "text-sky-400",
            icon: <Sun className="text-yellow-400 animate-spin-slow" />,
            runner: "bg-sky-400"
        },
        noon: {
            bg: "from-amber-900/40 to-orange-900/40",
            accent: "text-amber-400",
            icon: <CloudSun className="text-orange-400" />,
            runner: "bg-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.6)]" // High energy neon
        },
        evening: {
            bg: "from-indigo-900/40 to-purple-900/40",
            accent: "text-indigo-400",
            icon: <Moon className="text-purple-300" />,
            runner: "bg-indigo-500"
        },
        celebration: {
            bg: "from-yellow-900/40 to-amber-900/50",
            accent: "text-yellow-400",
            icon: <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ repeat: Infinity, duration: 2 }}><Target className="text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]" size={28} /></motion.div>,
            runner: "bg-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.8)]"
        }
    };
    const theme = themes[timeOfDay];


    return (
        <section className={`relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br ${theme.bg} p-6 transition-colors duration-1000`}>

            {/* Header: Date & Time Context */}
            <div className="flex items-center justify-between mb-8 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/5 rounded-xl backdrop-blur-md border border-white/10">
                        <Calendar size={20} className="text-slate-300" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-white tracking-tight">{dateStr}</h2>
                        <div className="flex items-center gap-4">
                            <p className={`text-xs font-mono font-bold uppercase tracking-widest ${theme.accent} flex items-center gap-2`}>
                                {timeOfDay === 'celebration' ? 'GOAL ACHIEVED' : timeOfDay.toUpperCase() + ' SESSIONS'} • {Math.round(progress_percent)}% COMPLETE
                            </p>
                            {/* Q1 Countdown Payload */}
                            <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/30 border border-white/10 backdrop-blur-sm">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
                                </span>
                                <span className="text-[10px] font-bold text-slate-300 tracking-wide">
                                    <span className="text-purple-400 animate-pulse">{daysLeft}</span> DAYS LEFT IN Q1
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="hidden md:block scale-125">
                    {theme.icon}
                </div>
            </div>

            {/* THE DAY RUNNER ANIMATION */}
            <div className="relative h-24 mb-8 w-full bg-black/20 rounded-2xl border border-white/5 overflow-hidden flex items-center px-4">
                {/* Track Line */}
                <div className="absolute top-1/2 left-0 w-full h-0.5 bg-white/10" />

                {/* Day Markers (0h, 3h, 6h) */}
                <div className="absolute top-1/2 left-[5%] w-1 h-2 bg-slate-600 -translate-y-1/2" />
                <div className="absolute top-1/2 left-[50%] w-1 h-2 bg-slate-600 -translate-y-1/2" />
                <div className="absolute top-1/2 right-[5%] w-1 h-2 bg-green-500/50 -translate-y-1/2" />

                {/* The Runner */}
                <motion.div
                    className="absolute top-1/2 -translate-y-1/2 z-10"
                    initial={{ left: "0%" }}
                    animate={{ left: `${Math.min(progress_percent, 95)}%` }} // Cap at 95% to stay in view
                    transition={{ duration: 1.5, type: "spring", stiffness: 50 }}
                >
                    <div className="relative">
                        {/* Avatar/Icon */}
                        <div className={`w-10 h-10 rounded-full ${theme.runner} flex items-center justify-center text-white font-bold shadow-lg border-2 border-white/20 relative z-10`}>
                            {timeOfDay === 'noon' ? <Activity size={20} className="animate-pulse" /> : <Footprints size={18} />}
                        </div>
                        {/* Pulse Effect for Noon/Running */}
                        {timeOfDay === 'noon' && (
                            <div className="absolute inset-0 rounded-full bg-orange-500 animate-ping opacity-75" />
                        )}
                        {/* Tooltip */}
                        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-bold text-white bg-black/60 px-2 py-0.5 rounded-full backdrop-blur-sm">
                            {total_hours.toFixed(1)}h
                        </div>
                    </div>
                </motion.div>
            </div>


            <div className="flex flex-col lg:flex-row gap-8 relative z-10">

                {/* Status Message Area */}
                <div className="flex-1 space-y-4">
                    <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-2xl bg-white/5 border border-white/10 ${isTargetMet ? "text-green-400" : theme.accent}`}>
                            {isTargetMet ? <CheckCircle size={24} /> : <Target size={24} />}
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white leading-tight">
                                {message}
                            </h3>
                            <p className="text-slate-400 text-sm mt-1">
                                {isTargetMet
                                    ? "You've exceeded the daily goal. Outstanding performance!"
                                    : <span><strong className="text-white">{hoursLeft.toFixed(1)}h</strong> remaining to hit your {daily_target}h target.</span>
                                }
                            </p>
                        </div>
                    </div>
                </div>

                {/* Vertical Divider */}
                <div className="hidden lg:block w-px bg-white/10" />

                {/* Humanized Projects List */}
                <div className="flex-1 w-full lg:max-w-md">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <TrendingUp size={14} /> Active Work
                    </h4>
                    <div className="space-y-2">
                        {activeProjects.length > 0 ? (
                            activeProjects.slice(0, 3).map((proj, idx) => (
                                <div key={idx} className="flex items-center justify-between bg-black/20 hover:bg-black/30 transition-colors p-2.5 rounded-xl border border-white/5">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-2 rounded-full ${idx === 0 ? "bg-green-500 animate-pulse" : "bg-slate-500"}`} />
                                        <span className="text-sm text-slate-200 font-medium truncate max-w-[150px]">{proj.name}</span>
                                    </div>
                                    <span className={`text-sm font-bold ${idx === 0 ? "text-green-400" : "text-slate-400"}`}>{proj.hours.toFixed(1)}h</span>
                                </div>
                            ))
                        ) : (
                            <div className="text-sm text-slate-500 italic flex items-center gap-2 p-2">
                                <AlertCircle size={14} /> No active work logged today yet.
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </section>
    );
}

