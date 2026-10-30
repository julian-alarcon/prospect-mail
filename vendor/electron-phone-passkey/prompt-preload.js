const { ipcRenderer } = require("electron");

window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("cancel").addEventListener("click", () => {
    ipcRenderer.send("phone-passkey:prompt-cancel");
  });
});
ipcRenderer.on("phone-passkey:qr", (_event, { svg, origin }) => {
  document.getElementById("origin").textContent = origin;
  document.getElementById("qr").src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
});
