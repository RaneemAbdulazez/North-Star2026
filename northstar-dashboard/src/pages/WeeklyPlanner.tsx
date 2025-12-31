import { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle2, Target, BarChart3 } from 'lucide-react';
import { fetchCalendarEvents, pushTaskToCalendar } from '../services/googleCalendar';
import {
    DndContext,
    DragOverlay,
    useDraggable,
    useDroppable,
    type DragStartEvent,
    type DragEndEvent,
    rectIntersection
} from '@dnd-kit/core';

import GoalSidebar from '../components/GoalSidebar';
import type { Project, Goal, Task } from '../types';

const API_BASE = "/api";

export default function WeeklyPlanner() {
    const [isConnected, setIsConnected] = useState(false);

    // Data State
    const [projects, setProjects] = useState<Project[]>([]);
    const [goals, setGoals] = useState<Goal[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [calendarEvents, setCalendarEvents] = useState<any[]>([]);

    // UI State
    const [activeId, setActiveId] = useState<string | null>(null);
    const [expandedStats, setExpandedStats] = useState(true);
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

        loadData();

        // Check for success param from callback
        const params = new URLSearchParams(window.location.search);
        if (params.get('error')) {
            alert("SYNC FAILED: " + params.get('error'));
        }

        if (params.get('google_connected') === 'true' || params.get('sync') === 'true') {
            setIsConnected(true);
            window.history.replaceState({}, '', window.location.pathname);
            setTimeout(() => loadCalendar(days[0], days[6]), 500);
        } else {
            setTimeout(() => loadCalendar(days[0], days[6]), 500);
        }
    }, []);

    const loadData = async () => {
        try {
            const [projRes, goalRes, taskRes] = await Promise.all([
                fetch(`${API_BASE}/projects`),
                fetch(`${API_BASE}/goals`),
                fetch(`${API_BASE}/tasks`)
            ]);

            const pData = await projRes.json();
            const gData = await goalRes.json();
            const tData = await taskRes.json();

            setProjects(pData?.projects || []);
            setGoals(gData?.goals || []);
            setTasks(tData?.tasks || []);
        } catch (e) {
            console.error("Failed to load data", e);
        }
    };

    const loadCalendar = async (start?: Date, end?: Date) => {
        const s = start || weekDates[0];
        const e = end || weekDates[6];

        if (!s || !e) return;

        try {
            const events = await fetchCalendarEvents(s, e);
            setCalendarEvents(events || []);
            setIsConnected(true);
        } catch (error: any) {
            console.error("loadCalendar Failed:", error);
            setIsConnected(false);
        }
    };

    // --- Actions ---
    const handleAddGoal = async (projectId: string) => {
        const title = prompt("Enter Weekly Goal Title:");
        if (!title) return;

        const newGoal = {
            title,
            projectId,
            weekId: 'current-week',
            estimatedInfo: 5
        };

        const res = await fetch(`${API_BASE}/goals`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newGoal)
        });
        const saved = await res.json();
        setGoals(prev => [saved, ...prev]);
    };

    const handleAddTask = async (goalId: string, _projectId: string) => {
        const title = prompt("Enter Task Title:");
        if (!title) return;

        const newTask = {
            title,
            estimated_minutes: 60,
            goalId
        };

        const res = await fetch(`${API_BASE}/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newTask)
        });
        const saved = await res.json();
        setTasks(prev => [saved, ...prev]);
    };



    // --- DND Logic ---
    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (over && active.id !== over.id) {
            const taskId = active.id as string;
            const dropContainerId = over.id as string;

            const isDateColumn = weekDates.some(d => d.toISOString().split('T')[0] === dropContainerId);
            if (!isDateColumn) return;

            // --- TIME CALCULATION LOGIC ---
            let scheduledTime = "09:00:00";

            if (active.rect.current.translated && over.rect) {
                const relativeY = active.rect.current.translated.top - over.rect.top;

                if (relativeY > 80) {
                    const pixelsIntoGrid = relativeY - 80;
                    const hoursIntoGrid = pixelsIntoGrid / 60;
                    const hour = Math.floor(6 + hoursIntoGrid);
                    const minute = Math.floor((hoursIntoGrid % 1) * 60);
                    const clampedHour = Math.max(6, Math.min(hour, 23));
                    const roundedMin = Math.round(minute / 15) * 15;

                    scheduledTime = `${clampedHour.toString().padStart(2, '0')}:${roundedMin.toString().padStart(2, '0')}:00`;
                }
            }

            // --- DURATION PROMPT (Option A) ---
            const taskStart = tasks.find(t => t.id === taskId);
            const defaultDuration = taskStart?.estimated_minutes || 60;
            const durationInput = prompt(`Set Duration for "${taskStart?.title}" (min):`, String(defaultDuration));

            if (durationInput === null) return; // User cancelled drop
            const newDuration = parseInt(durationInput, 10) || 60;

            // Update State
            setTasks(prev => prev.map(t => {
                if (t.id === taskId) {
                    return { ...t, scheduled_date: dropContainerId, estimated_minutes: newDuration };
                }
                return t;
            }));

            // Persist
            try {
                const task = tasks.find(t => t.id === taskId);
                const goal = goals.find(g => g.id === task?.goalId);
                // goal?.projectId might be string, ensure we are safe
                const projectId = goal?.projectId;

                const response = await fetch(`${API_BASE}/tasks`, {
                    method: 'PATCH', // backend will sync time_logs
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        taskId,
                        goalId: task?.goalId,
                        projectId,
                        title: task?.title,
                        date: dropContainerId,
                        time: scheduledTime,
                        estimated_minutes: newDuration
                    })
                });

                if (!response.ok) throw new Error("API update failed");

                if (isConnected && task) {
                    const startTime = `${dropContainerId}T${scheduledTime}`;
                    const duration = newDuration;
                    const endTimeDate = new Date(new Date(startTime).getTime() + duration * 60000);

                    await pushTaskToCalendar(task.title, startTime, endTimeDate.toISOString());
                    loadCalendar();
                }

            } catch (err: any) {
                console.error("Failed to schedule task", err);
            }
        }
    };

    const getTasksForDate = (dateStr: string) => tasks?.filter(t => t.scheduled_date === dateStr) || [];

    // Timeline Constants
    const START_HOUR = 6;
    const END_HOUR = 24;
    const HOUR_HEIGHT = 60;
    const TOTAL_HEIGHT = (END_HOUR - START_HOUR) * HOUR_HEIGHT;

    const getEventStyle = (startStr: string, endStr: string) => {
        const start = new Date(startStr);
        const end = new Date(endStr);
        let startHour = start.getHours() + (start.getMinutes() / 60);
        let endHour = end.getHours() + (end.getMinutes() / 60);
        if (startHour < START_HOUR) startHour = START_HOUR;
        if (endHour > END_HOUR) endHour = END_HOUR;
        const top = (startHour - START_HOUR) * HOUR_HEIGHT;
        const height = (endHour - startHour) * HOUR_HEIGHT;
        return { top: `${top}px`, height: `${Math.max(height, 20)}px` };
    };

    const todayStr = new Date().toISOString().split('T')[0];
    const todayTasks = getTasksForDate(todayStr);
    const todayMinutes = todayTasks.reduce((acc, t) => acc + (Number(t.estimated_minutes) || 0), 0);
    const todayHours = todayMinutes / 60;
    const dailyProgress = isNaN(todayHours) ? 0 : Math.min((todayHours / 5.9) * 100, 100);

    const activeTask = tasks?.find(t => t.id === activeId);

    // Safeguard for weekDates being empty initially
    if (!weekDates.length) return <div className="p-10 text-slate-400">Loading Planner...</div>;

    return (
        <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} collisionDetection={rectIntersection}>
            <div className="max-w-full mx-auto h-screen flex flex-col bg-[#0f172a] text-slate-200 overflow-hidden">

                <header className="flex-shrink-0 bg-surface border-b border-white/5 px-6 py-3 flex items-center justify-between z-20 shadow-sm relative">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                                <Target size={20} className="text-blue-400" />
                            </div>
                            <div>
                                <h1 className="text-lg font-bold text-white leading-none">Weekly Planner</h1>
                                <p className="text-[10px] text-slate-500 font-mono mt-1">Q1 FY2026 • WEEK 01 • v2.1</p>
                            </div>
                        </div>

                        <div className="hidden lg:flex items-center gap-4 px-4 py-1.5 bg-slate-900/50 rounded-lg border border-white/5">
                            <div className="text-xs font-medium text-slate-400">TODAY'S ANCHOR</div>
                            <div className="w-32 h-2 bg-slate-800 rounded-full overflow-hidden">
                                <div
                                    className={`h-full transition-all duration-500 ${todayHours >= 5.9 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                                    style={{ width: `${dailyProgress}%` }}
                                />
                            </div>
                            <div className="text-xs font-mono text-white">
                                <span className={todayHours >= 5.9 ? "text-emerald-400" : "text-blue-400"}>{todayHours.toFixed(1)}h</span>
                                <span className="text-slate-600"> / 5.9h</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setExpandedStats(!expandedStats)}
                            className="p-2 text-slate-400 hover:text-white transition-colors"
                        >
                            <BarChart3 size={18} />
                        </button>

                        <div className="h-6 w-px bg-white/10 mx-1" />

                        <button
                            onClick={() => loadCalendar()}
                            className="px-3 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors border border-white/10"
                        >
                            <RefreshCw size={16} />
                        </button>

                        {!isConnected ? (
                            <a
                                href="/api/auth/google"
                                className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-500 transition-colors shadow-lg shadow-blue-900/20 inline-block decoration-none"
                            >
                                CONNECT GOOGLE
                            </a>
                        ) : (
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 text-xs font-bold">
                                <CheckCircle2 size={14} />
                                <span>SYNCED</span>
                            </div>
                        )}
                    </div>
                </header>

                <div className="flex flex-1 overflow-hidden relative">

                    {projects.length === 0 ? (
                        <div className="w-80 border-r border-white/5 bg-surface text-slate-500 p-10 flex flex-col items-center justify-center text-xs gap-4">
                            <p>No Projects Found in DB.</p>
                            <p className="text-[10px]">Please ensure you have created projects in the "Projects" page.</p>
                        </div>
                    ) : (
                        <GoalSidebar
                            projects={projects}
                            goals={goals}
                            tasks={tasks}
                            onAddGoal={handleAddGoal}
                            onAddTask={handleAddTask}
                        />
                    )}

                    <div className="flex-1 overflow-x-auto overflow-y-auto bg-[#0b101e] p-6 custom-scrollbar relative">
                        <div className="grid grid-cols-7 gap-x-2 min-w-[1000px] mb-20">
                            {weekDates.map(dateObj => {
                                const isToday = dateObj.toDateString() === new Date().toDateString();
                                return (
                                    <div key={dateObj.toISOString()} className="text-center pb-4 sticky top-0 bg-[#0b101e] z-20 pt-2 border-b border-white/5">
                                        <div className={`text-xs uppercase font-bold tracking-widest mb-1 ${isToday ? 'text-blue-400' : 'text-slate-500'}`}>
                                            {dateObj.toLocaleDateString('en-US', { weekday: 'short' })}
                                        </div>
                                        <div className={`text-2xl font-bold ${isToday ? 'text-white' : 'text-slate-400'}`}>
                                            {dateObj.getDate()}
                                        </div>
                                    </div>
                                );
                            })}

                            {weekDates.map(dateObj => {
                                const dateStr = dateObj.toISOString().split('T')[0];
                                const dailyTasks = getTasksForDate(dateStr);
                                const dailyMinutes = dailyTasks.reduce((acc, t) => acc + (Number(t.estimated_minutes) || 0), 0);
                                const hours = (dailyMinutes / 60).toFixed(1);

                                return (
                                    <DroppableColumn
                                        key={dateStr}
                                        id={dateStr}
                                        className={`min-h-[600px] rounded-xl relative border-r border-white/5 transition-colors ${Number(hours) > 5.9 ? 'bg-red-500/5' : ''
                                            }`}
                                    >
                                        <div className="p-2 space-y-2 min-h-[60px] mb-2">
                                            {dailyTasks.map(task => {
                                                const goal = goals?.find(g => g.id === task.goalId);
                                                const project = projects?.find(p => p.id === goal?.projectId);
                                                return (
                                                    <TaskCard
                                                        key={task.id}
                                                        task={task}
                                                        color={project?.color}
                                                    />
                                                );
                                            })}
                                        </div>

                                        <div className="relative border-t border-white/5" style={{ height: TOTAL_HEIGHT }}>
                                            {Array.from({ length: END_HOUR - START_HOUR }).map((_, i) => (
                                                <div
                                                    key={i}
                                                    className="absolute w-full border-t border-white/5 text-[9px] text-slate-700 pl-1"
                                                    style={{ top: i * HOUR_HEIGHT }}
                                                >
                                                    {i + START_HOUR}:00
                                                </div>
                                            ))}

                                            {calendarEvents
                                                .filter(evt => {
                                                    if (!evt.start.dateTime) return false;
                                                    const evtDate = new Date(evt.start.dateTime);
                                                    return evtDate.toISOString().split('T')[0] === dateStr;
                                                })
                                                .map(evt => {
                                                    const style = getEventStyle(evt.start.dateTime, evt.end.dateTime);
                                                    return (
                                                        <div
                                                            key={evt.id}
                                                            className="absolute left-1 right-1 rounded border border-blue-500/30 bg-blue-600/10 p-1 overflow-hidden hover:bg-blue-600/20 transition-colors z-10"
                                                            style={style}
                                                            title={evt.summary}
                                                        >
                                                            <div className="text-[10px] font-bold text-blue-200 truncate">{evt.summary}</div>
                                                        </div>
                                                    );
                                                })
                                            }
                                        </div>

                                        <div className="mt-2 text-center text-[10px] text-slate-600 font-mono">
                                            {hours}h
                                        </div>
                                    </DroppableColumn>
                                );
                            })}
                        </div>
                    </div>

                </div>
            </div>

            <DragOverlay>
                {activeId && activeTask ? (
                    <div className="p-3 bg-blue-600 rounded-lg shadow-2xl border border-blue-400/50 w-48 rotate-3 cursor-grabbing opacity-90 z-50">
                        <div className="font-medium text-sm text-white">{activeTask.title}</div>
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}

function DroppableColumn({ id, children, className }: { id: string, children: React.ReactNode, className?: string }) {
    const { setNodeRef, isOver } = useDroppable({ id });
    return (
        <div ref={setNodeRef} className={`${className} ${isOver ? 'ring-2 ring-blue-500/50 bg-blue-500/5' : ''}`}>
            {children}
        </div>
    );
}

function TaskCard({ task, color }: { task: Task, color?: string }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0 : 1,
    } : undefined;

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className={`group p-2 rounded border border-white/5 bg-slate-800/80 hover:bg-slate-700/80 cursor-grab active:cursor-grabbing hover:shadow-lg ${isDragging ? 'opacity-0' : 'opacity-100'}`}
        >
            <div className="flex items-center gap-2">
                <div className="w-1 h-6 rounded-full" style={{ backgroundColor: color || '#64748b' }} />
                <div className="min-w-0">
                    <div className="text-xs text-slate-200 font-medium truncate">{task.title}</div>
                    <div className="text-[9px] text-slate-500">{task.estimated_minutes}m</div>
                </div>
            </div>
        </div>
    );
}
