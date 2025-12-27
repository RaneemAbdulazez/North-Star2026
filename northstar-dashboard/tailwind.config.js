/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                background: "#020617", // Deep Navy
                surface: "rgba(15, 23, 42, 0.4)", // Midnight Blue Glass
                primary: "#60a5fa", // Neon Blue
                secondary: "#1e293b",
                border: "rgba(96, 165, 250, 0.1)", // Blue hint
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
            },
            boxShadow: {
                'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
                'glow': '0 0 20px rgba(96, 165, 250, 0.25)',
                'glow-intense': '0 0 30px rgba(96, 165, 250, 0.5)',
            },
            backgroundImage: {
                'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
            },
        },
    },
    plugins: [],
}
