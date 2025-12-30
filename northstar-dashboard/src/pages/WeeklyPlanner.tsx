import { useState, useEffect } from 'react';

import { Calendar, RefreshCw, CheckCircle2, GripVertical, AlertCircle, Sparkles } from 'lucide-react';
import { signInToGoogle, fetchCalendarEvents, pushTaskToCalendar } from '../services/googleCalendar'; // removed initGoogleClient
import {
    DndContext,
    DragOverlay,
    useDraggable,
    useDroppable,
    type DragStartEvent,
    type DragEndEvent,
    rectIntersection
} from '@dnd-kit/core';

interface Task {
    id: string;
    title: string;
    estimated_minutes: number;
    scheduled_date: string | null; // ISO Date String (YYYY-MM-DD)
    status: 'todo' | 'done';
}

// Ensure API URL is absolute or relative correctly
const API_BASE = "/api";

export default function WeeklyPlanner() {
    const [isConnected, setIsConnected] = useState(false);
    const [loading] = useState(false);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);

    // Week Generation
    const [weekDates, setWeekDates] = useState<Date[]>([]);

    useEffect(() => {
        // Generate current week dates (Mon-Sun)
        const curr = new Date();
        const first = curr.getDate() - curr.getDay() + 1;
        const days: Date[] = [];
        for (let i = 0; i < 7; i++) {
            const next = new Date(curr);
            next.setDate(first + i);
            days.push(next);
        }
        setWeekDates(days);

        loadTasks();

        // Check for success param from callback
        const params = new URLSearchParams(window.location.search);
        if (params.get('google_connected') === 'true') {
            setIsConnected(true);
            window.history.replaceState({}, '', window.location.pathname);
        }

        // Try loading calendar if we think we might be connected or just to check
        // Passing the days explicitly
        setTimeout(() => loadCalendar(days[0], days[6]), 1000);
    }, []);

    const loadTasks = async () => {
        try {
            const res = await fetch(`${API_BASE}/tasks`);
            const data = await res.json();
            if (data.tasks) {
                if (data.tasks.length === 0) {
                    seedMockTasks();
                } else {
                    setTasks(data.tasks);
                }
            }
        } catch (e) {
            console.error("Failed to load tasks", e);
            seedMockTasks();
        }
    };

    const seedMockTasks = () => {
        const mocks: Task[] = [
            { id: 't1', title: 'Draft Q1 Strategy', estimated_minutes: 120, scheduled_date: null, status: 'todo' },
            { id: 't2', title: 'Review PRs', estimated_minutes: 45, scheduled_date: null, status: 'todo' },
            { id: 't3', title: 'Update Landing Page', estimated_minutes: 90, scheduled_date: null, status: 'todo' },
            { id: 't4', title: 'Client Call Prep', estimated_minutes: 30, scheduled_date: null, status: 'todo' }
        ];
        setTasks(mocks);
    }

    const loadCalendar = async (start?: Date, end?: Date) => {
        // Fallback to state if not passed, but state might be empty initially
        const s = start || weekDates[0];
        const e = end || weekDates[6];

        if (!s || !e) return;

        try {
            const events = await fetchCalendarEvents(s, e);
            setCalendarEvents(events || []);
            setIsConnected(true); // If fetch succeeds, we are connected
        } catch (error) {
            // console.error(error); 
            // explicit ignore if 401, but logic is inside service
            setIsConnected(false);
        }
    };

    const handleSync = () => {
        if (!isConnected) signInToGoogle();
        else loadCalendar();
    };

    // DND Handlers
    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (over && active.id !== over.id) {
            const taskId = active.id as string;
            const dropContainerId = over.id as string;

            // Update Local State
            const updatedTasks = tasks.map(t => {
                if (t.id === taskId) {
                    return {
                        ...t,
                        scheduled_date: dropContainerId === 'backlog' ? null : dropContainerId
                    };
                }
                return t;
            });
            setTasks(updatedTasks);

            // Persist to API
            try {
                await fetch(`${API_BASE}/tasks`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        taskId,
                        date: dropContainerId === 'backlog' ? null : dropContainerId
                    })
                });

                // Sync to Google Calendar if scheduling to a date
                if (isConnected && dropContainerId !== 'backlog') {
                    const task = tasks.find(t => t.id === taskId);
                    if (task) {
                        // Construct time. Defaulting to 9:00 AM for simplicity as we don't have time slots yet
                        const startTime = `${dropContainerId}T09:00:00`;
                        const endTimeDate = new Date(new Date(startTime).getTime() + task.estimated_minutes * 60000);

                        await pushTaskToCalendar(task.title, startTime, endTimeDate.toISOString());
                        // Refresh calendar to show the new event
                        loadCalendar();
                    }
                }
            } catch (err) {
                console.error("Failed to schedule task", err);
            }
        }
    };

    // Helpers
    const getTasksForDate = (dateStr: string) => tasks.filter(t => t.scheduled_date === dateStr);
    const getBacklogTasks = () => tasks.filter(t => !t.scheduled_date);
    const getDailyTotalHours = (dateStr: string) => {
        const dailyTasks = getTasksForDate(dateStr);
        const minutes = dailyTasks.reduce((acc, t) => acc + (t.estimated_minutes || 0), 0);
        return (minutes / 60).toFixed(1);
    };

    const activeTask = tasks.find(t => t.id === activeId);

    return (
        <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} collisionDetection={rectIntersection}>
            <div className="max-w-[1400px] mx-auto pb-20 p-6">
                <header className="mb-8 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                            <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                                <Calendar size={24} className="text-indigo-400" />
                            </div>
                            Weekly Planner
                        </h1>
                        <p className="text-slate-400 mt-2 ml-14">Drag tasks to schedule your Deep Work blocks.</p>
                    </div>

                    <button
                        onClick={handleSync}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all ${isConnected
                            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                            : 'bg-white text-slate-900 hover:bg-slate-200'
                            }`}
                    >
                        {loading ? <RefreshCw className="animate-spin" size={18} /> : isConnected ? <CheckCircle2 size={18} /> : <span>G</span>}
                        {isConnected ? 'Synced' : 'Sync Calendar'}
                    </button>
                </header>

                <div className="flex gap-6 h-[calc(100vh-200px)]">

                    {/* SIDEBAR: Backlog */}
                    <div className="w-80 flex-shrink-0 flex flex-col bg-surface border border-white/5 rounded-2xl overflow-hidden">
                        <div className="p-4 border-b border-white/5 bg-slate-900/50">
                            <h2 className="font-bold text-white flex items-center gap-2">
                                <Sparkles size={16} className="text-amber-400" />
                                Task Backlog
                            </h2>
                            <p className="text-xs text-slate-500 mt-1">{getBacklogTasks().length} tasks unscheduled</p>
                        </div>
                        <DroppableColumn id="backlog" className="flex-1 p-3 overflow-y-auto space-y-3 bg-[#020617]/50">
                            {getBacklogTasks().map(task => (
                                <TaskCard key={task.id} task={task} />
                            ))}
                            {getBacklogTasks().length === 0 && (
                                <div className="text-center py-10 text-slate-600 text-sm">No tasks in backlog</div>
                            )}
                        </DroppableColumn>
                    </div>

                    {/* MAIN: Weekly Grid */}
                    <div className="flex-1 grid grid-cols-7 gap-3 min-w-0">
                        {weekDates.map(dateObj => {
                            const dateStr = dateObj.toISOString().split('T')[0];
                            const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                            const dayNum = dateObj.getDate();
                            const totalHours = Number(getDailyTotalHours(dateStr));

                            // Visual Polish Logic
                            let statusColor = "text-slate-500";
                            if (totalHours > 5.9) statusColor = "text-red-400 font-bold";
                            else if (totalHours >= 4) statusColor = "text-emerald-400 font-bold";

                            return (
                                <div key={dateStr} className="flex flex-col h-full min-w-0">
                                    <div className="text-center mb-2">
                                        <div className="text-xs text-slate-500 uppercase font-bold tracking-widest">{dayName}</div>
                                        <div className={`text-xl font-bold ${activeId ? 'text-blue-400' : 'text-white'}`}>{dayNum}</div>
                                    </div>
                                    <DroppableColumn
                                        id={dateStr}
                                        className={`flex-1 rounded-xl border border-white/5 p-2 space-y-2 relative transition-colors ${totalHours > 5.9 ? 'bg-red-500/5 border-red-500/20' : 'bg-surface/30'
                                            }`}
                                    >
                                        {/* Calendar Events Layer */}
                                        {calendarEvents
                                            .filter(evt => {
                                                const evtDate = new Date(evt.start.dateTime || evt.start.date);
                                                return evtDate.toISOString().split('T')[0] === dateStr;
                                            })
                                            .map(evt => (
                                                <div key={evt.id} className="p-1.5 px-2 bg-slate-800/60 rounded border border-white/5 mb-1 opacity-70">
                                                    <div className="text-[10px] text-slate-400 truncate font-mono">
                                                        {new Date(evt.start.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                    <div className="text-[11px] text-slate-300 truncate">{evt.summary}</div>
                                                </div>
                                            ))
                                        }

                                        {/* NorthStar Tasks */}
                                        {getTasksForDate(dateStr).map(task => (
                                            <TaskCard key={task.id} task={task} />
                                        ))}
                                    </DroppableColumn>

                                    {/* Footer: Totals */}
                                    <div className={`mt-2 text-center text-xs font-mono transition-colors ${statusColor}`}>
                                        {totalHours > 0 ? `${totalHours}h` : '-'}
                                        {totalHours > 5.9 && <AlertCircle size={10} className="inline ml-1" />}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                </div>
            </div>

            {/* Drag Overlay for smooth visual */}
            <DragOverlay>
                {activeId && activeTask ? (
                    <div className="p-3 bg-blue-600 rounded-lg shadow-2xl border border-blue-400/50 w-48 rotate-3 cursor-grabbing opacity-90 z-50">
                        <div className="flex items-start justify-between gap-2">
                            <div className="font-medium text-sm text-white line-clamp-2">{activeTask.title}</div>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                            <div className="text-[10px] font-mono bg-black/20 px-1.5 py-0.5 rounded text-blue-200">
                                {activeTask.estimated_minutes}m
                            </div>
                        </div>
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}

// Sub-components

function DroppableColumn({ id, children, className }: { id: string, children: React.ReactNode, className?: string }) {
    const { setNodeRef, isOver } = useDroppable({ id });
    return (
        <div ref={setNodeRef} className={`${className} ${isOver ? 'ring-2 ring-blue-500/50 bg-blue-500/5' : ''}`}>
            {children}
        </div>
    );
}

function TaskCard({ task }: { task: Task }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: task.id,
    });

    // Convert transform to style but we generally use Overlay for cleaner look,
    // so we just hide the original while dragging or lower opacity
    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0 : 1, // Hide original when dragging (using overlay)
    } : undefined;

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className={`group p-3 bg-surface rounded-lg border border-white/5 hover:border-blue-500/30 cursor-grab active:cursor-grabbing transition-all hover:shadow-lg hover:-translate-y-0.5 ${isDragging ? 'opacity-0' : 'opacity-100'}`}
        >
            <div className="flex items-start gap-2">
                <GripVertical size={14} className="text-slate-600 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div>
                    <div className="text-sm text-slate-200 font-medium leading-tight">{task.title}</div>
                    <div className="flex items-center gap-2 mt-2">
                        <div className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-white/5 font-mono">
                            {task.estimated_minutes}m
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
