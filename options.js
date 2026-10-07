const domainsBox = document.querySelector("#domains");
const passwordBox = document.querySelector("#password");
const durationFields = document.querySelector("#duration-fields");
const foreverBox = document.querySelector("#forever");
const valueBox = document.querySelector("#duration-value");
const unitBox = document.querySelector("#duration-unit");
const status = document.querySelector("#status");
let hasPassword = false;

function updateDurationVisibility() {
  durationFields.hidden = foreverBox.checked;
}
foreverBox.addEventListener("change", updateDurationVisibility);

chrome.runtime.sendMessage({ type: "load-settings" }, s => {
  if (chrome.runtime.lastError || !s) { status.textContent = "Không tải được cài đặt. Hãy tải lại extension."; return; }
  domainsBox.value = (s.domains || []).join("\n");
  valueBox.value = s.unlockValue || 15;
  unitBox.value = s.unlockUnit || "minute";
  foreverBox.checked = Boolean(s.lockForever);
  hasPassword = Boolean(s.hasPassword);
  document.querySelector("#password-hint").textContent = hasPassword ? "· Để trống nếu giữ mật khẩu hiện tại" : "· Bắt buộc thiết lập lần đầu";
  passwordBox.placeholder = hasPassword ? "Nhập mật khẩu mới để đổi" : "Tạo mật khẩu lần đầu";
  updateDurationVisibility();
});

document.querySelector("#settings-form").addEventListener("submit", event => {
  event.preventDefault();
  const domains = [...new Set(domainsBox.value.split(/[\n,]+/).map(value => value.trim().toLowerCase().replace(/^https?:\/\//, "").split(/[/:?#]/)[0].replace(/^www\./, "")).filter(value => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(value)))];
  if (!domains.length) { status.textContent = "Hãy nhập ít nhất một tên miền hợp lệ."; domainsBox.focus(); return; }
  if (!hasPassword && !passwordBox.value) { status.textContent = "Hãy tạo mật khẩu trước khi lưu."; passwordBox.focus(); return; }
  status.textContent = "Đang lưu…";
  chrome.runtime.sendMessage({ type: "save-settings", domains, password: passwordBox.value, lockForever: foreverBox.checked, unlockValue: valueBox.value, unlockUnit: unitBox.value }, result => {
    if (chrome.runtime.lastError || !result?.ok) { status.textContent = "Lưu chưa thành công. Hãy thử lại."; return; }
    hasPassword = true;
    passwordBox.value = "";
    passwordBox.placeholder = "Nhập mật khẩu mới để đổi";
    document.querySelector("#password-hint").textContent = "· Để trống nếu giữ mật khẩu hiện tại";
    status.textContent = "Đã lưu cài đặt thành công.";
  });
});
