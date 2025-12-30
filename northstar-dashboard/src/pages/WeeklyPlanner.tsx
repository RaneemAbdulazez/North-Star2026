import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, RefreshCw, CheckCircle2 } from 'lucide-react';
import { initGoogleClient, signInToGoogle, fetchCalendarEvents } from '../services/googleCalendar';

export default function WeeklyPlanner() {
    const [isConnected, setIsConnected] = useState(false);
    const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Mock NorthStar Tasks for now
    const [plannedTasks] = useState([
        { id: '1', title: 'Deep Work: Strategy', day: 'Mon', time: '09:00', duration: 2 },
        { id: '2', title: 'Client Meeting', day: 'Tue', time: '14:00', duration: 1 },
        { id: '3', title: 'Coding Session', day: 'Wed', time: '10:00', duration: 3 },
    ]);

    const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    useEffect(() => {
        // Initialize Google Client on Load
        // Note: Needs explicit script tag in index.html, usually added via hook or manually
        const checkGoogle = setInterval(() => {
            if ((window as any).google) {
                initGoogleClient(() => {
                    setIsConnected(true);
                    loadWeekEvents();
                });
                clearInterval(checkGoogle);
            }
        }, 500);
        return () => clearInterval(checkGoogle);
    }, []);

    const handleSync = () => {
        if (!isConnected) {
            signInToGoogle();
        } else {
            loadWeekEvents();
        }
    };

    const loadWeekEvents = async () => {
        setLoading(true);
        try {
            const start = new Date();
            start.setHours(0, 0, 0, 0); // Start of today (simplified)
            const end = new Date();
            end.setDate(end.getDate() + 7); // Next 7 days

            const data = await fetchCalendarEvents(start.toISOString(), end.toISOString());
            setCalendarEvents(data.items || []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto pb-20">
            <header className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <div className="p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
                            <Calendar size={24} className="text-purple-400" />
                        </div>
                        Weekly Planner
                    </h1>
                    <p className="text-slate-400 mt-2 ml-14">Map your NorthStar goals to your real schedule.</p>
                </div>

                <button
                    onClick={handleSync}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all ${isConnected
                        ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                        : 'bg-white text-slate-900 hover:bg-slate-200'
                        }`}
                >
                    {loading ? <RefreshCw className="animate-spin" size={18} /> : isConnected ? <CheckCircle2 size={18} /> : <img src="https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg" className="w-4 h-4" alt="G" />}
                    {isConnected ? 'Synced' : 'Sync Google Calendar'}
                </button>
            </header>

            <div className="grid grid-cols-7 gap-4">
                {DAYS.map(day => (
                    <div key={day} className="flex flex-col gap-3">
                        <div className="text-center p-3 rounded-xl bg-surface border border-white/5 uppercase text-xs font-bold text-slate-500 tracking-widest">
                            {day}
                        </div>

                        <div className="bg-surface/30 rounded-2xl border border-white/5 min-h-[500px] p-2 space-y-2 relative">
                            {/* Render NorthStar Tasks */}
                            {plannedTasks.filter(t => t.day === day).map(task => (
                                <motion.div
                                    key={task.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="p-3 bg-blue-600 rounded-xl shadow-lg border border-blue-400/20 cursor-move"
                                >
                                    <div className="text-xs font-mono opacity-70 mb-1">{task.time} ({task.duration}h)</div>
                                    <div className="font-bold text-sm text-white">{task.title}</div>
                                </motion.div>
                            ))}

                            {/* Render Calendar Events (if any) - Simplified Mapping */}
                            {calendarEvents.map((evt) => {
                                const evtDate = new Date(evt.start.dateTime || evt.start.date);
                                const dayName = evtDate.toLocaleDateString('en-US', { weekday: 'short' });
                                if (dayName === day) {
                                    return (
                                        <div key={evt.id} className="p-2 bg-slate-800/80 rounded-lg border border-white/5">
                                            <div className="text-[10px] text-slate-500 truncate">{evt.summary}</div>
                                        </div>
                                    )
                                }
                                return null;
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
