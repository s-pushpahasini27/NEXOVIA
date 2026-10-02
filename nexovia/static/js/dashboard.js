(function () {
  "use strict";
  var root = document.getElementById("dash");
  if (!root) return;
  var csrf = root.getAttribute("data-csrf");
  var $ = function (id) { return document.getElementById(id); };

  // Local date label (server value is already timezone-aware once the cookie is set)
  try {
    $("dash-date").textContent = new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  } catch (e) {}

  function api(path, method, body) {
    var opts = { method: method, headers: { "X-CSRF-Token": csrf, "Accept": "application/json" } };
    if (body !== undefined) { opts.headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(body); }
    return fetch(path, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (!r.ok) throw new Error(data.error || "Something went wrong. Try again.");
        return data;
      });
    });
  }

  function toast(message) {
    var host = $("toasts");
    var t = document.createElement("div");
    t.className = "toast info";
    t.textContent = message;
    host.appendChild(t);
    setTimeout(function () { t.classList.add("leaving"); setTimeout(function () { t.remove(); }, 260); }, 3500);
  }

  // ---- stats + chart ------------------------------------------------------
  function render(res) {
    var s = res.stats;
    $("st-streak").textContent = s.streak;
    $("st-streak-unit").textContent = s.streak === 1 ? "day" : "days";
    $("st-today").textContent = s.today_minutes;
    $("st-week").textContent = s.week_minutes;
    $("st-done").textContent = s.tasks_done;
    $("st-total").textContent = s.tasks_total;
    var cols = document.querySelectorAll("#week .week-col");
    res.week.forEach(function (d, i) {
      var col = cols[i];
      if (!col) return;
      col.title = d.label + ": " + d.minutes + " min";
      col.querySelector(".week-val").textContent = d.minutes || "";
      col.querySelector(".week-bar").style.setProperty("--h", d.pct + "%");
    });
  }

  // ---- tasks --------------------------------------------------------------
  var list = $("task-list"), empty = $("task-empty");
  var tpl = $("task-tpl");

  function syncEmpty() { empty.hidden = list.children.length > 0 || root.getAttribute('data-has-active-plan') === 'true'; }

  function taskEl(t) {
    var li = tpl.content.firstElementChild.cloneNode(true);
    li.setAttribute("data-id", t.id);
    li.classList.toggle("done", t.done);
    li.querySelector(".task-check").setAttribute("aria-pressed", t.done ? "true" : "false");
    li.querySelector(".task-title").textContent = t.title;
    return li;
  }

  list.addEventListener("click", function (e) {
    var li = e.target.closest(".task");
    if (!li) return;
    var id = li.getAttribute("data-id");
    if (e.target.closest(".task-check")) {
      api("/api/tasks/" + id + "/toggle", "POST").then(function (res) {
        li.classList.toggle("done", res.task.done);
        li.querySelector(".task-check").setAttribute("aria-pressed", res.task.done ? "true" : "false");
        if (res.task.done) list.appendChild(li);
        render(res);
      }).catch(function (err) { toast(err.message); });
    } else if (e.target.closest(".task-del")) {
      api("/api/tasks/" + id + "/delete", "POST").then(function (res) {
        li.remove(); syncEmpty(); render(res);
      }).catch(function (err) { toast(err.message); });
    }
  });

  var taskForm = $("task-form");
  if (taskForm) taskForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var input = $("task-input");
    var title = input.value.trim();
    if (!title) { input.focus(); return; }
    api("/api/tasks", "POST", { title: title }).then(function (res) {
      var first = list.querySelector(".task.done");
      var el = taskEl(res.task);
      list.insertBefore(el, first);
      input.value = "";
      syncEmpty(); render(res);
    }).catch(function (err) { toast(err.message); });
  });

  // ---- log session dialog -------------------------------------------------
  var dialog = $("log-dialog"), logError = $("log-error");
  function openLog() {
    logError.hidden = true;
    $("log-minutes").value = ""; $("log-topic").value = "";
    if (dialog.showModal) dialog.showModal(); else dialog.setAttribute("open", "");
    $("log-minutes").focus();
  }
  function closeLog() { if (dialog.close) dialog.close(); else dialog.removeAttribute("open"); }
  $("log-open").addEventListener("click", openLog);
  $("log-cancel").addEventListener("click", closeLog);
  dialog.addEventListener("mousedown", function (e) { if (e.target === dialog) closeLog(); });
  $("log-form").addEventListener("submit", function (e) {
    e.preventDefault();
    api("/api/sessions", "POST", { minutes: $("log-minutes").value, topic: $("log-topic").value }).then(function (res) {
      render(res); closeLog(); toast("Session logged.");
    }).catch(function (err) { logError.textContent = err.message; logError.hidden = false; });
  });

  // ---- quick actions + AI tip --------------------------------------------
  $("tip-focus").addEventListener("click", function () { $("tip-topic").focus(); $("tip-topic").scrollIntoView({ block: "center" }); });
  $("tip-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var btn = e.target.querySelector("button");
    btn.disabled = true;
    btn.textContent = "Thinking…";
    api("/api/ai/tip?topic=" + encodeURIComponent($("tip-topic").value.trim()), "GET").then(function (res) {
      $("tip-text").textContent = res.text;
      $("tip-meta").textContent = "via " + res.provider + " provider";
    }).catch(function (err) { toast(err.message); }).then(function () { btn.disabled = false; btn.textContent = "New tip"; });
  });
})();
