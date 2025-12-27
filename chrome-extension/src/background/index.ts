// Background Service Worker

// 1. Valid URLs
const DASHBOARD_URL = "https://north-star2026.vercel.app/";
const DAILY_PLAN_URL = "https://north-star2026.vercel.app/daily-plan";
const PLANNER_URL = "https://north-star2026.vercel.app/planner";

// 2. Setup Alarms Helper
const setupAlarms = () => {
    chrome.alarms.clearAll();

    const now = new Date();

    // A. Morning Routine (9:00 AM)
    const next9am = new Date();
    next9am.setHours(9, 0, 0, 0);
    if (now > next9am) next9am.setDate(next9am.getDate() + 1);

    chrome.alarms.create("morning_rule", {
        when: next9am.getTime(),
        periodInMinutes: 1440 // Daily
    });

    // B. Evening Prep (9:00 PM)
    const next9pm = new Date();
    next9pm.setHours(21, 0, 0, 0);
    if (now > next9pm) next9pm.setDate(next9pm.getDate() + 1);

    chrome.alarms.create("evening_rule", {
        when: next9pm.getTime(),
        periodInMinutes: 1440 // Daily
    });

    // C. Focus Check (Every 90 minutes)
    chrome.alarms.create("focus_check", {
        periodInMinutes: 90
    });
};

// 3. Initialization Listeners
chrome.runtime.onInstalled.addListener(() => {
    setupAlarms();
});

chrome.runtime.onStartup.addListener(() => {
    setupAlarms();
    // Persist the Auto-Open Dashboard feature
    chrome.tabs.create({ url: DASHBOARD_URL });
});

// 4. Alarm Handler
chrome.alarms.onAlarm.addListener((alarm) => {
    // A. Morning Rule
    if (alarm.name === "morning_rule") {
        chrome.tabs.create({ url: DAILY_PLAN_URL });
        chrome.notifications.create({
            type: "basic",
            iconUrl: chrome.runtime.getURL("icons/icon48.png"),
            title: "Good Morning! ☀️",
            message: "Let's review your NorthStar plan for today.",
            priority: 2,
            buttons: [{ title: "View Plan" }]
        });
    }
    // B. Evening Rule
    else if (alarm.name === "evening_rule") {
        chrome.tabs.create({ url: PLANNER_URL });
        chrome.notifications.create({
            type: "basic",
            iconUrl: chrome.runtime.getURL("icons/icon48.png"),
            title: "Evening Review 🌙",
            message: "Time to prep for tomorrow. Plan your goals now to stay ahead!",
            priority: 2,
            buttons: [{ title: "Plan Tomorrow" }]
        });
    }
    // C. Focus Check (90-min Rule)
    else if (alarm.name === "focus_check") {
        chrome.storage.local.get(['activeSession'], (result) => {
            // Only notify if NO active session
            if (!result.activeSession) {
                chrome.notifications.create({
                    type: "basic",
                    iconUrl: chrome.runtime.getURL("icons/icon48.png"),
                    title: "Where is your focus? 🎯",
                    message: "You haven't started a focus session yet. Shall we work on your 240-hour goal?",
                    priority: 2
                });
            }
        });
    }
});

// 5. Notification Interactions
chrome.notifications.onClicked.addListener(() => {
    chrome.tabs.create({ url: DASHBOARD_URL });
});

chrome.notifications.onButtonClicked.addListener((notificationId, _buttonIndex) => {
    // Simple logic: any button click opens relevant page. 
    // We could differentiate by ID if needed, but they all generally point to the app.
    if (notificationId.includes("morning")) {
        chrome.tabs.create({ url: DAILY_PLAN_URL });
    } else if (notificationId.includes("evening")) {
        chrome.tabs.create({ url: PLANNER_URL });
    } else {
        chrome.tabs.create({ url: DASHBOARD_URL });
    }
});

// 4. Async Message Listener (Fix for "A listener indicated an asynchronous response...")
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    // 1. Return true immediately to keep the channel open
    // 2. Handle logic asynchronously
    (async () => {
        try {
            if (request.action === 'log_work') {
                const API_URL = "https://north-star2026.vercel.app/api/time-logs/create";

                const response = await fetch(API_URL, {
                    method: 'POST',
                    mode: 'cors', // Explicitly set CORS mode
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(request.payload)
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    let errorMessage = `Server error: ${response.status}`;
                    try {
                        const errorJson = JSON.parse(errorText);
                        if (errorJson.error) {
                            errorMessage += ` - ${errorJson.error}`;
                        }
                        if (errorJson.details) {
                            errorMessage += ` (${errorJson.details})`;
                        }
                    } catch (e) {
                        errorMessage += ` - ${errorText.substring(0, 50)}`;
                    }
                    throw new Error(errorMessage);
                }

                const data = await response.json();
                sendResponse({ success: true, data });

            } else if (request.action === 'test_notification') {
                console.log("Received test_notification request");

                chrome.notifications.create({
                    type: "basic",
                    iconUrl: chrome.runtime.getURL("icons/icon48.png"),
                    title: "Test Notification",
                    message: "This is how your NorthStar reminders will look!",
                    priority: 2
                }, (notificationId) => {
                    if (chrome.runtime.lastError) {
                        console.error("Notification received error:", chrome.runtime.lastError);
                    } else {
                        console.log("Notification created ID:", notificationId);
                    }
                });

                sendResponse({ success: true });
            } else {
                sendResponse({ status: 'ignored' });
            }
        } catch (error: any) {
            console.error("Background Async Error:", error);
            sendResponse({ success: false, error: error.message });
        }
    })();

    return true; // CRITICAL: Indicates we will respond asynchronously
});
