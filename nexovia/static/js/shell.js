(function () {
  "use strict";
  var sidebar = document.getElementById("sidebar");
  var menuBtn = document.getElementById("menu-btn");
  var palette = document.getElementById("palette");
  var input = document.getElementById("palette-input");
  var list = document.getElementById("palette-list");
  var openBtn = document.getElementById("cmd-open");
  if (!sidebar || !palette) return;

  // Mobile drawer
  menuBtn.addEventListener("click", function () { sidebar.classList.toggle("open"); });
  document.addEventListener("click", function (e) {
    if (sidebar.classList.contains("open") && !e.target.closest("#sidebar") && !e.target.closest("#menu-btn")) {
      sidebar.classList.remove("open");
    }
  });

  // Command palette (Phase 3 extends this command list)
  var commands = [
    { label: "Go to Home", run: function () { location.href = "/app"; } }
  ];
  document.querySelectorAll("[data-command]").forEach(function (el) {
    commands.push({ label: el.getAttribute("data-command"), run: function () { el.click(); } });
  });
  var filtered = [], active = 0;

  function render() {
    var q = input.value.trim().toLowerCase();
    filtered = commands.filter(function (c) { return c.label.toLowerCase().indexOf(q) !== -1; });
    active = Math.min(active, Math.max(filtered.length - 1, 0));
    list.innerHTML = "";
    if (!filtered.length) {
      var empty = document.createElement("div");
      empty.className = "palette-empty";
      empty.textContent = "No results";
      list.appendChild(empty);
      return;
    }
    filtered.forEach(function (c, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "palette-item";
      b.setAttribute("role", "option");
      b.setAttribute("aria-selected", i === active ? "true" : "false");
      b.textContent = c.label;
      b.addEventListener("click", function () { close(); c.run(); });
      list.appendChild(b);
    });
  }
  function open() { palette.classList.add("open"); input.value = ""; active = 0; render(); input.focus(); }
  function close() { palette.classList.remove("open"); }

  openBtn.addEventListener("click", open);
  palette.addEventListener("mousedown", function (e) { if (e.target === palette) close(); });
  input.addEventListener("input", function () { active = 0; render(); });
  input.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown") { e.preventDefault(); active = Math.min(active + 1, filtered.length - 1); render(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); active = Math.max(active - 1, 0); render(); }
    else if (e.key === "Enter" && filtered[active]) { var c = filtered[active]; close(); c.run(); }
  });
  document.addEventListener("keydown", function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); palette.classList.contains("open") ? close() : open(); }
    else if (e.key === "Escape") close();
  });
})();
