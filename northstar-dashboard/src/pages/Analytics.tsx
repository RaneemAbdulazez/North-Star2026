import { useEffect, useState } from 'react';
import { db } from '../config/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
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

    const QUARTER_BUDGET = 240;
    // const DAYS_IN_QUARTER = 90;
    // const daysPassed = Math.max(1, Math.floor((new Date().getTime() - new Date("2026-01-01").getTime()) / (1000 * 3600 * 24)));

    useEffect(() => {
        // ... (existing useEffect, no changes needed inside) ...
        // ... (skipping unchanged lines) ...
        // Calculate Weekly Spent from Momentum
        const weeklySpent = weeklyMomentum.reduce((acc, d) => acc + d.hours, 0);
        const WEEKLY_TARGET = 20; // 240h / 12 weeks

        const remaining = Math.max(0, QUARTER_BUDGET - totalSpent);
        const progressPct = (remaining / QUARTER_BUDGET); // 1.0 to 0.0
        const dashOffset = 251.2 * (1 - progressPct); // 0 (Full) to 251.2 (Empty)

        // Color Logic
        let gaugeColor = "#3b82f6"; // Blue
        if (remaining < 20) gaugeColor = "#f59e0b"; // Orange
        if (remaining < 5) gaugeColor = "#ef4444"; // Red

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
                                    You have <span className="font-bold text-white">{remaining.toFixed(1)} hours</span> remaining of your 240-hour deep work budget.
                                </p>
                                <div className="flex items-center gap-3 text-sm font-mono bg-black/20 w-fit px-3 py-1.5 rounded-lg border border-white/5">
                                    <span className="text-slate-400">Current Week:</span>
                                    <span className="text-white font-bold">{weeklySpent.toFixed(1)}h</span>
                                    <span className="text-slate-600">/</span>
                                    <span className="text-blue-400">{WEEKLY_TARGET}h Target</span>
                                </div>
                            </div>

                            {remaining < 20 && (
                                <div className={`flex items-center gap-2 px-4 py-2 rounded-lg w-fit ${remaining < 5 ? 'text-red-400 bg-red-500/10' : 'text-amber-500 bg-amber-500/10'}`}>
                                    <AlertTriangle size={18} />
                                    <span className="text-sm font-bold">
                                        {remaining < 5 ? "Critical: Budget almost depleted!" : "Warning: Low budget remaining."}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* The Gauge */}
                        <div className="relative w-64 h-32 flex items-end justify-center">
                            {/* Simple SVG Half Circle Gauge */}
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
                                <div className="text-4xl font-bold text-white">{Math.round(progressPct * 100)}%</div>
                                <div className="text-xs text-slate-500 uppercase tracking-widest">Available</div>
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
                    <div className="h-72" style={{ minHeight: '300px' }}>
                        <ResponsiveContainer width="100%" height={300}>
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
