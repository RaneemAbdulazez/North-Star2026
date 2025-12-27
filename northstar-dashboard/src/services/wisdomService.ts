// import { GoogleGenerativeAI } from "@google/generative-ai";

// Use an interface for the Wisdom Item
export interface WisdomItem {
    id: string;
    title: string;
    author: string;
    duration: string;
    link_url: string;
    thumbnail_url?: string; // Optional custom thumbnail
    type: 'Video' | 'Article' | 'TedTalk' | 'Podcast';
    category: 'Financial Mindset' | 'Focus & Clarity' | 'Health & Energy' | 'Strategic Thinking';
    tag: string; // e.g., "Must Watch", "Daily Hack"
    description: string;
    source: 'Perplexity' | 'Backup';
}

const PERPLEXITY_API_KEY = import.meta.env.VITE_PERPLEXITY_API_KEY;

// Backup data in case API fails or quota exceeded
const BACKUP_WISDOM: WisdomItem[] = [
    {
        id: "backup-1",
        title: "How to Multiply Your Time",
        author: "Rory Vaden",
        duration: "18m",
        link_url: "https://www.ted.com/talks/rory_vaden_how_to_multiply_your_time",
        type: "TedTalk",
        category: "Focus & Clarity",
        tag: "Time Mgmt",
        description: "You don't need more time, you need to multiply the time you have.",
        source: 'Backup'
    },
    {
        id: "backup-2",
        title: "The Psychology of Your Future Self",
        author: "Dan Gilbert",
        duration: "12m",
        link_url: "https://www.ted.com/talks/dan_gilbert_the_psychology_of_your_future_self",
        type: "TedTalk",
        category: "Strategic Thinking",
        tag: "Mindset",
        description: "Human beings are works in progress that mistakenly think they are finished.",
        source: 'Backup'
    }
];

export const fetchDailyWisdom = async (goal: string = "Productivity"): Promise<WisdomItem> => {
    if (!PERPLEXITY_API_KEY) {
        console.warn("Missing VITE_PERPLEXITY_API_KEY. Using backup.");
        return getRandomBackup();
    }

    try {
        const response = await fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "llama-3.1-sonar-small-128k-online",
                messages: [
                    {
                        role: "system",
                        content: "You are a helpful assistant that finds specific, high-quality educational videos/TedTalks using live search."
                    },
                    {
                        role: "user",
                        content: `Find a highly-rated TedTalk, YouTube documentary, or educational video from 2024-2025 related to: "${goal}". 
                        
                        Return ONLY valid JSON with this exact schema:
                        {
                            "title": "Exact Video Title",
                            "author": "Channel or Speaker Name",
                            "duration": "Approx duration (e.g. 15m)",
                            "link_url": "Direct URL",
                            "type": "TedTalk" or "Video",
                            "category": "One of: 'Financial Mindset', 'Focus & Clarity', 'Health & Energy', 'Strategic Thinking'",
                            "tag": "Short catchy tag (e.g. 'Must Watch')",
                            "description": "One sentence summary."
                        }`
                    }
                ]
            })
        });

        if (!response.ok) {
            throw new Error(`Perplexity API Error: ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices[0]?.message?.content;

        // Parse JSON from the response text (handling potential markdown cleanups)
        const jsonStr = content.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(jsonStr);

        return {
            id: crypto.randomUUID(),
            ...parsed,
            source: 'Perplexity'
        };

    } catch (error) {
        console.error("Failed to fetch Live Wisdom:", error);
        return getRandomBackup();
    }
};

const getRandomBackup = () => {
    const randomIndex = Math.floor(Math.random() * BACKUP_WISDOM.length);
    return BACKUP_WISDOM[randomIndex];
};
