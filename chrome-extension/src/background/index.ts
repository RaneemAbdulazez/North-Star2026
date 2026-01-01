// Background Service Worker

const DASHBOARD_URL = "https://north-star2026.vercel.app/";
const DAILY_PLAN_URL = "https://north-star2026.vercel.app/daily-plan";
const PLANNER_URL = "https://north-star2026.vercel.app/planner";
const API_BASE = "https://north-star2026.vercel.app/api";

// Helper: Bulletproof Fetch
// 1. Swallows 401s
// 2. Swallows HTML responses (404s, Redirects) to prevent SyntaxError
// 3. Swallows Network Errors
async function safeFetch(url: string, options?: RequestInit) {
    try {
        const res = await fetch(url, options);

        // Check for 401 Unauthorized
        if (res.status === 401) return null;

        // Check if response is JSON
        const contentType = res.headers.get("content-type");
        if (!res.ok || !contentType || !contentType.includes("application/json")) {
            // Prevent "Unexpected token <" by ignoring non-JSON responses
            // This is common during auth redirects or 404s
            return null;
        }

        return res;
    } catch (e) {
        // Network error or other fetch failure
        return null;
    }
}

// 1. Setup Alarms
const setupAlarms = () => {
    try {
        chrome.alarms.clearAll();
        chrome.alarms.create("idle_nudge", { periodInMinutes: 30 });
        chrome.alarms.create("status_check", { periodInMinutes: 1 });

        const now = new Date();
        const next9pm = new Date();
        next9pm.setHours(21, 0, 0, 0);
        if (now > next9pm) next9pm.setDate(next9pm.getDate() + 1);

        chrome.alarms.create("planning_alert", {
            when: next9pm.getTime(),
            periodInMinutes: 1440
        });

        const next9am = new Date();
        next9am.setHours(9, 0, 0, 0);
        if (now > next9am) next9am.setDate(next9am.getDate() + 1);

        chrome.alarms.create("morning_rule", {
            when: next9am.getTime(),
            periodInMinutes: 1440
        });
    } catch (e) {
        console.log("Extension updating... (setupAlarms skipped)");
    }
};

chrome.runtime.onInstalled.addListener(() => {
    try { setupAlarms(); } catch (e) { console.log("Context invalidated during install"); }
});
chrome.runtime.onStartup.addListener(() => {
    try { setupAlarms(); } catch (e) { console.log("Context invalidated during startup"); }
});

// 2. Alarm Handler
chrome.alarms.onAlarm.addListener(async (alarm) => {
    try {
        const now = new Date();
        const hour = now.getHours();

        // --- A. IDLE NUDGE (30m) ---
        if (alarm.name === "idle_nudge") {
            // Smart Silence: Only between 8:00 AM and 10:00 PM
            // AND Work Days Only (Mon=1 to Sat=6). Skip Sunday (0).
            const day = now.getDay();
            if (hour >= 8 && hour < 22 && day !== 0) {
                const res = await safeFetch(`${API_BASE}/sessions/manage?action=get`);
                if (!res) return;
                const data = await res.json();

                const dailyRes = await safeFetch(`${API_BASE}/time-logs/daily-stats`);
                if (!dailyRes) return;
                // const dailyData = await dailyRes.json(); // Unused

                // const totalHours = dailyData.total_hours || 0; // Unused
                // const dailyTarget = dailyData.daily_target || 6; // Unused

                if (!data.active) {
                    chrome.notifications.create("notification_idle", {
                        type: "basic",
                        iconUrl: chrome.runtime.getURL("icons/icon48.png"),
                        title: "⚠️ العداد متوقف يا رنيم!",
                        message: "ميزانية الـ 425 ساعة في خطر. هدفك اليومي 5.9 ساعة، ابدأي العداد الآن لتسجيل إنجازك.",
                        priority: 2,
                        buttons: [{ title: "Start Timer" }]
                    });
                } else {
                    chrome.notifications.clear("notification_idle");
                }
            }
        }

        // --- B. STATUS CHECK (1m) ---
        else if (alarm.name === "status_check") {
            const res = await safeFetch(`${API_BASE}/sessions/manage?action=get`);
            if (!res) return;
            const data = await res.json();

            if (data.active && data.session) {
                chrome.notifications.clear("notification_idle");

                const s = data.session;
                const nowMs = Date.now();
                const start = new Date(s.start_time).getTime();
                const totalElapsedHours = (nowMs - start) / 1000 / 3600;

                if (totalElapsedHours >= 4) {
                    const payload = {
                        project_id: s.project_id || s.habit_id,
                        project_name: s.project_name || s.task_name || "Unknown",
                        hours: totalElapsedHours,
                        task_name: (s.task_name || "Auto-stopped") + " (Auto-stopped)",
                        date: new Date().toISOString(),
                        source: 'safety_check'
                    };

                    await safeFetch(`${API_BASE}/time-logs/create`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ type: 'work_log', data: payload })
                    });

                    await safeFetch(`${API_BASE}/sessions/manage`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'stop' })
                    });

                    chrome.notifications.create("notification_safety", {
                        type: "basic",
                        iconUrl: chrome.runtime.getURL("icons/icon48.png"),
                        title: "Session Auto-Stopped 🛑",
                        message: "Your session exceeded 4 hours and has been saved automatically.",
                        priority: 2
                    });
                    return;
                }

                if (s.status === 'paused' && s.last_pause_time) {
                    const breakStart = s.last_pause_time;
                    const breakMin = (nowMs - breakStart) / 1000 / 60;

                    if (breakMin >= 15 && breakMin < 16) {
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

                const totalBreaks = (s.breaks || []).reduce((acc: number, b: any) => acc + (b.duration || 0), 0);
                const netDurationMs = (nowMs - start) / 1000 - totalBreaks;
                const netMinutes = netDurationMs / 60;

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
        }

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
    } catch (e) {
        console.log("Extension updating... (alarm skipped)");
    }
});

// 3. Notification Interactions
chrome.notifications.onClicked.addListener(() => {
    try {
        chrome.tabs.create({ url: DASHBOARD_URL });
    } catch (e) {
        console.log("Context invalidated during tab create");
    }
});

chrome.notifications.onButtonClicked.addListener((_notificationId, _buttonIndex) => {
    try {
        // For now, the button also just opens the dashboard to let them start manually
        chrome.tabs.create({ url: DASHBOARD_URL });
    } catch (e) {
        console.log("Context invalidated during button click");
    }
});

// 4. Message Handler
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    try {
        if (message.action === "GET_STATUS") {
            (async () => {
                try {
                    const sessionRes = await safeFetch(`${API_BASE}/sessions/manage?action=get`);
                    const dailyRes = await safeFetch(`${API_BASE}/time-logs/daily-stats`);

                    const sessionData = sessionRes ? await sessionRes.json() : { active: false };
                    const dailyData = dailyRes ? await dailyRes.json() : { total_hours: 0, daily_target: 8.0 };

                    sendResponse({
                        success: true,
                        session: sessionData,
                        daily: dailyData
                    });
                } catch (err: any) {
                    console.error("BG Status Error:", err);
                    sendResponse({ success: false, error: err.message });
                }
            })();
            return true;
        }
        // ... rest of file
    } catch (e) {
        console.log("Context invalidated");
        return false;
    }
});
