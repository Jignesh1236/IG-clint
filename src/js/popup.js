const features = ['imageHider', 'privacyMode', 'hideTyping', 'stealthMode', 'ig_story_incognito_viewer_active', 'adBlock', 'verifiedBadge', 'customTheme', 'darkModeSync', 'followerAnalytics', 'engagementCalculator', 'readReceiptBlocker'];

document.addEventListener('DOMContentLoaded', () => {
  // Load saved settings
  chrome.storage.local.get(features, (result) => {
    features.forEach(id => {
      let elementId = id;
      if (id === 'ig_story_incognito_viewer_active') elementId = 'incognitoMode';
      
      const el = document.getElementById(elementId);
      if (!el) return;
      
      if (el.type === 'checkbox') {
        // Default values: most features default to true, except incognito mode and new features default to false
        const defaultFalse = ['ig_story_incognito_viewer_active', 'darkModeSync', 'followerAnalytics', 'engagementCalculator', 'readReceiptBlocker'];
        const defaultValue = defaultFalse.includes(id) ? false : true;
        el.checked = result[id] !== undefined ? result[id] : defaultValue;
      } else {
        el.value = result[id] !== undefined ? result[id] : 'none';
      }
      
      el.addEventListener('change', () => {
        const value = el.type === 'checkbox' ? el.checked : el.value;
        chrome.storage.local.set({ [id]: value });
        
        if (id === 'ig_story_incognito_viewer_active') {
          chrome.runtime.sendMessage({ type: 'story_incognito', active: value }, (response) => {
            if (chrome.runtime.lastError) {
              console.error('Error sending message:', chrome.runtime.lastError);
              // Retry once after a short delay
              setTimeout(() => {
                chrome.runtime.sendMessage({ type: 'story_incognito', active: value }, (retryResponse) => {
                  if (chrome.runtime.lastError) {
                    console.error('Retry failed:', chrome.runtime.lastError);
                  }
                });
              }, 100);
            } else if (response && !response.success) {
              console.error('Failed to update incognito mode:', response.error);
            }
          });
        }
        
        if (id === 'readReceiptBlocker') {
          chrome.runtime.sendMessage({ type: 'read_receipt', active: value }, (response) => {
            if (chrome.runtime.lastError) {
              console.error('Error sending read receipt message:', chrome.runtime.lastError);
            }
          });
        }
      });
    });
    
    // Ensure incognito mode state is synced on popup open
    const incognitoEl = document.getElementById('incognitoMode');
    if (incognitoEl && result['ig_story_incognito_viewer_active']) {
      chrome.runtime.sendMessage({ type: 'story_incognito', active: result['ig_story_incognito_viewer_active'] }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error syncing incognito mode:', chrome.runtime.lastError);
        }
      });
    }
    
    // Ensure read receipt blocker state is synced on popup open
    const readReceiptEl = document.getElementById('readReceiptBlocker');
    if (readReceiptEl && result['readReceiptBlocker']) {
      chrome.runtime.sendMessage({ type: 'read_receipt', active: result['readReceiptBlocker'] }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error syncing read receipt blocker:', chrome.runtime.lastError);
        }
      });
    }

    // Handle custom theme colors
    const customColorInputs = ['customPrimaryBg', 'customPrimaryText', 'customAccent'];
    const applyColorsBtn = document.getElementById('applyCustomColors');
    
    if (applyColorsBtn) {
      chrome.storage.local.get(['customThemeColors'], (colorResult) => {
        const colors = colorResult.customThemeColors || {};
        const primaryBgInput = document.getElementById('customPrimaryBg');
        const primaryTextInput = document.getElementById('customPrimaryText');
        const accentInput = document.getElementById('customAccent');
        
        if (primaryBgInput && colors.primaryBg) primaryBgInput.value = colors.primaryBg;
        if (primaryTextInput && colors.primaryText) primaryTextInput.value = colors.primaryText;
        if (accentInput && colors.accent) accentInput.value = colors.accent;
      });

      applyColorsBtn.addEventListener('click', () => {
        const primaryBgInput = document.getElementById('customPrimaryBg');
        const primaryTextInput = document.getElementById('customPrimaryText');
        const accentInput = document.getElementById('customAccent');
        
        const customThemeColors = {
          primaryBg: primaryBgInput ? primaryBgInput.value.trim() : '',
          secondaryBg: '',
          primaryText: primaryTextInput ? primaryTextInput.value.trim() : '',
          secondaryText: '',
          accent: accentInput ? accentInput.value.trim() : ''
        };
        chrome.storage.local.set({ customThemeColors });
        applyColorsBtn.textContent = 'Applied!';
        setTimeout(() => {
          applyColorsBtn.textContent = 'Apply Colors';
        }, 2000);
      });
    }
  });
});
