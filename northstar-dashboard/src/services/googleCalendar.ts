export const signInToGoogle = () => {
    // Redirect to backend auth route which handles the OAuth2 flow
    window.location.href = '/api/auth/google';
};

export const fetchCalendarEvents = async (timeMin: Date, timeMax: Date) => {
    const start = timeMin.toISOString();
    const end = timeMax.toISOString();

    const response = await fetch(`/api/calendar?start=${start}&end=${end}`);

    if (response.status === 401) {
        throw new Error("unauthorized");
    }

    if (!response.ok) {
        throw new Error("Failed to fetch events");
    }

    const data = await response.json();
    return data.events;
};



export const pushTaskToCalendar = async (title: string, startTime: string, endTime: string, description?: string) => {
    const response = await fetch('/api/calendar', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            title,
            startTime,
            endTime,
            description
        })
    });

    if (response.status === 401) {
        throw new Error("unauthorized");
    }

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to sync task");
    }

    return await response.json();
};
