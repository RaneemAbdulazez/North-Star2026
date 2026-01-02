import { useEffect, useState } from 'react';
import { db } from '../config/firebase';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { motion } from 'framer-motion';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, BarChart, Bar
} from 'recharts';
import { Activity, Zap, TrendingUp, DollarSign, Heart, BookOpen, AlertTriangle } from 'lucide-react';

interface WorkLog {
    id: string;
    project_id: string;
    hours: number;
    date: string;
}

interface Project {
    id: string;
    name: string;
    pillar_id: string;
}

interface Habit {
    id: string;
    current_streak: number;
    last_completed_date: string;
    total_actual_minutes?: number;
}

const COLORS = ['#3B82F6', '#F59E0B', '#06B6D4', '#EF4444'];

export default function Analytics() {
    const [loading, setLoading] = useState(true);

    // Core Metrics
    const [totalSpent, setTotalSpent] = useState(0);
    const [burnRate, setBurnRate] = useState(0); // Hours per day
    const [habitConsistency, setHabitConsistency] = useState(0); // Avg streak
    const [revenueAlignment, setRevenueAlignment] = useState(0); // % of hours on $10k goals

    // Charts Data
    const [pillarDist, setPillarDist] = useState<any[]>([]);
    const [weeklyMomentum, setWeeklyMomentum] = useState<any[]>([]);
    const [burnDownData, setBurnDownData] = useState<any[]>([]);

    // North Stars
    const [northStarProgress, setNorthStarProgress] = useState({
        revenue: 0,
        health: 0,
        english: 0
    });

    const QUARTER_BUDGET = 576;

    useEffect(() => {
        async function fetchData() {
            try {
                // Fetch Data
                const [logsSnap, projectsSnap, habitsSnap] = await Promise.all([
                    getDocs(query(collection(db, "work_logs"), where("date", ">=", "2026-01-01"), orderBy("date", "asc"))),
                    getDocs(collection(db, "projects")),
                    getDocs(collection(db, "habits"))
                ]);

                const logs = logsSnap.docs.map(d => d.data() as WorkLog);
                const projects = projectsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Project));
                const habits = habitsSnap.docs.map(d => d.data() as Habit);

                // --- 1. Budget & basic metrics ---
                // Sum project logs
                const projectHours = logs.reduce((acc, log) => acc + (Number(log.hours) || 0), 0);

                // Sum habit hours (min -> hours)
                const habitHours = habits.reduce((acc, h) => acc + (Number(h.total_actual_minutes) || 0), 0) / 60;

                const spent = projectHours + habitHours;
                setTotalSpent(spent);

                // Burn Rate (Mocking "days passed" as roughly 30 for demo, or real calculation)
                setBurnRate(Number((spent / 30).toFixed(1))); // Assuming ~30 days active

                // --- 2. Pillar Distribution ---
                const pillarMap: Record<string, number> = {};
                logs.forEach(log => {
                    const proj = projects.find(p => p.id === log.project_id);
                    const pillar = proj?.pillar_id || "Uncategorized";
                    pillarMap[pillar] = (pillarMap[pillar] || 0) + Number(log.hours);
                });
                setPillarDist(Object.keys(pillarMap).map(k => ({ name: k, value: pillarMap[k] })));

                // --- 3. Weekly Momentum (Last 7 Days) ---
                const momentumMap: Record<string, number> = {};
                const today = new Date();
                for (let i = 6; i >= 0; i--) {
                    const d = new Date();
                    d.setDate(today.getDate() - i);
                    const dateStr = d.toISOString().split('T')[0];
                    momentumMap[dateStr] = 0;
                }
                logs.forEach(log => {
                    if (momentumMap[log.date] !== undefined) {
                        momentumMap[log.date] += Number(log.hours);
                    }
                });
                setWeeklyMomentum(Object.keys(momentumMap).map(date => ({
                    day: new Date(date).toLocaleDateString("en-US", { weekday: 'short' }),
                    hours: momentumMap[date]
                })));

                // --- 4. Burn-Down Chart (Ideal vs Actual) ---
                const burnData = [];
                let runningSpent = 0;
                for (let w = 1; w <= 12; w++) {
                    const ideal = 576 - (48 * w); // 48hrs/week ideal
                    runningSpent += (spent / 12); // Average spread
                    burnData.push({
                        week: `W${w}`,
                        Ideal: ideal,
                        Actual: Math.max(0, 576 - runningSpent)
                    });
                }
                setBurnDownData(burnData);

                // --- 5. North Star Logic ---
                let revHours = 0;
                let healthHabits = 0;
                let engHours = 0;

                logs.forEach(log => {
                    const proj = projects.find(p => p.id === log.project_id);
                    const text = (proj?.name || "").toLowerCase();
                    if (text.match(/money|client|business|10k/)) revHours += Number(log.hours);
                    if (text.match(/english|read|book/)) engHours += Number(log.hours);
                });

                habits.forEach(h => {
                    healthHabits += h.current_streak;
                });

                setRevenueAlignment(Math.round((revHours / (spent || 1)) * 100));
                setHabitConsistency(Math.round(habits.reduce((acc, h) => acc + h.current_streak, 0) / (habits.length || 1)));

                setNorthStarProgress({
                    revenue: Math.min(100, (revHours / 100) * 100),
                    health: Math.min(100, (healthHabits / 30) * 100),
                    english: Math.min(100, (engHours / 50) * 100)
                });

                setLoading(false);

            } catch (error) {
                console.error("Analytics Error:", error);
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    if (loading) return <div className="p-20 text-center"><div className="animate-spin w-8 h-8 border-2 border-blue-500 rounded-full mx-auto"></div></div>;

    // Logic Fixes (Strict per User Request)
    const weeklySpent = weeklyMomentum.reduce((acc, d) => acc + d.hours, 0);
    const WEEKLY_TARGET = 48;

    const remaining = Math.max(0, QUARTER_BUDGET - totalSpent);
    // Percentage spent (capped at 100%)
    const spentPct = Math.min(1, totalSpent / QUARTER_BUDGET);

    // Gauge Visualization:
    // If we want to show "Spent" (filling up), full bar = 100% spent.
    // User asked "percentage... calculated as (TotalSpentHours / 576)".
    // Let's make the gauge 'Fill Up' as we spend. 
    // Empty (0 spent) -> offset 251.2
    // Full (576 spent) -> offset 0
    const dashOffset = 251.2 * (1 - spentPct);

    let gaugeColor = "#3b82f6"; // Blue
    if (remaining < 48) gaugeColor = "#f59e0b"; // Orange (1 week left)
    if (remaining < 8) gaugeColor = "#ef4444"; // Red (1 day left)

    return (
        <div className="space-y-8 pb-12">
            {/* HER0: QUARTERLY BURN RATE BUDGET GAUGE */}
            <section className="bg-surface/50 border border-white/5 rounded-3xl p-8 relative overflow-hidden">
                <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                    <div className="flex-1 space-y-4">
                        <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                            <span className={`w-3 h-3 rounded-full shadow-[0_0_10px_currentColor]`} style={{ color: gaugeColor, backgroundColor: gaugeColor }}></span>
                            Q1 Budget Tracker
                        </h2>
                        <div className="space-y-2">
                            <p className="text-slate-400 max-w-lg">
                                You have <span className="font-bold text-white">{remaining.toFixed(1)} hours</span> remaining of your 576-hour deep work budget for Q1 2026.
                            </p>
                            <div className="flex items-center gap-3 text-sm font-mono bg-black/20 w-fit px-3 py-1.5 rounded-lg border border-white/5">
                                <span className="text-slate-400">Current Week:</span>
                                <span className="text-white font-bold">{weeklySpent.toFixed(1)}h</span>
                                <span className="text-slate-600">/</span>
                                <span className="text-blue-400">{WEEKLY_TARGET}h Target</span>
                            </div>
                        </div>

                        {remaining < 48 && (
                            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg w-fit ${remaining < 8 ? 'text-red-400 bg-red-500/10' : 'text-amber-500 bg-amber-500/10'}`}>
                                <AlertTriangle size={18} />
                                <span className="text-sm font-bold">
                                    {remaining < 8 ? "Critical: Budget almost depleted!" : "Warning: Low budget remaining."}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* The Gauge */}
                    <div className="relative w-64 h-32 flex items-end justify-center">
                        <svg className="w-full h-full" viewBox="0 0 200 100">
                            <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#1e293b" strokeWidth="20" strokeLinecap="round" />
                            <motion.path
                                d="M 20 100 A 80 80 0 0 1 180 100"
                                fill="none"
                                stroke={gaugeColor}
                                strokeWidth="20"
                                strokeLinecap="round"
                                strokeDasharray="251.2"
                                strokeDashoffset={dashOffset}
                                initial={{ strokeDashoffset: 251.2 }}
                                animate={{ strokeDashoffset: dashOffset }}
                                transition={{ duration: 1.5, ease: "easeOut" }}
                            />
                        </svg>
                        <div className="absolute bottom-0 text-center pb-2">
                            <div className="text-4xl font-bold text-white">{Math.round(spentPct * 100)}%</div>
                            <div className="text-xs text-slate-500 uppercase tracking-widest">Used</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* METRICS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard icon={<Activity className="text-blue-400" />} label="Hours Consumed" value={`${totalSpent.toFixed(1)}h`} sub={`of ${QUARTER_BUDGET}h Budget`} />
                <MetricCard icon={<Zap className="text-amber-400" />} label="Focus Efficiency" value={`${burnRate}h`} sub="Daily Avg. Burn" />
                <MetricCard icon={<TrendingUp className="text-green-400" />} label="Habit Consistency" value={`${habitConsistency}d`} sub="Avg. Streak" />
                <MetricCard icon={<DollarSign className="text-cyan-400" />} label="Revenue Focus" value={`${revenueAlignment}%`} sub="Time on $10k Goal" />
            </div>

            {/* CHARTS ROW */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* 1. Momentum (Bar) */}
                <div className="bg-surface/50 border border-white/5 p-6 rounded-3xl">
                    <h3 className="text-lg font-bold text-white mb-6">Weekly Momentum</h3>
                    <div className="w-full h-[300px] min-h-[300px]">
                        {weeklyMomentum.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={weeklyMomentum}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
                                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                                        itemStyle={{ color: '#fff' }}
                                        cursor={{ fill: '#3b82f6', opacity: 0.1 }}
                                    />
                                    <Bar dataKey="hours" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full text-slate-500">No data available</div>
                        )}
                    </div>
                </div>

                {/* 2. Pillar Distribution (Donut) */}
                <div className="bg-surface/50 border border-white/5 p-6 rounded-3xl">
                    <h3 className="text-lg font-bold text-white mb-6">Pillar Distribution</h3>
                    <div className="w-full h-[300px] min-h-[300px] flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={pillarDist}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {pillarDist.map((_entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* BURNDOWN AREA */}
            <div className="bg-surface/50 border border-white/5 p-6 rounded-3xl">
                <h3 className="text-lg font-bold text-white mb-6">Quarterly Burn-Down</h3>
                <div className="h-72" style={{ width: '100%', height: '300px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={burnDownData}>
                            <defs>
                                <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                            <XAxis dataKey="week" stroke="#64748b" tick={{ fontSize: 12 }} />
                            <YAxis stroke="#64748b" tick={{ fontSize: 12 }} />
                            <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b' }} />
                            <Area type="monotone" dataKey="Actual" stroke="#3b82f6" fillOpacity={1} fill="url(#colorActual)" strokeWidth={3} />
                            <Area type="monotone" dataKey="Ideal" stroke="#64748b" strokeDasharray="5 5" fill="none" strokeWidth={2} opacity={0.5} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* NORTH STAR RINGS (Big Three) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <NorthStarCard name="$10K Revenue" progress={northStarProgress.revenue} color="text-amber-400" icon={<DollarSign />} />
                <NorthStarCard name="Iron Health" progress={northStarProgress.health} color="text-red-400" icon={<Heart />} />
                <NorthStarCard name="Fluent English" progress={northStarProgress.english} color="text-cyan-400" icon={<BookOpen />} />
            </div>

        </div>
    );
}

function MetricCard({ icon, label, value, sub }: any) {
    return (
        <div className="bg-surface/50 border border-white/5 p-6 rounded-2xl flex flex-col gap-1 hover:border-white/10 transition-colors">
            <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-slate-800 rounded-lg">{icon}</div>
                <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">{label}</span>
            </div>
            <div className="text-2xl font-bold text-white">{value}</div>
            <div className="text-xs text-slate-500">{sub}</div>
        </div>
    );
}

function NorthStarCard({ name, progress, color, icon }: any) {
    return (
        <div className="bg-surface/50 border border-white/5 p-6 rounded-2xl flex items-center justify-between group hover:border-white/10 transition-all">
            <div>
                <div className={`p-2 rounded-lg bg-white/5 w-fit mb-3 ${color} group-hover:scale-110 transition-transform`}>{icon}</div>
                <h4 className="font-bold text-white text-lg">{name}</h4>
                <p className="text-xs text-slate-400 font-mono mt-1">
                    {progress}% to Quarterly Goal
                </p>
            </div>
            <div className="relative w-16 h-16">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    <path className="text-slate-800" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                    <path className={color} strokeDasharray={`${progress}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
            </div>
        </div>
    );
}
