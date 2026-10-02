(function () {
  "use strict";
  // Tell the server the student's timezone so "today" matches their day.
  try {
    var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) document.cookie = "nx-tz=" + encodeURIComponent(tz) + "; path=/; max-age=31536000; SameSite=Lax";
  } catch (e) {}

  // Password visibility
  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-toggle-password]");
    if (!btn) return;
    var input = document.getElementById(btn.getAttribute("data-toggle-password"));
    if (!input) return;
    var show = input.type === "password";
    input.type = show ? "text" : "password";
    btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
  });

  // Toasts: auto-dismiss server-flashed messages
  document.querySelectorAll(".toast").forEach(function (t) {
    setTimeout(function () {
      t.classList.add("leaving");
      setTimeout(function () { t.remove(); }, 260);
    }, 4200);
  });

  // Prevent double submits
  document.addEventListener("submit", function (e) {
    if (e.defaultPrevented) return; // AJAX forms (dashboard) manage their own state
    var btn = e.target.querySelector('button[type="submit"].btn-primary');
    if (btn) setTimeout(function () { btn.classList.add("is-loading"); }, 0);
  });
})();
