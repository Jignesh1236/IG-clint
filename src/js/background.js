const rules = [{
  id: 1,
  priority: 1,
  action: {
    type: 'block',
  },
  condition: {
    urlFilter: '*://*.instagram.com/api/v1/stories/reel/seen*',
  },
}];

chrome.runtime.onInstalled.addListener(async () => {
  await initialState();
  updateBadge(false)
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

const onMessage = async (msg) => {
  if (msg.active === true) {
    await chrome.storage.local.set({
      'ig_story_incognito_viewer_active': true,
    });
    await updateDynamicRules(rules, []);
    updateBadge(true);
  } else if (msg.active === false) {
    await chrome.storage.local.set({
      'ig_story_incognito_viewer_active': false,
    });
    await updateDynamicRules([], [1]);
    updateBadge(false);
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
