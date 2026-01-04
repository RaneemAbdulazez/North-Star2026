import React from 'react';
import { createRoot } from 'react-dom/client';
import { Bubble } from './Bubble';
import { isValidContext } from '../utils/chrome';
// @ts-ignore
import styles from '../index.css?inline'; // Capture styles as string for Shadow DOM injection

// ID for our host element
const HOST_ID = 'northstar-bubble-host';

console.log("NorthStar Bubble Script Loaded 🚀");

function init() {
    // 1. Sandbox/Iframe Proctection: Only inject in top window
    if (window.self !== window.top) {
        return;
    }

    // 2. Context Safety
    if (!isValidContext()) {
        return;
    }

    // 3. Asynchronous Injection (Performance Optimization)
    // Wait for the browser to be idle before injecting to avoid render blocking.
    const startInjection = () => {
        // Double Check Context before acting after delay
        if (!isValidContext() || !chrome.runtime?.id) return;

        console.log("NorthStar Bubble: Initializing...");

        // Check if already injected
        if (document.getElementById(HOST_ID)) {
            return;
        }

        // Create Host Element
        const host = document.createElement('div');
        host.id = HOST_ID;
        host.style.position = 'fixed';
        host.style.top = '0px';
        host.style.left = '0px';
        host.style.zIndex = '2147483647'; // Max safely usable z-index (32-bit int)
        host.style.width = '0px';
        host.style.height = '0px';
        host.style.overflow = 'visible';
        document.body.appendChild(host);

        // Create Shadow DOM
        const shadow = host.attachShadow({ mode: 'open' });

        const styleSlot = document.createElement('style');
        styleSlot.textContent = styles + `
            :host { all: initial; }
            .northstar-bubble {
                position: fixed;
                bottom: 30px;
                right: 30px;
                width: 65px;
                height: 65px;
                background: rgba(10, 20, 50, 0.8);
                border: 2px solid #00f2ff;
                border-radius: 50%;
                z-index: 2147483647 !important;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 0 15px #00f2ff;
                cursor: move;
                font-family: sans-serif;
                color: #00f2ff;
                font-weight: bold;
                font-size: 14px;
            }
        `;
        shadow.appendChild(styleSlot);

        console.log("BUBBLE_INJECTED");

        // Create Root for React
        const rootDiv = document.createElement('div');
        rootDiv.id = 'northstar-root';
        shadow.appendChild(rootDiv);

        // Mount React
        const root = createRoot(rootDiv);
        root.render(
            <React.StrictMode>
                <Bubble />
            </React.StrictMode>
        );
    };

    // Use requestIdleCallback if available, fallback to setTimeout
    if ('requestIdleCallback' in window) {
        window.requestIdleCallback(() => {
            // Additional small delay to be safe
            setTimeout(startInjection, 1500);
        }, { timeout: 5000 });
    } else {
        setTimeout(startInjection, 2000);
    }
}

// Initial run
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
