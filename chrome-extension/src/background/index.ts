// Background Service Worker

const DASHBOARD_URL = "https://north-star2026.vercel.app/";
const DAILY_PLAN_URL = "https://north-star2026.vercel.app/daily-plan";
const PLANNER_URL = "https://north-star2026.vercel.app/planner";
const API_BASE = "https://north-star2026.vercel.app/api";

// 1. Setup Alarms
const setupAlarms = () => {
    chrome.alarms.clearAll();

    // A. Idle Nudge (Every 30 mins)
    // Rule: Notify if NO active session between 9 AM and 9 PM
    chrome.alarms.create("idle_nudge", { periodInMinutes: 30 });

    // B. Break/Focus Check (Every 1 min)
    // Rule: 
    // - If Paused > 15m -> Notify "Break Over"
    // - If Active > 90m -> Notify "Take a Break"
    chrome.alarms.create("status_check", { periodInMinutes: 1 });

    // C. Daily Planning Alert (9:00 PM)
    const now = new Date();
    const next9pm = new Date();
    next9pm.setHours(21, 0, 0, 0);
    if (now > next9pm) next9pm.setDate(next9pm.getDate() + 1);

    chrome.alarms.create("planning_alert", {
        when: next9pm.getTime(),
        periodInMinutes: 1440 // Daily
    });

    // D. Morning Rule (9:00 AM)
    const next9am = new Date();
    next9am.setHours(9, 0, 0, 0);
    if (now > next9am) next9am.setDate(next9am.getDate() + 1);

    chrome.alarms.create("morning_rule", {
        when: next9am.getTime(),
        periodInMinutes: 1440
    });
};

chrome.runtime.onInstalled.addListener(setupAlarms);
chrome.runtime.onStartup.addListener(setupAlarms);

// 2. Alarm Handler
chrome.alarms.onAlarm.addListener(async (alarm) => {
    const now = new Date();
    const hour = now.getHours();

    // --- A. IDLE NUDGE (30m) ---
    if (alarm.name === "idle_nudge") {
        if (hour >= 9 && hour < 21) { // 9 AM - 9 PM
            // Check if session is active
            try {
                const res = await fetch(`${API_BASE}/sessions/manage?action=get`);
                const data = await res.json();

                // Fetch daily stats for the nudge
                const dailyRes = await fetch(`${API_BASE}/time-logs/daily-stats`);
                const dailyData = await dailyRes.json();
                const totalHours = dailyData.total_hours || 0;
                const dailyTarget = dailyData.daily_target || 6;
                const hoursLeft = Math.max(0, dailyTarget - totalHours).toFixed(1);

                if (!data.active) {
                    chrome.notifications.create("notification_idle", {
                        type: "basic",
                        iconUrl: chrome.runtime.getURL("icons/icon48.png"),
                        title: "Where is your focus? 🎯",
                        message: `You've done ${totalHours.toFixed(1)}/${dailyTarget} hours today. ${hoursLeft} hours left to stay on track for Q1!`,
                        priority: 2,
                        buttons: [{ title: "Start Session" }]
                    });
                } else {
                    // Clear idle notification if it exists
                    chrome.notifications.clear("notification_idle");
                }
            } catch (e) {
                console.error("Idle Check failed", e);
            }
        }
    }

    // --- B. STATUS CHECK (1m) ---
    // Handles 90m Focus Reminder & 15m Break Reminder & Safety Stop
    else if (alarm.name === "status_check") {
        try {
            const res = await fetch(`${API_BASE}/sessions/manage?action=get`);
            const data = await res.json();

            if (data.active && data.session) {
                // Clear Idle Notification immediately if active
                chrome.notifications.clear("notification_idle");

                const s = data.session;
                const nowMs = Date.now();

                // 1. SAFETY STOP (4 Hours)
                // (Moved logic inside here to sync with API data)
                const start = new Date(s.start_time).getTime();
                const totalElapsedHours = (nowMs - start) / 1000 / 3600;

                if (totalElapsedHours >= 4) {
                    // Auto-stop logic (call API)
                    const payload = {
                        project_id: s.project_id || s.habit_id,
                        project_name: s.project_name || s.task_name || "Unknown",
                        hours: totalElapsedHours,
                        task_name: (s.task_name || "Auto-stopped") + " (Auto-stopped)",
                        date: new Date().toISOString(),
                        source: 'safety_check'
                    };
                    await fetch(`${API_BASE}/time-logs/create`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ type: 'work_log', data: payload })
                    });

                    // Stop session
                    await fetch(`${API_BASE}/sessions/manage`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'stop' }) // Ensure API handles this
                    });

                    chrome.notifications.create("notification_safety", {
                        type: "basic",
                        iconUrl: chrome.runtime.getURL("icons/icon48.png"),
                        title: "Session Auto-Stopped 🛑",
                        message: "Your session exceeded 4 hours and has been saved automatically.",
                        priority: 2
                    });
                    return; // Exit
                }

                // 2. BREAK CHECK (Paused > 15m)
                if (s.status === 'paused' && s.last_pause_time) {
                    const breakStart = s.last_pause_time;
                    const breakMin = (nowMs - breakStart) / 1000 / 60;

                    if (breakMin >= 15 && breakMin < 16) { // Notify roughly once
                        chrome.notifications.create("notification_break", {
                            type: "basic",
                            iconUrl: chrome.runtime.getURL("icons/icon48.png"),
                            title: "Break Time Over? ⏳",
                            message: "You've been on break for over 15 minutes. Ready to resume focus?",
                            priority: 2,
                            buttons: [{ title: "Resume" }]
                        });
                    }
                }

                // 3. FOCUS REMINDER (Active > 90m)
                // We need Net Duration (excluding breaks)
                // Helper: Sum current breaks
                const totalBreaks = (s.breaks || []).reduce((acc: number, b: any) => acc + (b.duration || 0), 0);
                const netDurationMs = (nowMs - start) / 1000 - totalBreaks;
                const netMinutes = netDurationMs / 60;

                // Check 90m threshold
                // We use a simplified check: between 90 and 91 mins. 
                // Since this runs every minute, it should catch it.
                if (s.status === 'active' && netMinutes >= 90 && netMinutes < 91) {
                    chrome.notifications.create("notification_focus", {
                        type: "basic",
                        iconUrl: chrome.runtime.getURL("icons/icon48.png"),
                        title: "90 Minutes of Focus! 🧠",
                        message: "Time for a short break to recharge your brain. ☕",
                        priority: 2,
                        buttons: [{ title: "Take a Break" }]
                    });
                }
            }
        } catch (e) {
            console.error("Status check failed", e);
        }
    }

    // --- C. PLANNING ALERT (9 PM) ---
    else if (alarm.name === "planning_alert") {
        chrome.notifications.create("notification_plan", {
            type: "basic",
            iconUrl: chrome.runtime.getURL("icons/icon48.png"),
            title: "Plan for Tomorrow 📝",
            message: "Don't forget to plan your tasks for tomorrow! A clear plan is half the battle.",
            priority: 2,
            buttons: [{ title: "Plan Now" }]
        });
    }

    // --- D. MORNING RULE ---
    else if (alarm.name === "morning_rule") {
        chrome.notifications.create("notification_morning", {
            type: "basic",
            iconUrl: chrome.runtime.getURL("icons/icon48.png"),
            title: "Good Morning! ☀️",
            message: "Let's review your NorthStar plan for today.",
            priority: 2,
            buttons: [{ title: "View Plan" }]
        });
    }
});

// 3. Notification Interactions
chrome.notifications.onClicked.addListener(() => {
    chrome.tabs.create({ url: DASHBOARD_URL });
});

chrome.notifications.onButtonClicked.addListener((id, _btnIdx) => {
    if (id === "notification_plan") {
        chrome.tabs.create({ url: PLANNER_URL });
    } else if (id === "notification_morning") {
        chrome.tabs.create({ url: DAILY_PLAN_URL });
    } else {
        chrome.tabs.create({ url: DASHBOARD_URL });
    }
});
