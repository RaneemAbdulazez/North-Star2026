export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
export const SCOPES = "https://www.googleapis.com/auth/calendar.events";

let tokenClient: any;
let accessToken: string | null = null;

// Initialize the Google Identity Services Client
export const initGoogleClient = (callback: (token: string) => void) => {
    if ((window as any).google) {
        tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: SCOPES,
            callback: (tokenResponse: any) => {
                if (tokenResponse && tokenResponse.access_token) {
                    accessToken = tokenResponse.access_token;
                    callback(accessToken!);
                }
            },
        });
    }
};

export const signInToGoogle = () => {
    if (tokenClient) {
        tokenClient.requestAccessToken();
    } else {
        console.error("Google Token Client not initialized");
    }
};

export const signOutFromGoogle = () => {
    accessToken = null;
    if ((window as any).google) {
        (window as any).google.accounts.oauth2.revoke(accessToken, () => {
            console.log('Consent revoked');
        });
    }
};

export const fetchCalendarEvents = async (timeMin: string, timeMax: string) => {
    if (!accessToken) throw new Error("Not authenticated");

    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) throw new Error("Failed to fetch events");
    return await response.json();
};

export const createCalendarEvent = async (event: any) => {
    if (!accessToken) throw new Error("Not authenticated");

    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(event)
    });

    if (!response.ok) throw new Error("Failed to create event");
    return await response.json();
};
