// Background Service Worker

const DASHBOARD_URL = "https://north-star2026-nkfadnvaua2hgsbpavwoec.streamlit.app/";

// 1. Auto-Open on Startup
chrome.runtime.onStartup.addListener(async () => {
    const tabs = await chrome.tabs.query({ url: DASHBOARD_URL + "/*" });
    if (tabs.length === 0) {
        chrome.tabs.create({ url: DASHBOARD_URL, pinned: true });
    }
});

// 2. Alarms (Habit Enforcer)
chrome.runtime.onInstalled.addListener(() => {
    // Clear existing
    chrome.alarms.clearAll();

    // Set up Daily 10 AM
    // Calculate time for next 10 AM
    const now = new Date();
    const tenAM = new Date();
    tenAM.setHours(10, 0, 0, 0);
    if (now > tenAM) tenAM.setDate(tenAM.getDate() + 1);

    chrome.alarms.create("daily_morning", {
        when: tenAM.getTime(),
        periodInMinutes: 1440 // 24 hours
    });

    // Set up Daily 3 PM
    const threePM = new Date();
    threePM.setHours(15, 0, 0, 0);
    if (now > threePM) threePM.setDate(threePM.getDate() + 1);

    chrome.alarms.create("daily_afternoon", {
        when: threePM.getTime(),
        periodInMinutes: 1440
    });
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "daily_morning") {
        chrome.notifications.create({
            type: "basic",
            iconUrl: "icons/icon48.png",
            title: "NorthStar Daily Goal",
            message: "Have you planned your 20h Deep Work for the week?",
            priority: 2
        });
    } else if (alarm.name === "daily_afternoon") {
        chrome.notifications.create({
            type: "basic",
            iconUrl: "icons/icon48.png",
            title: "Afternoon Focus",
            message: "Don't drift off. One more Deep Work session!",
            priority: 2
        });
    }
});

chrome.notifications.onClicked.addListener(() => {
    chrome.tabs.create({ url: DASHBOARD_URL });
});
