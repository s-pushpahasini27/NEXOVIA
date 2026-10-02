(function () {
  "use strict";
  var nav = document.querySelector(".lp-nav");
  if (nav) {
    var setScrolled = function () { nav.classList.toggle("scrolled", window.scrollY > 8); };
    setScrolled();
    window.addEventListener("scroll", setScrolled, { passive: true });
  }

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Scroll reveal
  var revealEls = document.querySelectorAll(".reveal");
  if (revealEls.length) {
    if (reduceMotion || !("IntersectionObserver" in window)) {
      revealEls.forEach(function (el) { el.classList.add("in-view"); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            io.unobserve(entry.target);
          }
        });
      }, { threshold: 0.15 });
      revealEls.forEach(function (el) { io.observe(el); });
    }
  }

  // Count-up stats, triggered once when scrolled into view
  var stats = document.querySelectorAll("[data-count-to]");
  if (!stats.length) return;
  var animate = function (el) {
    var target = parseFloat(el.getAttribute("data-count-to"));
    var suffix = el.getAttribute("data-count-suffix") || "";
    if (reduceMotion) { el.textContent = target.toLocaleString() + suffix; return; }
    var start = performance.now();
    var duration = 1100;
    function step(now) {
      var p = Math.min((now - start) / duration, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased).toLocaleString() + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  };
  if ("IntersectionObserver" in window) {
    var statIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { animate(entry.target); statIo.unobserve(entry.target); }
      });
    }, { threshold: 0.6 });
    stats.forEach(function (el) { statIo.observe(el); });
  } else {
    stats.forEach(animate);
  }
})();
