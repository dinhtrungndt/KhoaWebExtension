const params = new URLSearchParams(location.search);
const target = params.get("url");
const domain = params.get("domain");
document.querySelector("#domain").textContent = domain || "Trang bị khóa";
const status = document.querySelector("#status");
chrome.runtime.sendMessage({ type: "get-gate" }, result => {
  if (!result?.configured) {
    status.textContent = "Bạn chưa thiết lập mật khẩu. Mở cài đặt extension để bắt đầu.";
    document.querySelector("#password").disabled = true;
    document.querySelector("#form button").disabled = true;
  } else if (result.lockForever) {
    document.querySelector(".gate-description").textContent = "Trang luôn khóa. Mật khẩu sẽ mở trang này một lần; sau đó trang lại bị khóa.";
  } else {
    const labels = { second: "giây", minute: "phút", hour: "giờ", day: "ngày", month: "tháng", year: "năm" };
    document.querySelector(".gate-description").textContent = `Nhập mật khẩu để mở khóa trong ${result.unlockValue} ${labels[result.unlockUnit] || "phút"}.`;
  }
});
document.querySelector("#form").addEventListener("submit", event => {
  event.preventDefault();
  const button = document.querySelector("#form button");
  button.disabled = true;
  status.textContent = "Đang kiểm tra…";
  chrome.runtime.sendMessage({ type: "unlock", password: document.querySelector("#password").value, domain, target }, result => {
    if (chrome.runtime.lastError) { status.textContent = "Không kiểm tra được. Hãy thử tải lại trang."; button.disabled = false; return; }
    if (result?.ok && target) location.replace(target);
    else { status.textContent = "Mật khẩu chưa đúng. Vui lòng thử lại."; button.disabled = false; document.querySelector("#password").select(); }
  });
});

