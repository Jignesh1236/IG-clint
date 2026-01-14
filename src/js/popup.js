const features = ['imageHider', 'privacyMode', 'hideTyping', 'stealthMode', 'ig_story_incognito_viewer_active', 'adBlock', 'verifiedBadge', 'customTheme'];

document.addEventListener('DOMContentLoaded', () => {
  // Load saved settings
  chrome.storage.local.get(features, (result) => {
    features.forEach(id => {
      let elementId = id;
      if (id === 'ig_story_incognito_viewer_active') elementId = 'incognitoMode';
      
      const el = document.getElementById(elementId);
      if (!el) return;
      
      if (el.type === 'checkbox') {
        el.checked = result[id] !== undefined ? result[id] : (id === 'ig_story_incognito_viewer_active' ? false : true);
      } else {
        el.value = result[id] !== undefined ? result[id] : 'none';
      }
      
      el.addEventListener('change', () => {
        const value = el.type === 'checkbox' ? el.checked : el.value;
        chrome.storage.local.set({ [id]: value });
        
        if (id === 'ig_story_incognito_viewer_active') {
          chrome.runtime.sendMessage({ active: value });
        }
      });
    });
  });
});
