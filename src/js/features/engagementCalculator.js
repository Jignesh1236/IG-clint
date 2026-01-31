// Wrap in an IIFE to avoid leaking globals into the page scope
(() => {
    let isEnabled = false;

    chrome.storage.local.get(['engagementCalculator'], (result) => {
        isEnabled = result.engagementCalculator !== undefined ? result.engagementCalculator : false;
        if (isEnabled) {
            initEngagementCalculator();
        }
    });

    chrome.storage.onChanged.addListener((changes) => {
        if (changes.engagementCalculator) {
            isEnabled = changes.engagementCalculator.newValue;
            if (isEnabled) {
                initEngagementCalculator();
            } else {
                cleanup();
            }
        }
    });

    function initEngagementCalculator() {
        if (!isEnabled) return;
        
        // Calculate engagement for posts on current page
        calculateEngagementForVisiblePosts();
        
        // Monitor for new posts loading
        const observer = new MutationObserver(() => {
            calculateEngagementForVisiblePosts();
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
        
        // Also listen for navigation
        let lastPath = window.location.pathname;
        const pathObserver = new MutationObserver(() => {
            const currentPath = window.location.pathname;
            if (currentPath !== lastPath) {
                lastPath = currentPath;
                setTimeout(calculateEngagementForVisiblePosts, 1000);
            }
        });
        
        pathObserver.observe(document.body, { childList: true, subtree: true });
    }

    function calculateEngagementForVisiblePosts() {
        // Find all post containers - use more comprehensive selectors
        const postSelectors = [
            'article[role="presentation"]',
            'div[role="dialog"] article',
            'article._aatk',
            'article',
            'div[data-testid="post-container"]'
        ];
        
        let posts = new Set();
        postSelectors.forEach(selector => {
            try {
                const found = document.querySelectorAll(selector);
                found.forEach(post => {
                    // Only add if it looks like a post (has like/comment buttons or media)
                    if (post.querySelector('button[aria-label*="like" i], a[href*="/liked_by/"], a[href*="/comments/"]')) {
                        posts.add(post);
                    }
                });
            } catch (e) {
                // Ignore selector errors
            }
        });
        
        posts.forEach(post => {
            if (post.dataset.igEngagementCalculated === 'true') return;
            
            const engagementData = extractEngagementData(post);
            if (engagementData && (engagementData.likes > 0 || engagementData.comments > 0)) {
                displayEngagement(post, engagementData);
                post.dataset.igEngagementCalculated = 'true';
            }
        });
    }

    function extractEngagementData(postElement) {
        try {
            let likeCount = null;
            let commentCount = null;
            
            // Find like count - check multiple possible locations
            const allElements = postElement.querySelectorAll('span, button, a, div');
            for (const el of allElements) {
                const text = el.textContent.trim();
                const lowerText = text.toLowerCase();
                
                // Check for likes
                if ((lowerText.includes('like') || lowerText.includes('likes')) && !likeCount) {
                    // Try to extract number from text
                    const likeMatch = text.match(/([\d,\.]+)\s*(?:likes?|like)/i) || text.match(/([\d,\.]+)/);
                    if (likeMatch) {
                        const numStr = likeMatch[1].replace(/,/g, '');
                        const num = parseFloat(numStr);
                        if (!isNaN(num) && num > 0) {
                            // Handle K and M suffixes
                            if (text.includes('K') || text.includes('k')) {
                                likeCount = Math.round(num * 1000);
                            } else if (text.includes('M') || text.includes('m')) {
                                likeCount = Math.round(num * 1000000);
                            } else {
                                likeCount = Math.round(num);
                            }
                        }
                    }
                }
                
                // Check for comments
                if ((lowerText.includes('comment') || lowerText.includes('comments')) && !commentCount) {
                    const commentMatch = text.match(/([\d,\.]+)\s*(?:comments?|comment)/i) || text.match(/([\d,\.]+)/);
                    if (commentMatch) {
                        const numStr = commentMatch[1].replace(/,/g, '');
                        const num = parseFloat(numStr);
                        if (!isNaN(num) && num > 0) {
                            if (text.includes('K') || text.includes('k')) {
                                commentCount = Math.round(num * 1000);
                            } else if (text.includes('M') || text.includes('m')) {
                                commentCount = Math.round(num * 1000000);
                            } else {
                                commentCount = Math.round(num);
                            }
                        }
                    }
                }
                
                // Also check aria-labels
                const ariaLabel = el.getAttribute('aria-label');
                if (ariaLabel) {
                    const lowerAria = ariaLabel.toLowerCase();
                    if (lowerAria.includes('like') && !likeCount) {
                        const match = ariaLabel.match(/([\d,\.]+)/);
                        if (match) {
                            const num = parseFloat(match[1].replace(/,/g, ''));
                            if (!isNaN(num)) likeCount = Math.round(num);
                        }
                    }
                    if (lowerAria.includes('comment') && !commentCount) {
                        const match = ariaLabel.match(/([\d,\.]+)/);
                        if (match) {
                            const num = parseFloat(match[1].replace(/,/g, ''));
                            if (!isNaN(num)) commentCount = Math.round(num);
                        }
                    }
                }
                
                if (likeCount && commentCount) break;
            }
            
            // Try to get follower count for engagement rate calculation
            // This would require accessing profile data, so we'll skip it for now
            // and just show likes/comments ratio
            
            if (likeCount !== null || commentCount !== null) {
                return {
                    likes: likeCount || 0,
                    comments: commentCount || 0,
                    totalEngagement: (likeCount || 0) + (commentCount || 0)
                };
            }
            
            return null;
        } catch (error) {
            console.error('Error extracting engagement data:', error);
            return null;
        }
    }

    function displayEngagement(postElement, data) {
        // Remove existing badge if any
        const existingBadge = postElement.querySelector('.ig-engagement-badge');
        if (existingBadge) {
            existingBadge.remove();
        }
        
        // Calculate engagement ratio
        const engagementRatio = data.comments > 0 
            ? (data.likes / data.comments).toFixed(2) 
            : data.likes > 0 ? '∞' : '0';
        
        // Calculate engagement percentage (simplified - assumes average follower count)
        // For better accuracy, we'd need actual follower count
        const engagementRate = data.totalEngagement > 0 
            ? ((data.totalEngagement / 1000) * 100).toFixed(2) + '%'
            : '0%';
        
        // Find a good place to insert the badge (usually near like/comment buttons or after caption)
        let insertPoint = null;
        
        // Try to find the section with like/comment buttons
        const actionBar = postElement.querySelector('section[role="button"]') || 
                         postElement.querySelector('div[role="button"]') ||
                         postElement.querySelector('section');
        
        // Try to find caption area or post content area
        const captionArea = postElement.querySelector('h1, h2, span[dir="auto"]')?.closest('section') ||
                           postElement.querySelector('article > section:last-child');
        
        insertPoint = captionArea || actionBar || postElement.querySelector('section:last-child');
        
        if (!insertPoint) {
            // Fallback: insert at end of article
            insertPoint = postElement;
        }
        
        const badge = document.createElement('div');
        badge.className = 'ig-engagement-badge';
        badge.style.cssText = `
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 8px;
            padding: 6px 10px;
            margin: 8px 0;
            background: rgba(0, 149, 246, 0.1);
            border-radius: 8px;
            font-size: 11px;
            color: rgb(var(--ig-primary-text, 38, 38, 38));
            border: 1px solid rgba(0, 149, 246, 0.2);
            width: 100%;
            box-sizing: border-box;
        `;
        
        badge.innerHTML = `
            <span style="font-weight: 600;">📊 Engagement:</span>
            <span>Likes: ${formatNumber(data.likes)}</span>
            <span>Comments: ${formatNumber(data.comments)}</span>
            <span style="color: rgb(0, 149, 246); font-weight: 600;">Ratio: ${engagementRatio}</span>
        `;
        
        badge.title = `Total Engagement: ${formatNumber(data.totalEngagement)} | Likes/Comments Ratio: ${engagementRatio}`;
        
        // Insert after insertPoint or append to it
        if (insertPoint === postElement) {
            insertPoint.appendChild(badge);
        } else if (insertPoint.nextSibling) {
            insertPoint.parentNode.insertBefore(badge, insertPoint.nextSibling);
        } else {
            insertPoint.parentNode.appendChild(badge);
        }
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
        document.querySelectorAll('.ig-engagement-badge').forEach(badge => badge.remove());
        document.querySelectorAll('[data-ig-engagement-calculated]').forEach(post => {
            post.removeAttribute('data-ig-engagement-calculated');
        });
    }
})();
