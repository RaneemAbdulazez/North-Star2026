import React, { useEffect, useState } from 'react';
import { Play, Minimize2 } from 'lucide-react';
import { safeSendMessage } from '../utils/chrome';

interface SessionState {
    status: 'idle' | 'focus' | 'break' | 'active' | 'paused';
    taskName?: string;
    projectId?: string;
    startTime?: number; // timestamp
    duration?: number; // seconds
}

export const Bubble: React.FC = () => {
    // Position State (Default: Bottom-Right)
    const [position, setPosition] = useState({ x: window.innerWidth - 80, y: window.innerHeight - 80 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    // UI State
    const [expanded, setExpanded] = useState(false);
    const [session, setSession] = useState<SessionState>({ status: 'idle' });
    const [elapsed, setElapsed] = useState(0);
    const [dailyProgress, setDailyProgress] = useState(0);


    // Initial Load & Polling for State
    useEffect(() => {
        let intervalId: any;
        let isMounted = true;

        const fetchState = async () => {
            // 4. Context Check & Error Handling: Stop all execution if context is invalidated
            if (!chrome.runtime?.id) {
                console.warn("NorthStar: Extension context invalidated. Stopping polling.");
                clearInterval(intervalId);
                return;
            }

            // 2. Fix Event Loop Clogging: Don't run heavy logic if tab is hidden
            if (document.hidden) {
                return;
            }

            const res = await safeSendMessage({ action: "GET_STATUS" });

            if (!isMounted) return;

            // If null, it means context was invalidated or error occurred
            if (!res) {
                // Double check if it was due to invalidation
                if (!chrome.runtime?.id) {
                    clearInterval(intervalId);
                }
                return;
            }

            if (res.success) {
                // Parse Session
                if (res.session.active && res.session.session) {
                    const s = res.session.session;
                    setSession({
                        status: s.status,
                        taskName: s.task_name || s.project_name,
                        startTime: new Date(s.start_time).getTime(),
                        duration: s.duration
                    });
                    // Calculate elapsed based on start time
                    const now = Date.now();
                    const start = new Date(s.start_time).getTime();
                    setElapsed(Math.floor((now - start) / 1000));
                } else {
                    setSession({ status: 'idle' });
                    setElapsed(0);
                }

                // Parse Daily
                if (res.daily) {
                    setDailyProgress(res.daily.total_hours);
                }
            }
        };

        fetchState();
        // 2. Fix Event Loop Clogging: Change frequency to every 20 seconds
        intervalId = setInterval(fetchState, 20000);

        return () => {
            isMounted = false;
            clearInterval(intervalId);
        };
    }, []);

    // Local Timer Tick (for smooth UI)
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (session.status === 'active' && session.startTime) {
            interval = setInterval(() => {
                // Performance: Check tab visibility to avoid unnecessary renders
                if (document.hidden) return;

                const now = Date.now();
                setElapsed(Math.floor((now - session.startTime!) / 1000));
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [session]);


    // Handlers
    const handleControl = (action: string) => {
        if (!chrome.runtime?.id) return;
        safeSendMessage({ action });
    };

    // ... Draggable Logic (Keep same) ...
    const handleMouseDown = (e: React.MouseEvent) => {
        // Only drag if not clicking a button/interactive element
        if ((e.target as HTMLElement).tagName === 'BUTTON') return;

        setIsDragging(true);
        setDragOffset({
            x: e.clientX - position.x,
            y: e.clientY - position.y
        });
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging) {
                setPosition({
                    x: e.clientX - dragOffset.x,
                    y: e.clientY - dragOffset.y
                });
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, dragOffset]);

    // Format Time
    const formatTime = (sec: number) => {
        const m = Math.floor(sec / 60).toString().padStart(2, '0');
        const s = (sec % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };



    // Percentage Display Logic
    // Percentage Display Logic (Hardcoded 8h target = 480m)
    const rawPercent = dailyProgress > 0 ? Math.min((dailyProgress / 8.0) * 100, 100) : 0;
    const progressPercent = (isNaN(rawPercent) || !isFinite(rawPercent)) ? 0 : rawPercent;

    return (
        <>
            {/* MINI DASHBOARD (EXPANDED) */}
            {expanded && (
                <div
                    style={{
                        position: 'fixed',
                        bottom: '100px',
                        right: '30px',
                        width: '300px',
                        background: 'rgba(15, 23, 42, 0.95)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '16px',
                        padding: '20px',
                        color: 'white',
                        fontFamily: 'sans-serif',
                        zIndex: 2147483647
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <div>
                            <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Current Focus</div>
                            <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{session.taskName || "No Task Selected"}</div>
                        </div>
                        <button onClick={() => setExpanded(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><Minimize2 size={16} /></button>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', marginBottom: '16px', position: 'relative' }}>
                        <div style={{ width: `${progressPercent}%`, height: '100%', background: '#00f2ff', borderRadius: '2px', transition: 'width 0.5s ease' }}></div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                        {session.status === 'active' ? (
                            <>
                                <button onClick={() => handleControl('PAUSE')} style={{ flex: 1, padding: '8px', background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Pause</button>
                                <button onClick={() => handleControl('STOP')} style={{ flex: 1, padding: '8px', background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Stop</button>
                            </>
                        ) : session.status === 'paused' ? (
                            <button onClick={() => handleControl('RESUME')} style={{ flex: 1, padding: '8px', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Resume</button>
                        ) : (
                            <button className="flex-1 bg-slate-800 text-slate-500 py-2.5 rounded-xl flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-wide cursor-not-allowed">
                                <Play size={16} /> Start in Popup
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* MAIN BUBBLE used via class injection */}
            <div
                className="northstar-bubble"
                onMouseDown={handleMouseDown}
                onClick={() => !isDragging && setExpanded(!expanded)}
                style={{
                    left: `${position.x}px`, // Override CSS right/bottom with JS specific coords
                    top: `${position.y}px`,
                    bottom: 'auto',
                    right: 'auto'
                }}
            >
                {/* Content */}
                {session.status === 'idle' ? (
                    <span>{progressPercent.toFixed(0)}%</span>
                ) : (
                    <div style={{ fontSize: '12px' }}>{formatTime(elapsed)}</div>
                )}
            </div>
        </>
    );
};
