// Background Service Worker

// 1. Initialization
chrome.runtime.onInstalled.addListener(() => {
    chrome.alarms.clearAll();

    // A. 30-Minute Inactivity Nudge
    chrome.alarms.create("check_inactivity", {
        periodInMinutes: 30
    });

    // B. Daily 9 PM Planning Reminder
    const now = new Date();
    const ninePM = new Date();
    ninePM.setHours(21, 0, 0, 0);
    if (now > ninePM) ninePM.setDate(ninePM.getDate() + 1);

    chrome.alarms.create("daily_planning_9pm", {
        when: ninePM.getTime(),
        periodInMinutes: 1440 // 24 hours
    });
});

// 2. Alarm Handler
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "check_inactivity") {
        // Check if user is tracking time
        chrome.storage.local.get(['activeSession'], (result) => {
            if (!result.activeSession) {
                // No active session? Send a gentle nudge.
                // We could also check idle state APIs, but strict "no tracking" 
                // is a good enough proxy for "distracted" in this strict context.
                chrome.notifications.create({
                    type: "basic",
                    iconUrl: "icons/icon48.png",
                    title: "Where is your focus?",
                    message: "Don't let the 240 hours slip away. Start a tracker!",
                    priority: 1
                });
            }
        });
    }
    else if (alarm.name === "daily_planning_9pm") {
        chrome.notifications.create({
            type: "basic",
            iconUrl: "icons/icon48.png",
            title: "NorthStar Planning",
            message: "Time to set your Daily Path for tomorrow. Stay on track!",
            priority: 2,
            buttons: [{ title: "Open Dashboard" }]
        });
    }
});

// 3. Notification Interactions
chrome.notifications.onClicked.addListener(() => {
    const DASHBOARD_URL = "https://north-star2026-nkfadnvaua2hgsbpavwoec.streamlit.app/"; // Or your Next.js URL if deployed
    chrome.tabs.create({ url: DASHBOARD_URL });
});

chrome.notifications.onButtonClicked.addListener(() => {
    const DASHBOARD_URL = "https://north-star2026-nkfadnvaua2hgsbpavwoec.streamlit.app/";
    chrome.tabs.create({ url: DASHBOARD_URL });
});
