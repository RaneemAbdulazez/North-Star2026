import { GoogleGenerativeAI } from "@google/generative-ai";

interface GuardianResponse {
    status: 'PASS' | 'FAIL';
    reason: string;
}

// Fallback for when API key is missing or network fails
const MOCK_RESPONSE: GuardianResponse = {
    status: 'FAIL',
    reason: "[SYSTEM] Gemini API Key missing or network error. Please set VITE_GEMINI_API_KEY in .env to enable the Ruthless Guardian."
};

export const validateProjectWithGemini = async (
    projectName: string,
    answers: string[],
    pillars: string[]
): Promise<GuardianResponse> => {

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    console.log("Guardian Debug - API Key Available:", !!apiKey); // Debug log

    if (!apiKey) {
        console.warn("VITE_GEMINI_API_KEY not found. Using fallback mock.");
        return new Promise(resolve => setTimeout(() => resolve(MOCK_RESPONSE), 1500));
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        // User requested upgrade (Note: Using 2.0 Flash Exp as 2.5 is not yet public)
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp", generationConfig: { responseMimeType: "application/json" } });

        const prompt = `
        You are a Ruthless Strategic Advisor (The North Star Guardian).
        YOUR CORE DIRECTIVE: The user has ONLY 3 GOALS. Reject anything else.
        
        THE NORTH STARS:
        1. FINANCIAL: Reach $10K Monthly Revenue.
        2. HEALTH: Better Health (Consistent Gym).
        3. SKILL: Fluent English.

        CONTEXT:
        PROJECT: ${projectName}
        PILLARS: ${pillars.join(", ")}
        JUSTIFICATION: ${answers.join(" ")}

        CRITERIA:
        - PASS: If it DIRECTLY & MASSIVELY moves the needle on ONE of the 3 North Stars.
        - FAIL: If it's a "Nice to have", "Hobby", or "Distraction" (e.g. 'Cats', 'Decorating', 'Politics').
        - FAIL: If the justification is vague.

        OUTPUT FORMAT (JSON):
        {
        "status": "PASS" | "FAIL",
        "reason": "Short, ruthless feedback. Relate it to the specific North Star."
        }
        `;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        const data = JSON.parse(responseText) as GuardianResponse;

        return data;

    } catch (error) {
        console.error("Gemini API Error:", error);
        return {
            status: 'FAIL',
            reason: "The Guardian is currently offline (API Error). Try again later."
        };
    }
};

export const validateHabitWithGemini = async (
    habitName: string,
    frequency: string
): Promise<GuardianResponse> => {

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

    if (!apiKey) {
        console.warn("VITE_GEMINI_API_KEY not found. Using fallback mock.");
        return new Promise(resolve => setTimeout(() => resolve(MOCK_RESPONSE), 1500));
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp", generationConfig: { responseMimeType: "application/json" } });

        const prompt = `
        You are The Habit Guardian. Enforce the user's 3 NORTH STARS.
        
        THE NORTH STARS:
        1. FINANCIAL: $10K/Month.
        2. HEALTH: Gym/Fitness.
        3. SKILL: Fluent English.

        HABIT PROPOSAL: "${habitName}"
        FREQUENCY: ${frequency}

        CRITERIA:
        - PASS: Does this directly build habits for Wealth, Health, or English?
        - FAIL: If it's "Watch TV", "Gaming", or unrelated fluff.
        - FAIL: If it's vague (e.g. "Read" -> Fail, "Read English Book" -> Pass).

        OUTPUT FORMAT (JSON):
        {
        "status": "PASS" | "FAIL",
        "reason": "Short feedback. Which North Star does this serve?"
        }
        `;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        const data = JSON.parse(responseText) as GuardianResponse;

        return data;

    } catch (error) {
        console.error("Gemini API Error:", error);
        return {
            status: 'FAIL',
            reason: "The Guardian is offline. Try again."
        };
    }
};
