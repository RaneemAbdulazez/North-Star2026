/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./popup.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                background: "#0e1117", // Streamlit dark
                secondary: "#262730",
                primary: "#ff4b4b", // Streamlit red
                text: "#fafafa"
            }
        },
    },
    plugins: [],
}
