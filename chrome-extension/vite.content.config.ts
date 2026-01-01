import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// Separate build config for Content Script to ensure it is bundled as a single file (IIFE/UMD)
// and does not use ES modules which break in Chrome Content Scripts.
export default defineConfig({
    plugins: [react()],
    build: {
        outDir: 'dist',
        emptyOutDir: false, // Don't wipe the popup build
        cssCodeSplit: true, // Prevent automatic CSS injection into JS
        rollupOptions: {
            input: {
                content: resolve(__dirname, 'src/content/index.tsx'),
            },
            output: {
                entryFileNames: 'assets/[name].js',
                format: 'iife', // Immediately Invoked Function Expression
                name: 'NorthStarContent', // Global variable name (required for IIFE)
                extend: true,
                inlineDynamicImports: true, // Forces everything into one file
            }
        }
    },
    define: {
        'process.env.NODE_ENV': JSON.stringify('production'),
    }
})
