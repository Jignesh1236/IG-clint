
let settings = {
    verifiedBadge: true,
    customTheme: 'none'
};

chrome.storage.local.get(['verifiedBadge', 'customTheme'], (result) => {
    settings.verifiedBadge = result.verifiedBadge !== undefined ? result.verifiedBadge : true;
    settings.customTheme = result.customTheme !== undefined ? result.customTheme : 'none';
    applySettings();
});

chrome.storage.onChanged.addListener((changes) => {
    if (changes.verifiedBadge) settings.verifiedBadge = changes.verifiedBadge.newValue;
    if (changes.customTheme) settings.customTheme = changes.customTheme.newValue;
    applySettings();
});

function applySettings() {
    applyVerifiedBadge();
    applyTheme();
}

function applyVerifiedBadge() {
    if (!settings.verifiedBadge) {
        document.querySelectorAll('.ig-custom-verified').forEach(el => el.remove());
        return;
    }

    const observer = new MutationObserver(() => {
        if (!settings.verifiedBadge) return;

        // Find own username in various places
        const ownUsername = document.querySelector('header section h2, header section h1')?.textContent;
        if (!ownUsername) return;

        document.querySelectorAll('h2, span, a').forEach(el => {
            if (el.textContent === ownUsername && !el.querySelector('.ig-custom-verified') && !el.closest('header')) {
                const badge = document.createElement('span');
                badge.className = 'ig-custom-verified';
                badge.innerHTML = `
                    <svg aria-label="Verified" color="rgb(0, 149, 246)" fill="rgb(0, 149, 246)" height="12" role="img" viewBox="0 0 40 40" width="12">
                        <path d="M19.998 3.094c-2.51 0-4.92 1.117-6.603 3.064l-2.032 2.356-2.998.469c-2.585.404-4.661 2.48-5.065 5.065l-.47 2.997-2.355 2.033c-1.947 1.682-3.064 4.093-3.064 6.603 0 2.51 1.117 4.92 3.064 6.603l2.356 2.032.469 2.998c.404 2.585 2.48 4.661 5.065 5.065l2.997.47 2.033 2.355c1.682 1.947 4.093 3.064 6.603 3.064 2.51 0 4.92-1.117 6.603-3.064l2.032-2.356 2.998-.469c2.585-.404 4.661-2.48 5.065-5.065l.47-2.997 2.355-2.033c1.947-1.682 3.064-4.093 3.064-6.603 0-2.51-1.117-4.92-3.064-6.603l-2.356-2.032-.469-2.998c-.404-2.585-2.48-4.661-5.065-5.065l-2.997-.47-2.033-2.355c-1.682-1.947-4.093-3.064-6.603-3.064z" fill-rule="evenodd"></path>
                        <path d="M18.813 26.232l-7.33-7.147 2.858-2.93 4.472 4.36 9.44-9.213 2.858 2.93z" fill-rule="evenodd" fill="white"></path>
                    </svg>
                `;
                badge.style.marginLeft = '4px';
                badge.style.display = 'inline-flex';
                badge.style.alignItems = 'center';
                el.appendChild(badge);
            }
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });
}

function applyTheme() {
    const existingTheme = document.getElementById('ig-custom-theme');
    if (existingTheme) existingTheme.remove();

    if (settings.customTheme === 'none') return;

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

    const style = document.createElement('style');
    style.id = 'ig-custom-theme';
    style.textContent = themes[settings.customTheme] || '';
    document.head.appendChild(style);
}
