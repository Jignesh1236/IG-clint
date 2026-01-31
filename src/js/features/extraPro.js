// Wrap in an IIFE to avoid leaking globals into the page scope
(() => {
    let settings = {
        verifiedBadge: true,
        customTheme: 'none',
        darkModeSync: false,
        customThemeColors: {
            primaryBg: '',
            secondaryBg: '',
            primaryText: '',
            secondaryText: '',
            accent: ''
        }
    };

    chrome.storage.local.get(['verifiedBadge', 'customTheme', 'darkModeSync', 'customThemeColors'], (result) => {
        settings.verifiedBadge = result.verifiedBadge !== undefined ? result.verifiedBadge : true;
        settings.customTheme = result.customTheme !== undefined ? result.customTheme : 'none';
        settings.darkModeSync = result.darkModeSync !== undefined ? result.darkModeSync : false;
        settings.customThemeColors = result.customThemeColors || settings.customThemeColors;
        applySettings();
    });

    chrome.storage.onChanged.addListener((changes) => {
        if (changes.verifiedBadge) settings.verifiedBadge = changes.verifiedBadge.newValue;
        if (changes.customTheme) settings.customTheme = changes.customTheme.newValue;
        if (changes.darkModeSync) settings.darkModeSync = changes.darkModeSync.newValue;
        if (changes.customThemeColors) settings.customThemeColors = changes.customThemeColors.newValue;
        applySettings();
    });

    function applySettings() {
        applyVerifiedBadge();
        applyTheme();
    }

    function getCurrentUsername() {
        const excludedPaths = ['explore', 'direct', 'accounts', 'reels', 'stories', 'p', 'tv', 'reel'];
        
        // Method 1: Get from profile picture link (most reliable)
        const profilePicLinks = document.querySelectorAll('a[href*="/"] img[alt*="@"]');
        for (const link of profilePicLinks) {
            const parent = link.closest('a');
            if (parent) {
                const href = parent.getAttribute('href');
                if (href) {
                    const match = href.match(/\/([^\/]+)\/?$/);
                    if (match && match[1] && !excludedPaths.includes(match[1])) {
                        return match[1];
                    }
                }
            }
        }
        
        // Method 2: Get from navigation profile link (bottom nav on mobile, side nav on desktop)
        const navProfileLinks = document.querySelectorAll('nav a[href*="/"], a[role="link"][href*="/"]');
        for (const link of navProfileLinks) {
            const href = link.getAttribute('href');
            if (href && href.startsWith('/')) {
                const match = href.match(/\/([^\/]+)\/?$/);
                if (match && match[1] && !excludedPaths.includes(match[1])) {
                    // Verify it's a profile link (has image or specific structure)
                    const hasProfileImg = link.querySelector('img') || link.querySelector('svg');
                    if (hasProfileImg || link.closest('nav')) {
                        return match[1];
                    }
                }
            }
        }
        
        // Method 3: Get from header profile section (profile page)
        const headerLinks = document.querySelectorAll('header a[href*="/"]');
        for (const link of headerLinks) {
            const href = link.getAttribute('href');
            if (href && href.startsWith('/')) {
                const match = href.match(/\/([^\/]+)\/?$/);
                if (match && match[1] && !excludedPaths.includes(match[1])) {
                    const text = link.textContent.trim();
                    // If text matches href username, it's likely the profile
                    if (text === match[1] || text.length < 31) {
                        return match[1];
                    }
                }
            }
        }
        
        // Method 4: Get from header text (profile page username)
        const headerText = document.querySelector('header section h1, header section h2');
        if (headerText) {
            const text = headerText.textContent.trim();
            if (text && !text.includes(' ') && text.length > 0 && text.length < 31 && !excludedPaths.includes(text)) {
                return text;
            }
        }
        
        // Method 5: Try to get from React fiber (if available)
        try {
            const reactFiber = document.querySelector('header')?._reactInternalFiber || 
                             document.querySelector('header')?._reactInternalInstance ||
                             document.querySelector('nav')?._reactInternalFiber;
            if (reactFiber) {
                let fiber = reactFiber;
                for (let i = 0; i < 30 && fiber; i++) {
                    if (fiber.memoizedProps?.username) {
                        return fiber.memoizedProps.username;
                    }
                    if (fiber.memoizedState?.username) {
                        return fiber.memoizedState.username;
                    }
                    if (fiber.memoizedProps?.href) {
                        const match = fiber.memoizedProps.href.match(/\/([^\/]+)\/?$/);
                        if (match && match[1] && !excludedPaths.includes(match[1])) {
                            return match[1];
                        }
                    }
                    fiber = fiber.return || fiber.child || fiber.sibling;
                }
            }
        } catch (e) {
            // Ignore React fiber access errors
        }
        
        // Method 6: Try to get from localStorage/sessionStorage (Instagram stores user data)
        try {
            const sharedData = window._sharedData || window.__additionalData;
            if (sharedData?.config?.viewer?.username) {
                return sharedData.config.viewer.username;
            }
        } catch (e) {
            // Ignore
        }
        
        return null;
    }

    let verifiedBadgeObserver = null;
    let currentVerifiedUsername = null;

    function applyVerifiedBadge() {
        // Clean up existing badges and observer
        document.querySelectorAll('.ig-custom-verified').forEach(el => el.remove());
        if (verifiedBadgeObserver) {
            verifiedBadgeObserver.disconnect();
            verifiedBadgeObserver = null;
        }

        if (!settings.verifiedBadge) {
            return;
        }

        // Get username with retry
        function tryAddBadges() {
            currentVerifiedUsername = getCurrentUsername();
            if (currentVerifiedUsername) {
                addVerifiedBadges(currentVerifiedUsername);
            } else {
                // Retry after delay
                setTimeout(tryAddBadges, 1000);
            }
        }

        tryAddBadges();

        // Set up observer for dynamic content
        verifiedBadgeObserver = new MutationObserver(() => {
            if (!settings.verifiedBadge) return;

            // Update username periodically in case it changes
            const newUsername = getCurrentUsername();
            if (newUsername && newUsername !== currentVerifiedUsername) {
                currentVerifiedUsername = newUsername;
            }

            if (currentVerifiedUsername) {
                addVerifiedBadges(currentVerifiedUsername);
            }
        });

        verifiedBadgeObserver.observe(document.body, { childList: true, subtree: true });
    }

    function addVerifiedBadges(username) {
        if (!username) return;

        // More targeted selectors for username locations
        const usernameSelectors = [
            // Profile page username
            'header section h1',
            'header section h2',
            // Post author
            'article header a[href*="/"]',
            'article header span',
            // Comments
            'article ul li a[href*="/"]',
            'article ul li span',
            // Story author
            'section header a[href*="/"]',
            // Direct messages
            'div[role="dialog"] header a[href*="/"]',
            // Navigation
            'nav a[href*="/"]'
        ];

        usernameSelectors.forEach(selector => {
            try {
                const elements = document.querySelectorAll(selector);
                elements.forEach(el => {
                    // Skip if already has badge
                    if (el.querySelector('.ig-custom-verified')) return;
                    
                    const text = el.textContent.trim();
                    const href = el.getAttribute('href');
                    
                    // Check if this is the username
                    const isUsername = text === username || 
                                      (href && href.includes('/' + username + '/')) ||
                                      (href && href.match(new RegExp(`^/${username}/?$`)));
                    
                    if (isUsername && text.length < 31) {
                        // Don't add to header navigation (already visible)
                        if (el.closest('nav') && !el.closest('article')) return;
                        
                        // Add badge
                        const badge = createVerifiedBadge();
                        
                        // Insert after text, not as child if it's a link
                        if (el.tagName === 'A' && el.firstChild) {
                            el.insertBefore(badge, el.firstChild.nextSibling);
                        } else {
                            el.appendChild(badge);
                        }
                    }
                });
            } catch (e) {
                // Ignore selector errors
            }
        });

        // Also check for username text in spans/divs (for comments, etc.)
        const textElements = document.querySelectorAll('span, div, p');
        textElements.forEach(el => {
            if (el.querySelector('.ig-custom-verified')) return;
            if (el.closest('header')) return; // Skip header
            
            const text = el.textContent.trim();
            
            // Only match exact username or username at start/end
            if (text === username || 
                text.match(new RegExp(`^${username}\\s`)) ||
                text.match(new RegExp(`\\s${username}$`))) {
                
                // Make sure it's not too long (probably not just username)
                if (text.length <= username.length + 5) {
                    const badge = createVerifiedBadge();
                    el.appendChild(badge);
                }
            }
        });
    }

    function createVerifiedBadge() {
        const badge = document.createElement('span');
        badge.className = 'ig-custom-verified';
        badge.innerHTML = `
            <svg aria-label="Verified" color="rgb(0, 149, 246)" fill="rgb(0, 149, 246)" height="12" role="img" viewBox="0 0 40 40" width="12" style="vertical-align: middle;">
                <path d="M19.998 3.094c-2.51 0-4.92 1.117-6.603 3.064l-2.032 2.356-2.998.469c-2.585.404-4.661 2.48-5.065 5.065l-.47 2.997-2.355 2.033c-1.947 1.682-3.064 4.093-3.064 6.603 0 2.51 1.117 4.92 3.064 6.603l2.356 2.032.469 2.998c.404 2.585 2.48 4.661 5.065 5.065l2.997.47 2.033 2.355c1.682 1.947 4.093 3.064 6.603 3.064 2.51 0 4.92-1.117 6.603-3.064l2.032-2.356 2.998-.469c2.585-.404 4.661-2.48 5.065-5.065l.47-2.997 2.355-2.033c1.947-1.682 3.064-4.093 3.064-6.603 0-2.51-1.117-4.92-3.064-6.603l-2.356-2.032-.469-2.998c-.404-2.585-2.48-4.661-5.065-5.065l-2.997-.47-2.033-2.355c-1.682-1.947-4.093-3.064-6.603-3.064z" fill-rule="evenodd"></path>
                <path d="M18.813 26.232l-7.33-7.147 2.858-2.93 4.472 4.36 9.44-9.213 2.858 2.93z" fill-rule="evenodd" fill="white"></path>
            </svg>
        `;
        badge.style.cssText = `
            margin-left: 4px;
            display: inline-flex;
            align-items: center;
            vertical-align: middle;
            line-height: 1;
        `;
        return badge;
    }

    function detectInstagramDarkMode() {
        // Check if Instagram's dark mode is active
        const htmlElement = document.documentElement;
        const computedStyle = window.getComputedStyle(htmlElement);
        const bgColor = computedStyle.backgroundColor;
        
        // Parse RGB values
        const rgbMatch = bgColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (!rgbMatch) return false;
        
        const r = parseInt(rgbMatch[1]);
        const g = parseInt(rgbMatch[2]);
        const b = parseInt(rgbMatch[3]);
        
        // Dark mode typically has low RGB values (< 50)
        return (r + g + b) < 150;
    }

    function getInstagramThemeColors() {
        const root = document.documentElement;
        const computedStyle = window.getComputedStyle(root);
        
        return {
            primaryBg: computedStyle.getPropertyValue('--ig-primary-background') || '0, 0, 0',
            secondaryBg: computedStyle.getPropertyValue('--ig-secondary-background') || '18, 18, 18',
            primaryText: computedStyle.getPropertyValue('--ig-primary-text') || '255, 255, 255',
            secondaryText: computedStyle.getPropertyValue('--ig-secondary-text') || '168, 168, 168',
            accent: computedStyle.getPropertyValue('--ig-link') || '0, 149, 246'
        };
    }

    function applyTheme() {
        const existingTheme = document.getElementById('ig-custom-theme');
        if (existingTheme) existingTheme.remove();

        if (settings.customTheme === 'none' && !settings.darkModeSync && !hasCustomColors()) {
            return;
        }

        let themeCSS = '';

        // Sync with Instagram's dark mode
        if (settings.darkModeSync && detectInstagramDarkMode()) {
            const igColors = getInstagramThemeColors();
            themeCSS = `
                :root {
                    --ig-primary-background: ${igColors.primaryBg} !important;
                    --ig-secondary-background: ${igColors.secondaryBg} !important;
                    --ig-primary-text: ${igColors.primaryText} !important;
                    --ig-secondary-text: ${igColors.secondaryText} !important;
                    --ig-link: ${igColors.accent} !important;
                }
            `;
        }
        // Apply custom theme colors if set
        else if (hasCustomColors()) {
            const colors = settings.customThemeColors;
            themeCSS = `
                :root {
                    ${colors.primaryBg ? `--ig-primary-background: ${colors.primaryBg} !important;` : ''}
                    ${colors.secondaryBg ? `--ig-secondary-background: ${colors.secondaryBg} !important;` : ''}
                    ${colors.primaryText ? `--ig-primary-text: ${colors.primaryText} !important;` : ''}
                    ${colors.secondaryText ? `--ig-secondary-text: ${colors.secondaryText} !important;` : ''}
                    ${colors.accent ? `--ig-link: ${colors.accent} !important;` : ''}
                }
            `;
        }
        // Apply preset themes
        else if (settings.customTheme !== 'none') {
            const themes = {
                'midnight': `
                :root {
                    --ig-primary-background: 0, 0, 0 !important;
                    --ig-secondary-background: 18, 18, 18 !important;
                    --ig-primary-text: 255, 255, 255 !important;
                    --ig-secondary-text: 168, 168, 168 !important;
                    --ig-link: 0, 149, 246 !important;
                }
                body { background-color: #000 !important; color: #fff !important; }
            `,
                'pastel': `
                :root {
                    --ig-primary-background: 255, 240, 245 !important;
                    --ig-secondary-background: 255, 228, 225 !important;
                    --ig-primary-text: 72, 61, 139 !important;
                    --ig-secondary-text: 119, 136, 153 !important;
                }
                body { background-color: #fff0f5 !important; }
            `
            };
            themeCSS = themes[settings.customTheme] || '';
        }

        if (themeCSS) {
            const style = document.createElement('style');
            style.id = 'ig-custom-theme';
            style.textContent = themeCSS;
            document.head.appendChild(style);
        }

        // Update display container dark mode class
        const displayContainer = document.querySelector('.display-container');
        if (displayContainer) {
            if (settings.darkModeSync && detectInstagramDarkMode()) {
                displayContainer.classList.add('dark');
            } else if (settings.customTheme === 'midnight' || (hasCustomColors() && isDarkTheme())) {
                displayContainer.classList.add('dark');
            } else {
                displayContainer.classList.remove('dark');
            }
        }
    }

    function hasCustomColors() {
        const colors = settings.customThemeColors;
        return !!(colors.primaryBg || colors.secondaryBg || colors.primaryText || colors.secondaryText || colors.accent);
    }

    function isDarkTheme() {
        const colors = settings.customThemeColors;
        if (!colors.primaryBg) return false;
        const rgb = colors.primaryBg.split(',').map(v => parseInt(v.trim()));
        if (rgb.length !== 3) return false;
        return (rgb[0] + rgb[1] + rgb[2]) < 150;
    }

    // Watch for Instagram theme changes
    let themeObserver = null;
    chrome.storage.onChanged.addListener((changes) => {
        if (changes.darkModeSync) {
            if (changes.darkModeSync.newValue) {
                if (!themeObserver) {
                    themeObserver = new MutationObserver(() => {
                        applyTheme();
                    });
                    themeObserver.observe(document.documentElement, {
                        attributes: true,
                        attributeFilter: ['class', 'style']
                    });
                }
            } else {
                if (themeObserver) {
                    themeObserver.disconnect();
                    themeObserver = null;
                }
            }
        }
    });
    
    // Initialize observer if darkModeSync is enabled
    if (settings.darkModeSync) {
        themeObserver = new MutationObserver(() => {
            applyTheme();
        });
        themeObserver.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class', 'style']
        });
    }
})();
