import { motion, AnimatePresence } from 'framer-motion';
import { Save, Sparkles, Loader2, Check, Play, BookOpen, ExternalLink, Dumbbell, Moon, Zap, RotateCw } from 'lucide-react';
import { useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { fetchDailyWisdom } from '../services/wisdomService';
import type { WisdomItem } from '../services/wisdomService';

// Typewriter Component
const Typewriter = ({ text }: { text: string }) => {
    const [displayedText, setDisplayedText] = useState("");

    useEffect(() => {
        setDisplayedText(""); // Reset
        let index = 0;
        const interval = setInterval(() => {
            setDisplayedText((prev) => prev + text.charAt(index));
            index++;
            if (index === text.length) clearInterval(interval);
        }, 30); // Speed of typing
        return () => clearInterval(interval);
    }, [text]);

    return <span>{displayedText}</span>;
}

export default function DailyPath() {
    const [todayPlan, setTodayPlan] = useState<string | null>(null);
    const [tomorrowPlan, setTomorrowPlan] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Daily Wisdom State
    const [wisdom, setWisdom] = useState<WisdomItem | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Date Utilities
    const getDates = () => {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Format: YYYY-MM-DD
        const formatDate = (date: Date) => date.toLocaleDateString('en-CA');

        return {
            todayStr: formatDate(today),
            tomorrowStr: formatDate(tomorrow),
        };
    };

    const { todayStr, tomorrowStr } = getDates();

    // Load Data
    useEffect(() => {
        const fetchPlans = async () => {
            try {
                setLoading(true);
                // 1. Fetch Today's Focus
                const todayDoc = await getDoc(doc(db, "daily_plans", todayStr));
                if (todayDoc.exists()) {
                    setTodayPlan(todayDoc.data().plan_text);
                }

                // 2. Fetch Tomorrow's Plan (for editing)
                const tomorrowDoc = await getDoc(doc(db, "daily_plans", tomorrowStr));
                if (tomorrowDoc.exists()) {
                    setTomorrowPlan(tomorrowDoc.data().plan_text);
                }

                // 3. Live Wisdom (Initial Load)
                if (!wisdom) {
                    initWisdom();
                }

            } catch (error: any) {
                console.error("Error loading plans:", error);
                setErrorMsg(`Load Error: ${error.message || "Unknown error"}`);
            } finally {
                setLoading(false);
            }
        };
        fetchPlans();
    }, [todayStr, tomorrowStr]);

    const initWisdom = async () => {
        try {
            // Rotate goals based on day of week or random
            const goals = ["Building a $10M Business", "Biohacking & Health Optimization", "Mastering English Fluency"];
            const goal = goals[Math.floor(Math.random() * goals.length)];
            const item = await fetchDailyWisdom(goal);
            setWisdom(item);
        } catch (e) {
            console.error("Wisdom init failed", e);
        }
    }

    // Handle Refresh Wisdom
    const handleRefreshWisdom = async () => {
        setIsRefreshing(true);
        const goals = ["High Performance Habits", "AI Business Strategy", "Financial Freedom"]; // Alternate mix
        const goal = goals[Math.floor(Math.random() * goals.length)];

        const newItem = await fetchDailyWisdom(goal);
        setWisdom(newItem);
        setIsRefreshing(false);
    };

    // Save Function
    const handleSave = async () => {
        setIsSaving(true);
        try {
            await setDoc(doc(db, "daily_plans", tomorrowStr), {
                plan_text: tomorrowPlan,
                updated_at: serverTimestamp()
            });

            // Success Feedback
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2000);
        } catch (error: any) {
            console.error("Error saving plan:", error);
            setErrorMsg(`Save Error: ${error.message || "Check console"}`);
        } finally {
            setIsSaving(false);
        }
    };

    // Helper for Category Colors
    const getCategoryColor = (cat: string) => {
        switch (cat) {
            case "Financial Mindset": return "text-amber-400 border-amber-500/30 bg-amber-500/10";
            case "Focus & Clarity": return "text-cyan-400 border-cyan-500/30 bg-cyan-500/10";
            default: return "text-purple-400 border-purple-500/30 bg-purple-500/10";
        }
    };

    const getTagIcon = (tag: string) => {
        switch (tag) {
            case "Perfect for Gym": return <Dumbbell size={12} />;
            case "Evening Deep Dive": return <Moon size={12} />;
            default: return <Zap size={12} />;
        }
    };

    return (
        <div className="max-w-5xl mx-auto pl-4">
            <header className="mb-12 relative">
                <div className="absolute -left-[29px] top-2 w-3 h-3 bg-primary rounded-full shadow-glow-intense z-10" />
                <h1 className="text-4xl font-bold text-white tracking-tight mb-2">Daily Path</h1>
                <p className="text-slate-400">Align your actions with your North Star.</p>
                {errorMsg && (
                    <div className="mt-2 text-red-400 text-sm bg-red-900/20 border border-red-500/20 p-2 rounded inline-block">
                        {errorMsg}
                    </div>
                )}
            </header>

            <div className="relative border-l border-blue-900/30 space-y-12 pb-20">

                {/* Timeline Item 0: Daily Wisdom */}
                <div className="relative pl-10">
                    <div className="absolute -left-[5px] top-8 w-2.5 h-2.5 bg-indigo-500 rounded-full border border-indigo-900 z-10" />

                    <motion.div
                        layout
                        className="bg-slate-900/20 backdrop-blur-sm border border-indigo-500/20 rounded-3xl p-1 overflow-hidden shadow-glass relative"
                    >
                        <div className="bg-[#080c1e] p-6 rounded-[20px] relative min-h-[220px]">
                            <AnimatePresence mode="wait">
                                {wisdom && (
                                    <motion.div
                                        key={wisdom.id}
                                        initial={{ opacity: 0, scale: 0.98 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, filter: "blur(4px)" }}
                                        transition={{ duration: 0.3 }}
                                        className="relative z-10"
                                    >
                                        {/* Header with Refresh */}
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded border ${getCategoryColor(wisdom.category)}`}>
                                                    {wisdom.category}
                                                </span>
                                                <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-slate-500 bg-white/5 px-2 py-1 rounded">
                                                    {getTagIcon(wisdom.tag)} {wisdom.tag}
                                                </span>
                                            </div>

                                            <motion.button
                                                onClick={handleRefreshWisdom}
                                                disabled={isRefreshing}
                                                animate={{ rotate: isRefreshing ? 360 : 0 }}
                                                transition={{ duration: 0.5, ease: "easeInOut" }}
                                                className="text-slate-500 hover:text-white p-1 rounded-full hover:bg-white/5 transition-colors"
                                                title="Not in the mood? Try another."
                                            >
                                                <RotateCw size={16} />
                                            </motion.button>
                                        </div>

                                        {/* Content */}
                                        <div className="flex items-start justify-between">
                                            <div className="flex flex-col gap-4 max-w-2xl">
                                                <div>
                                                    <h3 className="text-xl font-bold text-white mb-1">{wisdom.title}</h3>
                                                    <p className="text-sm text-indigo-300 font-medium">{wisdom.author} • {wisdom.type} • {wisdom.duration}</p>
                                                </div>

                                                <div className="min-h-[40px] text-slate-400 text-sm italic border-l-2 border-indigo-500/30 pl-4 py-1">
                                                    "<Typewriter text={wisdom.description} />"
                                                </div>
                                            </div>

                                            <a
                                                href={wisdom.link_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="group flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-glow hover:shadow-indigo-500/25 mt-4"
                                            >
                                                {wisdom.type === 'TedTalk' || wisdom.type === 'Podcast' ? <Play size={18} fill="currentColor" /> : <BookOpen size={18} />}
                                                <span>Explore Now</span>
                                                <ExternalLink size={14} className="opacity-50 group-hover:opacity-100 transition-opacity" />
                                            </a>
                                        </div>

                                        {/* Dynamic Glow based on Category */}
                                        <div className={`absolute -top-10 -right-10 w-40 h-40 blur-[90px] rounded-full opacity-20 pointer-events-none transition-colors duration-500 ${wisdom.category === 'Financial Mindset' ? 'bg-amber-500' : 'bg-cyan-500'}`} />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                </div>

                {/* Timeline Item 1: Today's Focus */}
                <div className="relative pl-10">
                    <div className="absolute -left-[5px] top-6 w-2.5 h-2.5 bg-blue-900 rounded-full border border-blue-500 z-10" />

                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-surface backdrop-blur-xl border border-white/5 rounded-3xl p-8 shadow-glass relative group"
                    >
                        <div className="absolute top-0 right-0 p-6 opacity-20 text-blue-500 group-hover:opacity-40 transition-opacity">
                            <Sparkles size={80} strokeWidth={1} />
                        </div>

                        <div className="flex items-center gap-3 mb-6">
                            <span className="text-primary font-mono text-xs uppercase tracking-widest bg-blue-500/10 px-2 py-1 rounded">09:00 AM</span>
                            <h3 className="text-lg font-semibold text-white">Today's Focus <span className="text-slate-500 text-xs ml-2">({todayStr})</span></h3>
                        </div>

                        <div className="min-h-[100px] flex items-start justify-start border border-dashed border-blue-800/30 rounded-xl bg-blue-950/20 p-6">
                            {loading ? (
                                <div className="flex items-center gap-2 text-slate-500 animate-pulse">
                                    <Loader2 className="animate-spin" size={16} /> Loading...
                                </div>
                            ) : todayPlan ? (
                                <div className="prose prose-invert prose-sm max-w-none text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">
                                    {todayPlan}
                                </div>
                            ) : (
                                <p className="text-slate-500 text-sm">No plan found for today. Plan ahead for tomorrow!</p>
                            )}
                        </div>
                    </motion.div>
                </div>

                {/* Timeline Item 2: Planning Editor */}
                <div className="relative pl-10">
                    <div className="absolute -left-[5px] top-6 w-2.5 h-2.5 bg-primary rounded-full shadow-glow z-10 animate-pulse" />

                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                        className="bg-slate-900/40 backdrop-blur-md border border-blue-500/10 rounded-3xl p-1 shadow-glass"
                    >
                        <div className="bg-[#0b1021] rounded-[20px] p-6 relative overflow-hidden">
                            {/* Editor Header */}
                            <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4">
                                <div className="flex items-center gap-3">
                                    <span className="w-2 h-2 rounded-full bg-green-500 shadow-glow"></span>
                                    <h3 className="text-lg font-semibold text-white">Plan for Tomorrow</h3>
                                </div>
                                <div className="flex gap-2 items-center">
                                    <span className="text-xs text-slate-500 font-mono mr-2">{tomorrowStr}</span>
                                    <div className="w-3 h-3 rounded-full bg-red-500/20"></div>
                                    <div className="w-3 h-3 rounded-full bg-yellow-500/20"></div>
                                    <div className="w-3 h-3 rounded-full bg-green-500/20"></div>
                                </div>
                            </div>

                            <textarea
                                className="w-full bg-transparent text-gray-300 resize-none outline-none placeholder:text-slate-600 font-mono text-sm leading-7 min-h-[200px]"
                                placeholder={`# Priority\n- [ ] Deep Work Session (2h)\n- [ ] Review Analytics\n\n# Notes\n...`}
                                value={tomorrowPlan}
                                onChange={(e) => setTomorrowPlan(e.target.value)}
                            />

                            <div className="pt-4 flex justify-between items-center border-t border-white/5 mt-4">
                                <p className="text-xs text-slate-500">Markdown enabled</p>

                                <motion.button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    className={`
                                font-bold py-2 px-6 rounded-lg flex items-center gap-2 shadow-glow transition-all
                                ${saveSuccess
                                            ? "bg-green-500 text-white"
                                            : "bg-primary hover:bg-blue-400 text-slate-950"
                                        }
                            `}
                                >
                                    <AnimatePresence mode="wait">
                                        {isSaving ? (
                                            <motion.div
                                                key="saving"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                className="flex items-center gap-2"
                                            >
                                                <Loader2 size={16} className="animate-spin" /> Saving
                                            </motion.div>
                                        ) : saveSuccess ? (
                                            <motion.div
                                                key="success"
                                                initial={{ opacity: 0, scale: 0.5 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0 }}
                                                className="flex items-center gap-2"
                                            >
                                                <Check size={16} /> Saved
                                            </motion.div>
                                        ) : (
                                            <motion.div
                                                key="idle"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                className="flex items-center gap-2"
                                            >
                                                <Save size={16} /> Save Plan
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.button>
                            </div>
                        </div>
                    </motion.div>
                </div>

            </div>
        </div>
    );
}
