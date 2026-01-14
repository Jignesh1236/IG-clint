
let isStealthMode = false;
let settings = {
    hideTyping: true,
    stealthMode: true
};

chrome.storage.local.get(['hideTyping', 'stealthMode'], (result) => {
    settings.hideTyping = result.hideTyping !== undefined ? result.hideTyping : true;
    settings.stealthMode = result.stealthMode !== undefined ? result.stealthMode : true;
    updateAll();
});

chrome.storage.onChanged.addListener((changes) => {
    if (changes.hideTyping) settings.hideTyping = changes.hideTyping.newValue;
    if (changes.stealthMode) settings.stealthMode = changes.stealthMode.newValue;
    updateAll();
});

function updateAll() {
    toggleHideTyping(settings.hideTyping);
    if (!settings.stealthMode && isStealthMode) {
        isStealthMode = false;
        document.documentElement.classList.remove('insta-stealth-active');
    }
}

function initPowerFeatures() {
    if (document.getElementById('insta-ai-power-styles')) return;

    const style = document.createElement('style');
    style.id = 'insta-ai-power-styles';
    style.innerHTML = `
    /* Stealth Mode: Global Panic Blur */
    html.insta-stealth-active {
      filter: blur(50px) grayscale(1) !important;
      pointer-events: none !important;
      transition: filter 0.15s ease-out;
    }

    .stealth-overlay {
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(0,0,0,0.4); z-index: 999999; display: none;
    }
    html.insta-stealth-active .stealth-overlay { display: block; }

    /* Hide Typing Indicator */
    .insta-hide-typing div[role="none"] div[aria-label*="typing"],
    .insta-hide-typing div._ab8w._ab94._ab99._ab9f._ab9m._ab9p._ab9x:contains("typing"),
    .insta-hide-typing div:contains("typing...") {
      display: none !important;
      opacity: 0 !important;
      visibility: hidden !important;
    }
  `;
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.className = 'stealth-overlay';
    document.body.appendChild(overlay);

    // Global Key Listener for Stealth Mode
    window.addEventListener('keydown', (e) => {
        if (settings.stealthMode && e.altKey && (e.code === 'KeyX' || e.key.toLowerCase() === 'x')) {
            e.preventDefault();
            e.stopPropagation();
            isStealthMode = !isStealthMode;
            document.documentElement.classList.toggle('insta-stealth-active', isStealthMode);
        }
    }, true);
}

function toggleHideTyping(enabled) {
    document.body.classList.toggle('insta-hide-typing', enabled);
}

// Auto-init power features
initPowerFeatures();
