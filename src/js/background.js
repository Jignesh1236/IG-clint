const storyRules = [{
  id: 1,
  priority: 1,
  action: {
    type: 'block',
  },
  condition: {
    urlFilter: '*://*.instagram.com/api/v1/stories/reel/seen*',
  },
}];

const readReceiptRules = [{
  id: 2,
  priority: 1,
  action: {
    type: 'block',
  },
  condition: {
    urlFilter: '*://*.instagram.com/api/v1/direct_v2/threads/*/items/*/seen*',
  },
}, {
  id: 3,
  priority: 1,
  action: {
    type: 'block',
  },
  condition: {
    urlFilter: '*://*.instagram.com/api/v1/direct_v2/threads/*/seen*',
  },
}, {
  id: 4,
  priority: 1,
  action: {
    type: 'block',
  },
  condition: {
    urlFilter: '*://*.instagram.com/api/v1/direct_v2/threads/*/items/*/mark_seen*',
  },
}];

chrome.runtime.onInstalled.addListener(async () => {
  await initialState();
  updateBadge(false)
});

// Ensure incognito story viewer and read receipt blocker state is restored when the browser starts
chrome.runtime.onStartup.addListener(async () => {
  const stored = await chrome.storage.local.get(['ig_story_incognito_viewer_active', 'readReceiptBlocker']);
  const storyActive = stored.ig_story_incognito_viewer_active === true;
  const readReceiptActive = stored.readReceiptBlocker === true;
  
  const rulesToAdd = [];
  const rulesToRemove = [];
  
  if (storyActive) {
    rulesToAdd.push(...storyRules);
  } else {
    rulesToRemove.push(1);
  }
  
  if (readReceiptActive) {
    rulesToAdd.push(...readReceiptRules);
  } else {
    rulesToRemove.push(2, 3, 4);
  }
  
  await updateDynamicRules(rulesToAdd, rulesToRemove);
  updateBadge(storyActive);
});

const initialState = async () => {
  await chrome.storage.local.remove('ig_story_incognito_viewer_active');
  const dynamicRules = await chrome.declarativeNetRequest.getDynamicRules();
  if (dynamicRules.length > 0) {
    const ids = dynamicRules.map(rule => rule.id);
    updateDynamicRules([], ids);
  }
  return;
};

const sendMessage = (params = {}) => {
  chrome.runtime.sendMessage(params);
};

const onMessage = async (msg, sender, sendResponse) => {
  try {
    // Handle story incognito viewer
    if (msg.type === 'story_incognito') {
      if (msg.active === true) {
        await chrome.storage.local.set({
          'ig_story_incognito_viewer_active': true,
        });
        await updateDynamicRules(storyRules, []);
        updateBadge(true);
        sendResponse({ success: true });
      } else if (msg.active === false) {
        await chrome.storage.local.set({
          'ig_story_incognito_viewer_active': false,
        });
        await updateDynamicRules([], [1]);
        updateBadge(false);
        sendResponse({ success: true });
      }
      return true;
    }
    
    // Handle read receipt blocker
    if (msg.type === 'read_receipt') {
      if (msg.active === true) {
        await chrome.storage.local.set({
          'readReceiptBlocker': true,
        });
        await updateDynamicRules(readReceiptRules, []);
        sendResponse({ success: true });
      } else if (msg.active === false) {
        await chrome.storage.local.set({
          'readReceiptBlocker': false,
        });
        await updateDynamicRules([], [2, 3, 4]);
        sendResponse({ success: true });
      }
      return true;
    }
    
    // Backward compatibility - handle old message format
    if (msg.active === true) {
      await chrome.storage.local.set({
        'ig_story_incognito_viewer_active': true,
      });
      await updateDynamicRules(storyRules, []);
      updateBadge(true);
      sendResponse({ success: true });
    } else if (msg.active === false) {
      await chrome.storage.local.set({
        'ig_story_incognito_viewer_active': false,
      });
      await updateDynamicRules([], [1]);
      updateBadge(false);
      sendResponse({ success: true });
    }
    return true; // Keep the message channel open for async response
  } catch (error) {
    console.error('Error handling message:', error);
    sendResponse({ success: false, error: error.message });
    return true;
  }
};

const updateDynamicRules = (addRules = [], removeRuleIds = []) => {
  return chrome.declarativeNetRequest.updateDynamicRules({
    addRules,
    removeRuleIds,
  });
};

const updateBadge = (active) => {
  chrome.action.setBadgeBackgroundColor({
    color: active ? '#287A4555' : '#6C757D',
  });
  chrome.action.setBadgeTextColor({
    color: '#FFFFFF',
  });
  chrome.action.setBadgeText({
    text: active ? 'ON' : '',
  });
};

chrome.runtime.onMessage.addListener(onMessage);
