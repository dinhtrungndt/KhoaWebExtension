const domainsBox = document.querySelector("#domains");
const newPasswordBox = document.querySelector("#new-password");
const confirmPasswordBox = document.querySelector("#confirm-password");
const durationFields = document.querySelector("#duration-fields");
const foreverBox = document.querySelector("#forever");
const valueBox = document.querySelector("#duration-value");
const unitBox = document.querySelector("#duration-unit");
const status = document.querySelector("#status");
const authPanel = document.querySelector("#settings-auth");
const settingsForm = document.querySelector("#settings-form");
let currentPassword = "";

function updateDurationVisibility() {
  durationFields.hidden = foreverBox.checked;
}
foreverBox.addEventListener("change", updateDurationVisibility);

chrome.runtime.sendMessage({ type: "get-options-state" }, state => {
  if (chrome.runtime.lastError || !state) {
    document.querySelector("#auth-status").textContent = "Không tải được cài đặt. Hãy tải lại extension.";
    authPanel.hidden = false;
    return;
  }
  if (state.hasPassword) {
    authPanel.hidden = false;
    document.querySelector("#current-password").focus();
  } else {
    settingsForm.hidden = false;
    status.textContent = "Hãy tạo mật khẩu để bảo vệ phần cài đặt.";
    updateDurationVisibility();
  }
});

document.querySelector("#auth-form").addEventListener("submit", event => {
  event.preventDefault();
  const candidate = document.querySelector("#current-password").value;
  const authStatus = document.querySelector("#auth-status");
  authStatus.textContent = "Đang xác minh…";
  chrome.runtime.sendMessage({ type: "load-settings", currentPassword: candidate }, result => {
    if (chrome.runtime.lastError || !result?.ok) {
      authStatus.textContent = result?.error || "Không xác minh được. Hãy thử lại.";
      document.querySelector("#current-password").select();
      return;
    }
    currentPassword = candidate;
    domainsBox.value = (result.domains || []).join("\n");
    valueBox.value = result.unlockValue || 15;
    unitBox.value = result.unlockUnit || "minute";
    foreverBox.checked = Boolean(result.lockForever);
    authPanel.hidden = true;
    settingsForm.hidden = false;
    updateDurationVisibility();
  });
});

document.querySelector("#settings-form").addEventListener("submit", event => {
  event.preventDefault();
  const domains = [...new Set(domainsBox.value.split(/[\n,]+/).map(value => value.trim().toLowerCase().replace(/^https?:\/\//, "").split(/[/:?#]/)[0].replace(/^www\./, "")).filter(value => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(value)))];
  if (!domains.length) { status.textContent = "Hãy nhập ít nhất một tên miền hợp lệ."; domainsBox.focus(); return; }
  const newPassword = newPasswordBox.value;
  if (newPassword && newPassword !== confirmPasswordBox.value) {
    status.textContent = "Hai mật khẩu mới chưa khớp."; confirmPasswordBox.focus(); return;
  }
  status.textContent = "Đang lưu…";
  chrome.runtime.sendMessage({ type: "save-settings", currentPassword, domains, password: newPassword, lockForever: foreverBox.checked, unlockValue: valueBox.value, unlockUnit: unitBox.value }, result => {
    if (chrome.runtime.lastError || !result?.ok) { status.textContent = result?.error || "Lưu chưa thành công. Hãy thử lại."; return; }
    if (newPassword) currentPassword = newPassword;
    newPasswordBox.value = "";
    confirmPasswordBox.value = "";
    status.textContent = newPassword ? "Đã lưu cài đặt và đổi mật khẩu thành công." : "Đã lưu cài đặt thành công.";
  });
});
