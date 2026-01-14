
/**
 * Image Hider Feature
 * Adds a "Hide" button to images in DMs to toggle visibility.
 */

const IMG_BTN_CLASS = "ig-img-hide-btn";
const IMG_HIDDEN_CLASS = "ig-img-hidden";
const WRAPPER_CLASS = "ig-img-wrapper";

let isImageHiderEnabled = true;

chrome.storage.local.get(['imageHider'], (result) => {
    isImageHiderEnabled = result.imageHider !== undefined ? result.imageHider : true;
});

chrome.storage.onChanged.addListener((changes) => {
    if (changes.imageHider) {
        isImageHiderEnabled = changes.imageHider.newValue;
    }
});

function ensureStyle() {
    if (document.getElementById("ig-img-style")) return;

    const style = document.createElement("style");
    style.id = "ig-img-style";
    style.textContent = `
    .${WRAPPER_CLASS} {
      position: relative;
      display: flex;
      width: fit-content;
      max-width: 100%;
      height: auto;
    }

    .${WRAPPER_CLASS} img {
      display: block;
      max-width: 100%;
      height: auto;
      object-fit: contain;
    }

    .${IMG_BTN_CLASS} {
      position: absolute;
      top: 8px;
      right: 8px;
      padding: 5px 12px;
      font-size: 11px;
      font-weight: 700;
      border-radius: 999px;
      border: none;
      background: rgba(0, 0, 0, 0.75);
      color: #fff;
      cursor: pointer;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease, background 0.2s ease;
      z-index: 100;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      backdrop-filter: blur(4px);
    }

    .${WRAPPER_CLASS}:hover .${IMG_BTN_CLASS} {
      opacity: 1;
      pointer-events: auto;
    }

    .${IMG_BTN_CLASS}:hover {
      background: rgba(0, 0, 0, 0.95);
      transform: scale(1.05);
    }

    .${IMG_HIDDEN_CLASS} {
      visibility: hidden;
      opacity: 0;
      max-height: 100px;
    }
  `;
    document.head.appendChild(style);
}

function isAvatar(img) {
    const w = img.naturalWidth || img.clientWidth || 0;
    const h = img.naturalHeight || img.clientHeight || 0;
    if (Math.min(w, h) < 80 && Math.min(w, h) > 0) return true;

    const alt = (img.alt || "").toLowerCase();
    if (alt.includes("profile") || alt.includes("avatar")) return true;

    const br = getComputedStyle(img).borderRadius;
    if (br.includes("%") && parseFloat(br) > 40) return true;

    return false;
}

function installHideButton(img) {
    if (!isImageHiderEnabled) return;
    if (!img || img.dataset.hideInstalled === "1") return;
    if (isAvatar(img)) return;

    const isInDM = img.closest('div[role="row"]') || img.closest('div[role="main"]') || img.closest('div._ad7m');
    if (!isInDM) return;

    img.dataset.hideInstalled = "1";
    ensureStyle();

    const wrapper = document.createElement("div");
    wrapper.className = WRAPPER_CLASS;

    if (img.parentNode) {
        img.parentNode.insertBefore(wrapper, img);
        wrapper.appendChild(img);

        const btn = document.createElement("button");
        btn.className = IMG_BTN_CLASS;
        btn.textContent = "Hide";

        btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const hidden = img.classList.toggle(IMG_HIDDEN_CLASS);
            btn.textContent = hidden ? "Unhide" : "Hide";
        };

        wrapper.appendChild(btn);
    }
}

function scanAndHiderInit() {
    if (!isImageHiderEnabled) return;
    if (!location.pathname.startsWith("/direct")) return;
    document.querySelectorAll("img:not([data-hide-installed])").forEach(installHideButton);
}

// Auto-init
setInterval(scanAndHiderInit, 2000);
