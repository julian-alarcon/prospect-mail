setTimeout(() => {
  let removeTopBar = ["to-do.office.com/tasks"];
  let url = window.location;

  // Remove Top Bar
  if (new RegExp(removeTopBar.join("|")).test(url)) {
    var topBar = document.querySelectorAll("#O365ShellHeader");
    topBar[0].style.display = "none";
  }
  // Close Button
  let closeButton = document.createElement("div");

  closeButton.className = "ms-Button";
  closeButton.style.position = "absolute";
  closeButton.style.right = "0px";
  closeButton.style.top = "0px";
  closeButton.style.lineHeight = "35px";
  closeButton.style.width = "35px";
  closeButton.style.height = "35px";
  closeButton.style.background = "rgba(0,0,0,0.3)";
  closeButton.style.textAlign = "center";
  closeButton.style.color = "white";
  closeButton.style.cursor = "pointer";
  closeButton.style.fontSize = "20px";
  closeButton.append("✖");
  closeButton.addEventListener("click", () => {
    window.close();
  });
  document.body.append(closeButton);
}, 3000);
