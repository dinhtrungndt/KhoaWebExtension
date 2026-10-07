const DEFAULTS = { domains: [], passwordHash: "", unlockValue: 15, unlockUnit: "minute", lockForever: false };

async function settings() {
  return { ...DEFAULTS, ...(await chrome.storage.local.get(DEFAULTS)) };
}

function digest(text) {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))
    .then(buffer => [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, "0")).join(""));
}

function matchingDomain(host, domains) {
  return domains.find(domain => host === domain || host.endsWith(`.${domain}`));
}

function expiryFromNow(value, unit) {
  const date = new Date();
  const amount = Math.max(1, Number(value) || 1);
  if (unit === "second") date.setSeconds(date.getSeconds() + amount);
  else if (unit === "minute") date.setMinutes(date.getMinutes() + amount);
  else if (unit === "hour") date.setHours(date.getHours() + amount);
  else if (unit === "day") date.setDate(date.getDate() + amount);
  else if (unit === "month") {
    const day = date.getDate();
    date.setDate(1);
    date.setMonth(date.getMonth() + amount);
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    date.setDate(Math.min(day, lastDay));
  } else if (unit === "year") {
    const month = date.getMonth();
    const day = date.getDate();
    date.setDate(1);
    date.setFullYear(date.getFullYear() + amount);
    date.setMonth(month);
    const lastDay = new Date(date.getFullYear(), month + 1, 0).getDate();
    date.setDate(Math.min(day, lastDay));
  }
  return date.getTime();
}

chrome.webNavigation.onBeforeNavigate.addListener(async details => {
  if (details.frameId !== 0 || !/^https?:/.test(details.url)) return;
  const host = new URL(details.url).hostname.toLowerCase();
  const s = await settings();
  const domain = matchingDomain(host, s.domains);
  if (!domain) return;

  const oneTimeKey = `allow-once:${details.tabId}`;
  const oneTime = (await chrome.storage.session.get(oneTimeKey))[oneTimeKey];
  if (oneTime === details.url) {
    await chrome.storage.session.remove(oneTimeKey);
    return;
  }
  const key = `unlock:${domain}`;
  const saved = (await chrome.storage.session.get(key))[key];
  if (saved && saved > Date.now()) return;
  const gate = chrome.runtime.getURL("gate.html") + `?url=${encodeURIComponent(details.url)}&domain=${encodeURIComponent(domain)}`;
  if (details.tabId >= 0) chrome.tabs.update(details.tabId, { url: gate });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    const s = await settings();
    if (message.type === "get-gate") {
      sendResponse({ configured: Boolean(s.passwordHash), lockForever: s.lockForever, unlockValue: s.unlockValue, unlockUnit: s.unlockUnit });
    } else if (message.type === "unlock") {
      const valid = Boolean(s.passwordHash) && await digest(message.password) === s.passwordHash;
      if (!valid) { sendResponse({ ok: false }); return; }
      if (s.lockForever) {
        if (sender.tab?.id != null) await chrome.storage.session.set({ [`allow-once:${sender.tab.id}`]: message.target });
      } else {
        const durationKey = `unlock:${message.domain}`;
        await chrome.storage.session.set({ [durationKey]: expiryFromNow(s.unlockValue, s.unlockUnit) });
      }
      sendResponse({ ok: true });
    } else if (message.type === "get-options-state") {
      sendResponse({ hasPassword: Boolean(s.passwordHash) });
    } else if (message.type === "load-settings") {
      const valid = s.passwordHash ? await digest(message.currentPassword || "") === s.passwordHash : true;
      if (!valid) { sendResponse({ ok: false, error: "Mật khẩu hiện tại không đúng." }); return; }
      sendResponse({ ok: true, domains: s.domains, unlockValue: s.unlockValue, unlockUnit: s.unlockUnit, lockForever: s.lockForever });
    } else if (message.type === "save-settings") {
      if (s.passwordHash && await digest(message.currentPassword || "") !== s.passwordHash) {
        sendResponse({ ok: false, error: "Mật khẩu hiện tại không đúng." }); return;
      }
      if (!s.passwordHash && !message.password) {
        sendResponse({ ok: false, error: "Cần tạo mật khẩu trước khi lưu." }); return;
      }
      if (message.password) s.passwordHash = await digest(message.password);
      s.domains = message.domains;
      s.lockForever = Boolean(message.lockForever);
      s.unlockValue = Math.max(1, Math.min(999, Number(message.unlockValue) || 15));
      s.unlockUnit = ["second", "minute", "hour", "day", "month", "year"].includes(message.unlockUnit) ? message.unlockUnit : "minute";
      await chrome.storage.local.set(s);
      sendResponse({ ok: true });
    }
  })().catch(() => sendResponse({ ok: false, error: "Có lỗi khi lưu hoặc kiểm tra cài đặt." }));
  return true;
});
