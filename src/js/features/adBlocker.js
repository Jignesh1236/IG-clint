
let isAdBlockEnabled = true;

chrome.storage.local.get(['adBlock'], (result) => {
    isAdBlockEnabled = result.adBlock !== undefined ? result.adBlock : true;
    if (isAdBlockEnabled) {
        startAdBlocking();
    }
});

chrome.storage.onChanged.addListener((changes) => {
    if (changes.adBlock) {
        isAdBlockEnabled = changes.adBlock.newValue;
        if (isAdBlockEnabled) {
            startAdBlocking();
        }
    }
});

function startAdBlocking() {
    const observer = new MutationObserver(() => {
        if (!isAdBlockEnabled) return;

        // Block Feed Ads
        // Instagram feed ads usually have "Sponsored" text or specific indicators
        document.querySelectorAll('article').forEach(post => {
            const isSponsored = Array.from(post.querySelectorAll('a, span')).some(el => 
                el.textContent.toLowerCase() === 'sponsored' || 
                el.textContent.toLowerCase() === 'promoted'
            );
            
            if (isSponsored) {
                post.style.display = 'none';
                console.log('Feed Ad Blocked');
            }
        });

        // Block Story Ads
        // Story ads often have a "Sponsored" label in the header
        const storyHeader = document.querySelector('header');
        if (storyHeader) {
            const isStoryAd = Array.from(storyHeader.querySelectorAll('span')).some(el => 
                el.textContent.toLowerCase() === 'sponsored'
            );
            
            if (isStoryAd) {
                const nextBtn = document.querySelector('button[aria-label="Next"]');
                if (nextBtn) {
                    nextBtn.click();
                    console.log('Story Ad Skipped');
                }
            }
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}
