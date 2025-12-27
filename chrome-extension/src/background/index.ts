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

chrome.runtime.onStartup.addListener(() => {
    const DASHBOARD_URL = "https://north-star2026.vercel.app/";
    chrome.tabs.create({ url: DASHBOARD_URL });
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
                    iconUrl: chrome.runtime.getURL("icons/icon48.png"),
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
            iconUrl: chrome.runtime.getURL("icons/icon48.png"),
            title: "NorthStar Planning",
            message: "Time to set your Daily Path for tomorrow. Stay on track!",
            priority: 2,
            buttons: [{ title: "Open Dashboard" }]
        });
    }
});

// 3. Notification Interactions
const DASHBOARD_URL = "https://north-star2026-q54mxx1iv-raneemabdulazezs-projects.vercel.app/";

chrome.notifications.onClicked.addListener(() => {
    chrome.tabs.create({ url: DASHBOARD_URL });
});

chrome.notifications.onButtonClicked.addListener(() => {
    chrome.tabs.create({ url: DASHBOARD_URL });
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
