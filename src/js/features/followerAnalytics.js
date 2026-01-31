// Wrap in an IIFE to avoid leaking globals into the page scope
(() => {
    let isEnabled = false;
    let currentUsername = null;
    let followerData = {};

    chrome.storage.local.get(['followerAnalytics'], (result) => {
        isEnabled = result.followerAnalytics !== undefined ? result.followerAnalytics : false;
        if (isEnabled) {
            initFollowerAnalytics();
        }
    });

    chrome.storage.onChanged.addListener((changes) => {
        if (changes.followerAnalytics) {
            isEnabled = changes.followerAnalytics.newValue;
            if (isEnabled) {
                initFollowerAnalytics();
            } else {
                cleanup();
            }
        }
    });

    function initFollowerAnalytics() {
        if (!isEnabled) return;
        
        // Get current username from profile
        updateCurrentUsername();
        
        // Track followers on profile page
        if (window.location.pathname.match(/^\/[^\/]+$/)) {
            trackFollowers();
        }
        
        // Monitor for navigation changes
        let lastPath = window.location.pathname;
        const observer = new MutationObserver(() => {
            const currentPath = window.location.pathname;
            if (currentPath !== lastPath) {
                lastPath = currentPath;
                updateCurrentUsername();
                if (currentPath.match(/^\/[^\/]+$/)) {
                    setTimeout(trackFollowers, 1000);
                }
            }
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
        
        // Listen for popstate (back/forward navigation)
        window.addEventListener('popstate', () => {
            setTimeout(() => {
                updateCurrentUsername();
                if (window.location.pathname.match(/^\/[^\/]+$/)) {
                    trackFollowers();
                }
            }, 500);
        });
    }

    function updateCurrentUsername() {
        // Try to get username from URL
        const pathMatch = window.location.pathname.match(/^\/([^\/]+)/);
        if (pathMatch) {
            currentUsername = pathMatch[1];
        } else {
            // Try to get from profile header
            const profileHeader = document.querySelector('header section h2, header section h1');
            if (profileHeader) {
                currentUsername = profileHeader.textContent.trim();
            }
        }
    }

    async function trackFollowers() {
        if (!currentUsername) {
            // Try to get username again
            updateCurrentUsername();
            if (!currentUsername) return;
        }
        
        try {
            // Wait a bit for page to load
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Get follower count from page - try multiple selectors
            let followerCountElement = null;
            const possibleSelectors = [
                'a[href*="/followers/"] span',
                'a[href*="/followers/"]',
                'a[href*="followers"] span',
                'a[href*="followers"]',
                'section ul li a[href*="followers"] span',
                'section ul li a[href*="followers"]'
            ];
            
            for (const selector of possibleSelectors) {
                followerCountElement = document.querySelector(selector);
                if (followerCountElement) {
                    const text = followerCountElement.textContent.trim();
                    if (text && (text.match(/\d/) || text.includes('K') || text.includes('M'))) {
                        break;
                    }
                }
            }
            
            if (!followerCountElement) {
                // Try to find by text content
                const allLinks = document.querySelectorAll('a[href*="followers"]');
                for (const link of allLinks) {
                    const spans = link.querySelectorAll('span');
                    for (const span of spans) {
                        const text = span.textContent.trim();
                        if (text && (text.match(/\d/) || text.includes('K') || text.includes('M'))) {
                            followerCountElement = span;
                            break;
                        }
                    }
                    if (followerCountElement) break;
                }
            }
            
            if (!followerCountElement) return;
            
            let followerText = followerCountElement.textContent.trim();
            // Handle formats like "1,234" or "1.2M"
            let followerCount = parseFollowerCount(followerText);
            
            if (!followerCount) return;
            
            const timestamp = Date.now();
            const storageKey = `followerData_${currentUsername}`;
            
            // Get existing data
            chrome.storage.local.get([storageKey], (result) => {
                const existingData = result[storageKey] || { history: [], lastUpdate: 0 };
                
                // Only update if count changed or it's been more than 1 hour
                const timeSinceLastUpdate = timestamp - existingData.lastUpdate;
                const shouldUpdate = existingData.lastCount !== followerCount || timeSinceLastUpdate > 3600000;
                
                if (shouldUpdate) {
                    existingData.history.push({
                        count: followerCount,
                        timestamp: timestamp,
                        date: new Date(timestamp).toISOString()
                    });
                    
                    // Keep only last 30 days of data
                    const thirtyDaysAgo = timestamp - (30 * 24 * 60 * 60 * 1000);
                    existingData.history = existingData.history.filter(entry => entry.timestamp > thirtyDaysAgo);
                    
                    existingData.lastCount = followerCount;
                    existingData.lastUpdate = timestamp;
                    
                    const previousCount = existingData.lastCount;
                    existingData.lastCount = followerCount;
                    existingData.lastUpdate = timestamp;
                    
                    // Calculate changes
                    if (previousCount !== null && previousCount !== undefined) {
                        existingData.change = followerCount - previousCount;
                    } else {
                        existingData.change = 0;
                    }
                    
                    chrome.storage.local.set({ [storageKey]: existingData }, () => {
                        // Display analytics badge
                        displayAnalyticsBadge(existingData);
                    });
                } else if (existingData.change !== undefined) {
                    // Still display badge even if not updating
                    displayAnalyticsBadge(existingData);
                }
            });
        } catch (error) {
            console.error('Error tracking followers:', error);
        }
    }

    function parseFollowerCount(text) {
        if (!text) return null;
        
        // Remove commas and spaces, convert to uppercase
        text = text.replace(/,/g, '').trim().toUpperCase();
        
        // Handle "M" for millions
        if (text.includes('M')) {
            const num = parseFloat(text.replace(/[^0-9.]/g, ''));
            if (!isNaN(num)) {
                return Math.round(num * 1000000);
            }
        }
        
        // Handle "K" for thousands
        if (text.includes('K')) {
            const num = parseFloat(text.replace(/[^0-9.]/g, ''));
            if (!isNaN(num)) {
                return Math.round(num * 1000);
            }
        }
        
        // Handle "B" for billions
        if (text.includes('B')) {
            const num = parseFloat(text.replace(/[^0-9.]/g, ''));
            if (!isNaN(num)) {
                return Math.round(num * 1000000000);
            }
        }
        
        // Regular number - extract digits only
        const num = parseInt(text.replace(/[^0-9]/g, ''));
        return isNaN(num) ? null : num;
    }

    function displayAnalyticsBadge(data) {
        // Remove existing badge
        const existingBadge = document.getElementById('ig-follower-analytics-badge');
        if (existingBadge) {
            existingBadge.remove();
        }
        
        if (data.change === undefined || data.change === null) return;
        
        // Try multiple selectors to find follower link
        let followerLink = document.querySelector('a[href*="/followers/"]') || 
                          document.querySelector('a[href*="followers"]');
        
        if (!followerLink) {
            // Try to find by text
            const allLinks = document.querySelectorAll('a');
            for (const link of allLinks) {
                if (link.href && link.href.includes('followers')) {
                    followerLink = link;
                    break;
                }
            }
        }
        
        if (!followerLink) return;
        
        const badge = document.createElement('span');
        badge.id = 'ig-follower-analytics-badge';
        badge.style.cssText = `
            margin-left: 8px;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
            background: ${data.change > 0 ? '#4CAF50' : data.change < 0 ? '#F44336' : '#9E9E9E'};
            color: white;
            display: inline-block;
        `;
        
        const changeText = data.change > 0 ? `+${formatNumber(data.change)}` : `${formatNumber(data.change)}`;
        badge.textContent = changeText;
        badge.title = `Change since last check. Total: ${formatNumber(data.lastCount || 0)}`;
        
        followerLink.appendChild(badge);
    }
    
    function formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    function cleanup() {
        const badge = document.getElementById('ig-follower-analytics-badge');
        if (badge) badge.remove();
    }
})();
