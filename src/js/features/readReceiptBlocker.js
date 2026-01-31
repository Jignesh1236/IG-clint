// Wrap in an IIFE to avoid leaking globals into the page scope
(() => {
    let isEnabled = false;

    chrome.storage.local.get(['readReceiptBlocker'], (result) => {
        isEnabled = result.readReceiptBlocker !== undefined ? result.readReceiptBlocker : false;
        if (isEnabled) {
            initReadReceiptBlocker();
        }
    });

    chrome.storage.onChanged.addListener((changes) => {
        if (changes.readReceiptBlocker) {
            isEnabled = changes.readReceiptBlocker.newValue;
            // Notify background script to update network rules
            chrome.runtime.sendMessage({
                type: 'read_receipt',
                active: isEnabled
            });
            if (isEnabled) {
                initReadReceiptBlocker();
            } else {
                cleanup();
            }
        }
    });
    
    // Notify background script on init
    if (isEnabled) {
        chrome.runtime.sendMessage({
            type: 'read_receipt',
            active: true
        });
    }

    function initReadReceiptBlocker() {
        if (!isEnabled) return;
        
        // Block read receipt API calls via fetch interception
        interceptFetchRequests();
        
        // Block read receipt API calls via XHR interception
        interceptXHRRequests();
        
        // Remove "seen" indicators from UI
        removeSeenIndicators();
        
        // Monitor for new messages and remove seen indicators
        const observer = new MutationObserver(() => {
            removeSeenIndicators();
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
    }

    let fetchIntercepted = false;
    
    function interceptFetchRequests() {
        if (fetchIntercepted) return;
        fetchIntercepted = true;
        
        const originalFetch = window.fetch;
        
        window.fetch = function(...args) {
            const url = args[0];
            let urlString = '';
            
            if (typeof url === 'string') {
                urlString = url;
            } else if (url instanceof Request) {
                urlString = url.url;
            } else if (url && url.url) {
                urlString = url.url;
            }
            
            // Block read receipt endpoints
            if (urlString && isReadReceiptEndpoint(urlString)) {
                console.log('[Read Receipt Blocker] Blocked fetch request:', urlString);
                // Return a fake successful response
                return Promise.resolve(new Response(JSON.stringify({ status: 'ok' }), {
                    status: 200,
                    statusText: 'OK',
                    headers: { 'Content-Type': 'application/json' }
                }));
            }
            
            return originalFetch.apply(this, args);
        };
    }

    let xhrIntercepted = false;
    
    function interceptXHRRequests() {
        if (xhrIntercepted) return;
        xhrIntercepted = true;
        
        const originalOpen = XMLHttpRequest.prototype.open;
        const originalSend = XMLHttpRequest.prototype.send;
        
        XMLHttpRequest.prototype.open = function(method, url, ...rest) {
            this._url = url;
            return originalOpen.apply(this, [method, url, ...rest]);
        };
        
        XMLHttpRequest.prototype.send = function(...args) {
            if (this._url && isReadReceiptEndpoint(this._url)) {
                console.log('[Read Receipt Blocker] Blocked XHR request:', this._url);
                // Simulate success without actually sending
                setTimeout(() => {
                    try {
                        Object.defineProperty(this, 'status', { value: 200, writable: false, configurable: true });
                        Object.defineProperty(this, 'readyState', { value: 4, writable: false, configurable: true });
                        Object.defineProperty(this, 'responseText', { value: JSON.stringify({ status: 'ok' }), writable: false, configurable: true });
                        Object.defineProperty(this, 'response', { value: JSON.stringify({ status: 'ok' }), writable: false, configurable: true });
                        
                        if (this.onreadystatechange) {
                            this.onreadystatechange();
                        }
                        if (this.onload) {
                            this.onload();
                        }
                    } catch (e) {
                        console.error('[Read Receipt Blocker] Error blocking XHR:', e);
                    }
                }, 0);
                return;
            }
            
            return originalSend.apply(this, args);
        };
    }

    function isReadReceiptEndpoint(url) {
        if (!url) return false;
        
        const readReceiptPatterns = [
            /\/api\/v1\/direct_v2\/threads\/.*\/items\/.*\/seen/,
            /\/api\/v1\/direct_v2\/threads\/.*\/seen/,
            /\/api\/v1\/direct_v2\/threads\/.*\/items\/.*\/mark_seen/,
            /\/api\/v1\/direct_v2\/threads\/.*\/mark_seen/,
            /direct_v2\/threads\/.*\/items\/.*\/seen/,
            /direct_v2\/threads\/.*\/seen/,
            /threads\/.*\/items\/.*\/seen/,
            /threads\/.*\/seen/,
            /mark_seen/,
            /mark.*seen/
        ];
        
        return readReceiptPatterns.some(pattern => pattern.test(url));
    }

    function removeSeenIndicators() {
        // Find elements containing "Seen" text
        const allElements = document.querySelectorAll('span, div, p, button');
        allElements.forEach(el => {
            if (el.dataset.igReadReceiptHidden === 'true') return;
            
            const text = el.textContent.trim().toLowerCase();
            if (text === 'seen' || text === 'seen by' || text.startsWith('seen')) {
                // Check if it's a seen indicator (usually small text or in dialog)
                const style = window.getComputedStyle(el);
                const fontSize = parseInt(style.fontSize);
                const isInDialog = el.closest('[role="dialog"]');
                
                if (fontSize < 14 || isInDialog || text === 'seen') {
                    el.style.display = 'none';
                    el.dataset.igReadReceiptHidden = 'true';
                }
            }
        });
        
        // Remove seen checkmarks/icons by aria-label
        const seenIcons = document.querySelectorAll('[aria-label]');
        seenIcons.forEach(icon => {
            if (icon.dataset.igReadReceiptHidden === 'true') return;
            
            const ariaLabel = icon.getAttribute('aria-label').toLowerCase();
            if ((ariaLabel.includes('seen') || ariaLabel.includes('read')) && 
                !ariaLabel.includes('unseen') && !ariaLabel.includes('unread')) {
                icon.style.display = 'none';
                icon.dataset.igReadReceiptHidden = 'true';
            }
        });
        
        // Remove "Seen" badges from message bubbles
        const messageBubbles = document.querySelectorAll('[role="dialog"] span, [role="dialog"] div');
        messageBubbles.forEach(bubble => {
            if (bubble.dataset.igReadReceiptHidden === 'true') return;
            
            const text = bubble.textContent.trim().toLowerCase();
            if (text === 'seen' || text.startsWith('seen')) {
                bubble.style.display = 'none';
                bubble.dataset.igReadReceiptHidden = 'true';
            }
        });
    }

    function cleanup() {
        // Restore original fetch if we modified it
        // Note: This is tricky because we can't easily restore it
        // The feature will remain active until page reload
        
        // Show hidden elements
        document.querySelectorAll('[data-ig-read-receipt-hidden="true"]').forEach(el => {
            el.style.display = '';
            el.removeAttribute('data-ig-read-receipt-hidden');
        });
    }
})();
