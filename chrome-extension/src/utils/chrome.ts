// Utility to check if the extension context is still valid.
export const isValidContext = (): boolean => {
    try {
        // Paranoid check for orphaned content scripts
        if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
            return false;
        }
        return true;
    } catch (e) {
        return false;
    }
};

/**
 * Safely sends a message to the background script.
 * Swallows "Context invalidated" errors silently.
 */
export const safeSendMessage = <T = any>(message: any): Promise<T | null> => {
    return new Promise((resolve) => {
        if (!isValidContext()) {
            resolve(null);
            return;
        }

        try {
            chrome.runtime.sendMessage(message, (response) => {
                // Callback might run in a context that is partially invalidated
                try {
                    // Check if runtime still exists inside callback
                    if (typeof chrome === 'undefined' || !chrome.runtime) {
                        resolve(null);
                        return;
                    }

                    const lastError = chrome.runtime.lastError;
                    if (lastError) {
                        // Suppress specific errors
                        if (lastError.message?.includes("Extension context invalidated")) {
                            // Valid suppression
                        } else {
                            // console.warn("NorthStar Runtime Error:", lastError.message);
                        }
                        resolve(null);
                    } else {
                        resolve(response);
                    }
                } catch (innerErr) {
                    // console.debug("Callback failed (orphaned):", innerErr);
                    resolve(null);
                }
            });
        } catch (e) {
            // Context likely invalidated synchronously during call
            resolve(null);
        }
    });
};
