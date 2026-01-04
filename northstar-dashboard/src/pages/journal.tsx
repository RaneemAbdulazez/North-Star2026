import { useEffect, useState, useMemo } from 'react';
import { getAuth, type User } from 'firebase/auth';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Activity, Save, Brain, Zap, Heart, CloudLightning,
    BookOpen, Sparkles, AlertCircle, Search, X, Clock, Loader2
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { db } from '../config/firebase';
import { doc, setDoc, getDoc, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import type { DailyJournal } from '../types/journal';

export default function Journal() {
    // Helper for Local Date (YYYY-MM-DD)
    const getLocalISODate = () => new Date().toLocaleDateString('en-CA');

    // ACTIVE TAB STATE
    const [activeTab, setActiveTab] = useState<'write' | 'archive'>('write');

    // LOGIC STATE (Write Mode)
    const [user, setUser] = useState<User | null>(null);
    const [mood, setMood] = useState<number>(3);
    const [mindset, setMindset] = useState('');
    const [brainDump, setBrainDump] = useState('');
    const [selectedTags, setSelectedTags] = useState<string[]>([]);

    // UI STATE
    const [history, setHistory] = useState<DailyJournal[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchingToday, setFetchingToday] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savedSuccess, setSavedSuccess] = useState(false);

    // ARCHIVE STATE
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedEntry, setSelectedEntry] = useState<DailyJournal | null>(null);
    const [filterMood, setFilterMood] = useState<number | null>(null);

    const auth = getAuth();

    const MOODS = ['😭', '😕', '😐', '🙂', '🤩'];
    const TAG_OPTIONS = [
        { id: 'period_start', label: 'Period Start', icon: <Heart size={14} />, color: 'text-pink-400 border-pink-500/30 bg-pink-500/10' },
        { id: 'period_heavy', label: 'Period Heavy', icon: <Heart size={14} />, color: 'text-red-400 border-red-500/30 bg-red-500/10' },
        { id: 'sick', label: 'Sick / Low Energy', icon: <CloudLightning size={14} />, color: 'text-amber-400 border-amber-500/30 bg-amber-500/10' },
        { id: 'burnout_warning', label: 'Burnout Warning', icon: <AlertCircle size={14} />, color: 'text-orange-400 border-orange-500/30 bg-orange-500/10' },
        { id: 'high_energy', label: 'High Energy', icon: <Zap size={14} />, color: 'text-yellow-300 border-yellow-500/30 bg-yellow-500/10' },
        { id: 'focus_flow', label: 'Deep Flow', icon: <Sparkles size={14} />, color: 'text-cyan-300 border-cyan-500/30 bg-cyan-500/10' },
    ];

    // Load Data
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
            // PM DIRECTIVE: Mock User Fallback
            const activeUser = currentUser || { uid: "dev_prototype_user_123" } as User;
            setUser(activeUser);

            if (activeUser) {
                setFetchingToday(true);
                try {
                    const todayStr = getLocalISODate();
                    const docId = `${activeUser.uid}_${todayStr}`;
                    console.log("Fetching journal for:", docId);

                    // 1. Fetch Today
                    const docRef = doc(db, 'daily_journals', docId);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        const e = docSnap.data() as DailyJournal;
                        setMood(e.mood_rating || 3);
                        setMindset(e.mindset_shift || '');
                        setBrainDump(e.brain_dump || '');
                        setSelectedTags(e.tags || []);
                        console.log("Loaded from Firestore Success");
                    } else {
                        // Fallback: Check LocalStorage (if Firestore save failed previously)
                        const localData = localStorage.getItem(`journal_${todayStr}`);
                        if (localData) {
                            console.log("Loaded from LocalStorage Success");
                            const ld = JSON.parse(localData);
                            setMood(ld.mood || 3);
                            setMindset(ld.mindset || '');
                            setBrainDump(ld.brainDump || '');
                            setSelectedTags(ld.selectedTags || []);
                        } else {
                            // Clear fields if really no entry exists
                            setMood(3);
                            setMindset('');
                            setBrainDump('');
                            setSelectedTags([]);
                        }
                    }

                    // 2. Fetch History (Last 100 days for Archive)
                    const q = query(
                        collection(db, 'daily_journals'),
                        where('userId', '==', activeUser.uid),
                        orderBy('date', 'desc'),
                        limit(100)
                    );
                    const querySnapshot = await getDocs(q);
                    const historyData = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() })) as DailyJournal[];
                    setHistory(historyData);
                } catch (error) {
                    console.error("Failed to load journal data", error);
                } finally {
                    setLoading(false);
                    setFetchingToday(false);
                }
            }
        });

        return () => unsubscribe();
    }, [auth]);

    const handleSave = async () => {
        if (!user) {
            alert("No user identified (even mock).");
            return;
        }
        setSaving(true);
        setSavedSuccess(false);

        try {
            const dateStr = getLocalISODate();
            const docId = `${user.uid}_${dateStr}`;

            const payload: any = {
                userId: user.uid,
                date: dateStr,
                mood_rating: mood,
                mindset_shift: mindset,
                brain_dump: brainDump,
                tags: selectedTags,
                associated_work_minutes: 0, // Placeholder
                updated_at: new Date().toISOString()
            };

            // Using Firestore Direct Implementation instead of Fetch API
            await setDoc(doc(db, 'daily_journals', docId), payload, { merge: true });

            // Update local history
            setHistory(prev => {
                const filtered = prev.filter(h => h.date !== dateStr);
                return [{ ...payload, id: docId }, ...filtered].sort((a, b) => b.date.localeCompare(a.date));
            });

            setSavedSuccess(true);
            setTimeout(() => setSavedSuccess(false), 3000);
        } catch (err: any) {
            console.error("Failed to save journal", err);
            // Fallback to LocalStorage if Firestore Permission Denied
            if (err.code === 'permission-denied') {
                console.warn("Firestore permission denied. Saving to LocalStorage.");
                localStorage.setItem(`journal_${getLocalISODate()}`, JSON.stringify({
                    mood, mindset, brainDump, selectedTags
                }));
                setSavedSuccess(true);
                setTimeout(() => setSavedSuccess(false), 3000);
                alert("Saved to Local Storage (Firestore Permission Denied in Dev Mode)");
            } else {
                alert("Failed to save: " + (err.message || "Unknown error"));
            }
        } finally {
            setSaving(false);
        }
    };

    const toggleTag = (tagId: string) => {
        if (selectedTags.includes(tagId)) {
            setSelectedTags(selectedTags.filter(t => t !== tagId));
        } else {
            setSelectedTags([...selectedTags, tagId]);
        }
    };

    // --- INSIGHTS & FILTERING LOGIC ---
    const filteredHistory = useMemo(() => {
        return history.filter(entry => {
            const matchesSearch =
                (entry.brain_dump || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (entry.mindset_shift || '').toLowerCase().includes(searchQuery.toLowerCase());

            const matchesMood = filterMood === null || entry.mood_rating === filterMood;

            return matchesSearch && matchesMood;
        });
    }, [history, searchQuery, filterMood]);

    const insights = useMemo(() => {
        const totalPlotTwists = history.filter(h => h.mindset_shift && h.mindset_shift.trim().length > 0).length;
        const avgMood = history.length > 0
            ? (history.reduce((acc, curr) => acc + (curr.mood_rating || 3), 0) / history.length).toFixed(1)
            : "N/A";
        const totalHours = history.reduce((acc, curr) => acc + (curr.associated_work_minutes || 0), 0) / 60;

        return { totalPlotTwists, avgMood, totalHours: totalHours.toFixed(1) };
    }, [history]);

    // Chart Data Format (Last 30 entries for visual clarity)
    const chartData = [...history].reverse().slice(-30).map(h => ({
        date: h.date.slice(5), // MM-DD
        mood: h.mood_rating
    }));


    if (loading) return <div className="p-12 text-center text-slate-500">Loading Journal...</div>;

    return (
        <div className="max-w-[1200px] mx-auto space-y-8 pb-20 relative">

            {/* Developer Mode Banner */}
            {!auth.currentUser && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 px-4 py-2 rounded-lg text-xs font-mono text-center">
                    ⚠️ PROTOTYPE MODE: Using Mock User & Local Data
                </div>
            )}

            {/* Header & Tabs */}
            <header className="flex flex-col md:flex-row md:items-end justify-between border-b border-white/5 pb-6 gap-4">
                <div>
                    <h1 className="text-4xl font-light tracking-tight text-white flex items-center gap-3">
                        <BookOpen size={32} className="text-cyan-400" />
                        Daily <span className="font-serif italic text-slate-400">Reflection</span>
                    </h1>
                    <p className="text-slate-500 mt-2 font-mono text-xs uppercase tracking-widest pl-1">
                        {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                </div>

                {/* Tabs */}
                <div className="flex bg-slate-900/50 p-1 rounded-xl border border-white/5">
                    <button
                        onClick={() => setActiveTab('write')}
                        className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'write' ? 'bg-cyan-500/20 text-cyan-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        Write
                    </button>
                    <button
                        onClick={() => setActiveTab('archive')}
                        className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'archive' ? 'bg-cyan-500/20 text-cyan-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        Archive & Insights
                    </button>
                </div>
            </header>

            {/* === WRITE MODE === */}
            {activeTab === 'write' && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16">
                    {/* LEFT: CANVAS */}
                    <div className="lg:col-span-8 flex flex-col gap-6">
                        <div className="relative flex-1 min-h-[500px] bg-slate-900/30 rounded-3xl p-8 border border-white/5 hover:border-white/10 transition-colors group">
                            <div className="absolute top-6 left-8 flex items-center gap-2 text-slate-500 group-focus-within:text-cyan-400 transition-colors">
                                <Brain size={18} />
                                <span className="text-xs font-bold uppercase tracking-wider">Brain Dump</span>
                            </div>
                            {fetchingToday ? (
                                <div className="w-full h-full min-h-[450px] flex flex-col items-center justify-center text-slate-500 mt-6">
                                    <Loader2 size={32} className="animate-spin mb-4 text-cyan-500" />
                                    <span className="text-sm font-mono uppercase tracking-widest animate-pulse">Loading reflection...</span>
                                </div>
                            ) : (
                                <textarea
                                    value={brainDump}
                                    onChange={(e) => setBrainDump(e.target.value)}
                                    placeholder="Unload your thoughts here. How are you really feeling? What went well? What needs to change?"
                                    className="w-full h-full min-h-[450px] bg-transparent border-none focus:ring-0 text-lg md:text-xl leading-relaxed text-slate-300 placeholder:text-slate-700 resize-none mt-6 custom-scrollbar font-serif selection:bg-cyan-500/30"
                                    spellCheck={false}
                                />
                            )}
                        </div>
                    </div>

                    {/* RIGHT: METADATA */}
                    <div className="lg:col-span-4 space-y-8">
                        {/* Save Button */}
                        <button onClick={handleSave} disabled={saving} className={`w-full py-4 rounded-xl font-bold text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all ${savedSuccess ? 'bg-green-500 text-white shadow-[0_0_20px_rgba(34,197,94,0.3)]' : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_20px_rgba(8,145,178,0.3)] hover:shadow-cyan-500/40'} disabled:opacity-50`}>
                            {savedSuccess ? <>Saved <span className="text-lg">✓</span></> : <>{saving ? 'Saving...' : 'Log Day'} <Save size={18} /></>}
                        </button>

                        {/* Mood */}
                        <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6">
                            <label className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-4 block">Current Mood</label>
                            <div className="flex justify-between px-2">
                                {MOODS.map((emoji, idx) => (
                                    <button key={idx} onClick={() => setMood(idx + 1)} className={`flex flex-col items-center gap-2 transition-all duration-300 ${mood === idx + 1 ? 'scale-125 -translate-y-1' : 'opacity-40 grayscale hover:opacity-100 hover:grayscale-0'}`}>
                                        <span className="text-3xl drop-shadow-lg">{emoji}</span>
                                        {mood === idx + 1 && <motion.div layoutId="mood-dot" className="w-1.5 h-1.5 bg-cyan-400 rounded-full" />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Mindset */}
                        <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6">
                            <label className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-3 flex items-center gap-2"><Zap size={14} className="text-yellow-400" /> Mindset Shift</label>
                            <input type="text" value={mindset} onChange={(e) => setMindset(e.target.value)} placeholder="The Plot Twist..." className="w-full bg-black/20 border border-slate-700/50 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-yellow-500/50 transition-colors placeholder:text-slate-600" />
                        </div>

                        {/* Tags */}
                        <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6">
                            <label className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-4 block">Context</label>
                            <div className="grid grid-cols-2 gap-2">
                                {TAG_OPTIONS.map(tag => (
                                    <button key={tag.id} onClick={() => toggleTag(tag.id)} className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium transition-all text-left border ${selectedTags.includes(tag.id) ? tag.color : 'bg-black/20 border-transparent text-slate-500 hover:bg-slate-800'}`}>
                                        {tag.icon} {tag.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* BOTTOM SECTION: Trends & Recent Reflections */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-8 border-t border-white/5">

                        {/* LEFT: 30-Day Pulse (8 Cols) */}
                        <div className="lg:col-span-8">
                            <h2 className="text-xl font-light text-white mb-6 flex items-center gap-3"><Activity size={20} className="text-slate-600" /> <span className="opacity-50">Trend</span> Snapshot</h2>
                            <div className="h-[250px] w-full bg-slate-900/30 border border-white/5 rounded-3xl p-4">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData}>
                                        <defs>
                                            <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                                                <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.5} />
                                                <stop offset="100%" stopColor="#3b82f6" stopOpacity={1} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                        <XAxis dataKey="date" stroke="#475569" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} dy={10} />
                                        <YAxis domain={[1, 5]} hide />
                                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }} formatter={(value: any) => [MOODS[value - 1] || value, "Mood"]} cursor={{ stroke: '#334155', strokeWidth: 1 }} />
                                        <Line type="monotone" dataKey="mood" stroke="url(#lineGradient)" strokeWidth={3} dot={{ r: 4, fill: '#0f172a', stroke: '#22d3ee', strokeWidth: 2 }} activeDot={{ r: 6, fill: '#22d3ee' }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* RIGHT: Recent Reflections Library (4 Cols) */}
                        <div className="lg:col-span-4 flex flex-col">
                            <h2 className="text-xl font-light text-white mb-6 flex items-center gap-3"><BookOpen size={20} className="text-slate-600" /> <span className="opacity-50">Recent</span> Reflections</h2>
                            <div className="flex-1 space-y-4">
                                {history.slice(0, 3).map((entry) => (
                                    <motion.div
                                        key={entry.id}
                                        whileHover={{ x: 5 }}
                                        onClick={() => setSelectedEntry(entry)}
                                        className="bg-slate-900/40 border border-white/5 p-4 rounded-xl hover:border-cyan-500/30 transition-all cursor-pointer group flex items-start gap-4"
                                    >
                                        <div className="text-2xl grayscale group-hover:grayscale-0 transition-all">{MOODS[(entry.mood_rating || 3) - 1]}</div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-baseline mb-1">
                                                <span className="text-xs font-mono text-slate-400">{entry.date}</span>
                                            </div>
                                            {entry.mindset_shift ? (
                                                <p className="text-sm text-yellow-100/80 font-serif italic truncate">"{entry.mindset_shift}"</p>
                                            ) : (
                                                <p className="text-sm text-slate-600 truncate">{entry.brain_dump || "No content"}</p>
                                            )}
                                        </div>
                                    </motion.div>
                                ))}
                                {history.length === 0 && (
                                    <div className="text-center text-slate-600 py-8 text-sm italic">
                                        No entries yet. Start writing!
                                    </div>
                                )}
                                {history.length > 0 && (
                                    <button
                                        onClick={() => setActiveTab('archive')}
                                        className="w-full py-3 text-xs uppercase tracking-widest text-slate-500 hover:text-cyan-400 border border-dashed border-slate-800 hover:border-cyan-500/30 rounded-xl transition-all"
                                    >
                                        View Full Archive
                                    </button>
                                )}
                            </div>
                        </div>

                    </div>
                </motion.div>
            )}

            {/* === ARCHIVE MODE === */}
            {activeTab === 'archive' && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">

                    {/* Insights Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-slate-900/50 border border-white/5 p-6 rounded-2xl flex items-center gap-4">
                            <div className="p-3 bg-yellow-500/10 rounded-xl text-yellow-400"><Zap size={24} /></div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Total Plot Twists</p>
                                <p className="text-2xl font-light text-white">{insights.totalPlotTwists}</p>
                            </div>
                        </div>
                        <div className="bg-slate-900/50 border border-white/5 p-6 rounded-2xl flex items-center gap-4">
                            <div className="p-3 bg-cyan-500/10 rounded-xl text-cyan-400"><Activity size={24} /></div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Avg Mood</p>
                                <p className="text-2xl font-light text-white">{insights.avgMood} <span className="text-xs text-slate-500">/ 5</span></p>
                            </div>
                        </div>
                        <div className="bg-slate-900/50 border border-white/5 p-6 rounded-2xl flex items-center gap-4">
                            <div className="p-3 bg-pink-500/10 rounded-xl text-pink-400"><Clock size={24} /></div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Logged Hours</p>
                                <p className="text-2xl font-light text-white">{insights.totalHours} <span className="text-xs text-slate-500">/ 576h</span></p>
                            </div>
                        </div>
                    </div>

                    {/* Search & Filter Bar */}
                    <div className="flex flex-col md:flex-row gap-4 bg-slate-900/30 p-2 rounded-2xl border border-white/5">
                        <div className="relative flex-1">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                            <input
                                type="text"
                                placeholder="Search your reflections..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-slate-950/50 border-none rounded-xl py-3 pl-12 pr-4 text-white placeholder:text-slate-600 focus:ring-1 focus:ring-cyan-500/50"
                            />
                        </div>
                        <div className="flex gap-2 bg-slate-950/50 rounded-xl p-1">
                            {/* Mood Filter Buttons */}
                            <button onClick={() => setFilterMood(null)} className={`px-3 rounded-lg text-xs font-bold transition-all ${filterMood === null ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-white'}`}>ALL</button>
                            {MOODS.map((m, idx) => (
                                <button key={idx} onClick={() => setFilterMood(filterMood === idx + 1 ? null : idx + 1)} className={`px-2 rounded-lg text-lg transition-all ${filterMood === idx + 1 ? 'bg-slate-700 scale-110' : 'opacity-40 hover:opacity-100'}`}>
                                    {m}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Reflection Gallery Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredHistory.map((entry) => (
                            <motion.div
                                key={entry.id}
                                layout
                                onClick={() => setSelectedEntry(entry)}
                                className="bg-slate-900/40 border border-white/5 rounded-2xl p-6 cursor-pointer hover:border-cyan-500/30 hover:bg-slate-900/60 transition-all group"
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-mono text-slate-500">{entry.date}</span>
                                        <span className={`text-[10px] uppercase font-bold tracking-widest mt-1 ${(entry.mood_rating || 3) > 3 ? 'text-green-400' : (entry.mood_rating || 3) < 3 ? 'text-red-400' : 'text-yellow-400'
                                            }`}>
                                            {(entry.mood_rating || 3) > 3 ? 'Positive' : (entry.mood_rating || 3) < 3 ? 'Challenging' : 'Neutral'}
                                        </span>
                                    </div>
                                    <span className="text-4xl grayscale group-hover:grayscale-0 transition-all">{MOODS[(entry.mood_rating || 3) - 1]}</span>
                                </div>

                                {entry.mindset_shift && (
                                    <div className="mb-4">
                                        <div className="flex items-center gap-2 text-yellow-500/80 mb-1">
                                            <Zap size={12} /> <span className="text-[10px] uppercase font-bold">Shift</span>
                                        </div>
                                        <p className="text-white font-serif italic line-clamp-2">"{entry.mindset_shift}"</p>
                                    </div>
                                )}

                                <div className="text-slate-500 text-sm line-clamp-3 mb-4 font-serif leading-relaxed">
                                    {entry.brain_dump || "No written reflection."}
                                </div>

                                {entry.tags && entry.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-2 pt-4 border-t border-white/5">
                                        {entry.tags.slice(0, 3).map(tag => (
                                            <span key={tag} className="text-[9px] uppercase tracking-wider px-2 py-1 rounded bg-slate-800 text-slate-400">
                                                {tag.replace('_', ' ')}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </motion.div>
                        ))}
                    </div>

                    {filteredHistory.length === 0 && (
                        <div className="text-center py-20 text-slate-600">
                            <Search className="mx-auto mb-4 opacity-50" size={48} />
                            <p>No reflections found matching your criteria.</p>
                        </div>
                    )}
                </motion.div>
            )}

            {/* Entry Modal */}
            <AnimatePresence>
                {selectedEntry && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
                        onClick={() => setSelectedEntry(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Modal Header */}
                            <div className="p-6 border-b border-white/5 flex justify-between items-start bg-slate-950/50">
                                <div>
                                    <div className="flex items-center gap-3">
                                        <h2 className="text-2xl text-white font-serif italic">{selectedEntry.date}</h2>
                                        <span className="text-2xl">{MOODS[(selectedEntry.mood_rating || 3) - 1]}</span>
                                    </div>
                                    <div className="flex gap-2 mt-2">
                                        {selectedEntry.tags?.map(t => (
                                            <span key={t} className="text-[10px] uppercase font-bold tracking-widest px-2 py-1 rounded bg-slate-800 text-slate-400">
                                                {t.replace('_', ' ')}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <button onClick={() => setSelectedEntry(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white">
                                    <X size={24} />
                                </button>
                            </div>

                            {/* Modal Content */}
                            <div className="p-8 overflow-y-auto custom-scrollbar space-y-8 flex-1">
                                {selectedEntry.mindset_shift && (
                                    <div className="bg-yellow-500/5 border border-yellow-500/10 p-6 rounded-2xl">
                                        <div className="flex items-center gap-2 text-yellow-500 mb-2">
                                            <Zap size={16} /> <span className="text-xs uppercase font-bold tracking-widest">The Plot Twist</span>
                                        </div>
                                        <p className="text-xl text-yellow-100 font-serif italic">"{selectedEntry.mindset_shift}"</p>
                                    </div>
                                )}

                                <div>
                                    <div className="flex items-center gap-2 text-cyan-500 mb-4">
                                        <Brain size={16} /> <span className="text-xs uppercase font-bold tracking-widest">Brain Dump</span>
                                    </div>
                                    <div className="prose prose-invert prose-lg max-w-none font-serif leading-loose text-slate-300 whitespace-pre-wrap">
                                        {selectedEntry.brain_dump}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
