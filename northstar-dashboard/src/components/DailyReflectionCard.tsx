import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Save, Brain, Zap, Heart, CloudLightning } from 'lucide-react';
import { getAuth } from 'firebase/auth'; // Client SDK
import type { DailyJournal } from '../types/journal';

// Using a clean, non-intrusive card design
export const DailyReflectionCard: React.FC = () => {
    const [mood, setMood] = useState<number>(3);
    const [mindset, setMindset] = useState('');
    const [brainDump, setBrainDump] = useState('');
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [saved, setSaved] = useState(false);

    // Auth for userId
    const auth = getAuth();
    const userId = auth.currentUser?.uid;

    const MOODS = ['😭', '😕', '😐', '🙂', '🤩'];

    // Load today's entry on mount
    useEffect(() => {
        if (!userId) return;

        const loadToday = async () => {
            try {
                // Fetch from our API
                const res = await fetch(`/api/journal?action=today&userId=${userId}`);
                const data = await res.json();

                if (data.entry) {
                    const e = data.entry as DailyJournal;
                    setMood(e.mood_rating || 3);
                    setMindset(e.mindset_shift || '');
                    setBrainDump(e.brain_dump || '');
                    setSelectedTags(e.tags || []);
                }
            } catch (err) {
                console.error("Failed to load journal", err);
            }
        };

        loadToday();
    }, [userId]);

    const handleSave = async () => {
        if (!userId) return;
        setLoading(true);
        setSaved(false);

        try {
            const dateStr = new Date().toISOString().split('T')[0];

            const payload = {
                userId,
                date: dateStr,
                mood_rating: mood,
                mindset_shift: mindset,
                brain_dump: brainDump,
                tags: selectedTags,
                associated_work_minutes: 0 // Ideally fetch this from time logs state if available
            };

            await fetch('/api/journal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (err) {
            console.error("Failed to save journal", err);
        } finally {
            setLoading(false);
        }
    };

    const toggleTag = (tag: string) => {
        if (selectedTags.includes(tag)) {
            setSelectedTags(selectedTags.filter(t => t !== tag));
        } else {
            setSelectedTags([...selectedTags, tag]);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm relative overflow-hidden"
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2 text-cyan-400">
                    <Brain size={20} />
                    <h2 className="text-lg font-bold tracking-wide">DAILY REFLECTION</h2>
                </div>
                {saved && (
                    <span className="text-xs text-green-400 font-bold uppercase tracking-wider animate-pulse">
                        Saved
                    </span>
                )}
            </div>

            {/* Grid Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Left Col: Quick Metrics */}
                <div className="space-y-6">
                    {/* Mood Slider */}
                    <div>
                        <label className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-3 block">Current Mood</label>
                        <div className="flex justify-between bg-slate-800/50 p-3 rounded-xl">
                            {MOODS.map((emoji, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setMood(idx + 1)}
                                    className={`text-2xl hover:scale-125 transition-transform ${mood === idx + 1 ? 'scale-125 drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]' : 'opacity-40 grayscale'}`}
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Plot Twist */}
                    <div>
                        <label className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-2 block flex items-center gap-1">
                            <Zap size={12} className="text-yellow-500" /> Mindset Shift (The Plot Twist)
                        </label>
                        <input
                            type="text"
                            value={mindset}
                            onChange={(e) => setMindset(e.target.value)}
                            placeholder="e.g. I chose to stay calm perfectly."
                            className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/50 transition-colors placeholder:text-slate-600"
                        />
                    </div>

                    {/* Tags */}
                    <div>
                        <label className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-2 block">Context</label>
                        <div className="flex flex-wrap gap-2">
                            {[
                                { id: 'period_start', label: 'Period Start', icon: <Heart size={10} /> },
                                { id: 'period_heavy', label: 'Period Heavy', icon: <Heart size={10} /> },
                                { id: 'sick', label: 'Sick / Low Energy', icon: <CloudLightning size={10} /> },
                                { id: 'burnout_warning', label: 'Burnout Warning', icon: <Zap size={10} /> },
                                { id: 'high_energy', label: 'High Energy', icon: <Zap size={10} /> },
                            ].map(tag => (
                                <button
                                    key={tag.id}
                                    onClick={() => toggleTag(tag.id)}
                                    className={`
                                        flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                                        ${selectedTags.includes(tag.id)
                                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                            : 'bg-slate-800 text-slate-500 border border-transparent hover:bg-slate-700'}
                                    `}
                                >
                                    {tag.icon} {tag.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Col: Brain Dump */}
                <div className="flex flex-col h-full">
                    <label className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-2 flex items-center gap-1">
                        Brain Dump (فضفضة)
                    </label>
                    <textarea
                        value={brainDump}
                        onChange={(e) => setBrainDump(e.target.value)}
                        placeholder="Clear your mind..."
                        className="flex-1 w-full bg-slate-800/30 border border-slate-700 rounded-xl p-4 text-sm text-slate-300 focus:outline-none focus:border-cyan-500/30 transition-colors resize-none placeholder:text-slate-700"
                    />
                    <div className="mt-4 flex justify-end">
                        <button
                            onClick={handleSave}
                            disabled={loading}
                            className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-2 rounded-xl font-bold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Save size={16} />
                            {loading ? 'Saving...' : 'Log Day'}
                        </button>
                    </div>
                </div>

            </div>
        </motion.div>
    );
};
