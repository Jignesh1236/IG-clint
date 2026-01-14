
let isPrivacyMode = false;
let isPrivacyModeEnabled = true;

chrome.storage.local.get(['privacyMode'], (result) => {
    isPrivacyModeEnabled = result.privacyMode !== undefined ? result.privacyMode : true;
});

chrome.storage.onChanged.addListener((changes) => {
    if (changes.privacyMode) {
        isPrivacyModeEnabled = changes.privacyMode.newValue;
        if (!isPrivacyModeEnabled && isPrivacyMode) {
            isPrivacyMode = false;
            applyPrivacyStyles();
        }
    }
});

function applyPrivacyStyles() {
    const media = document.querySelectorAll('div._aa-i, div._aagv, div._aabd');
    media.forEach(el => {
        if (isPrivacyMode && isPrivacyModeEnabled) {
            el.style.filter = 'blur(20px)';
            el.style.opacity = '0.3';
            el.style.transition = 'filter 0.3s, opacity 0.3s';
        } else {
            el.style.filter = 'none';
            el.style.opacity = '1';
        }
    });
}

function togglePrivacyMode() {
    if (!isPrivacyModeEnabled) return;
    isPrivacyMode = !isPrivacyMode;
    applyPrivacyStyles();
    return isPrivacyMode;
}

// Listen for a custom event or keyboard shortcut if needed
window.addEventListener('keydown', (e) => {
    if (isPrivacyModeEnabled && e.altKey && e.key.toLowerCase() === 'p') {
        togglePrivacyMode();
    }
});
