/* PersianPod: حرکت‌های تکمیلی سبک
   ردیف پادکست‌ها از اسکرول افقی بومی مرورگر استفاده می‌کند؛
   افکت پشته‌ی سه‌بعدی در pp-motion-fan-backup.js برای استفاده‌ی احتمالی آینده نگه‌داری شده است.
   این فایل فقط ورود ملایم ردیف‌های «تازه‌ها» را مدیریت می‌کند. */
(function () {
  "use strict";
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || !("IntersectionObserver" in window)) return;

  var seen = Object.create(null);
  var observer = new IntersectionObserver(function (entries) {
    var visible = entries.filter(function (entry) { return entry.isIntersecting; })
      .sort(function (a, b) { return a.boundingClientRect.top - b.boundingClientRect.top; });

    visible.forEach(function (entry, index) {
      var el = entry.target;
      observer.unobserve(el);
      el.style.setProperty("--pp-d", Math.min(index, 5) * 0.14 + "s");
      el.classList.add("in-view");

      var done = function () {
        el.classList.remove("pp-rv", "in-view");
        el.style.removeProperty("--pp-d");
      };
      var onEnd = function (event) {
        if (event.propertyName !== "transform") return;
        el.removeEventListener("transitionend", onEnd);
        done();
      };
      el.addEventListener("transitionend", onEnd);
      window.setTimeout(done, 3600 + index * 140);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -10% 0px" });

  function keyOf(el) {
    var heading = el.querySelector(".nw-main h2");
    var tab = document.querySelector('.nw-tabs [aria-selected="true"]');
    return (tab ? tab.getAttribute("data-view") : "") + "|" +
      (el.getAttribute("data-slug") || "") + "|" +
      (heading ? heading.textContent : "");
  }

  function addReveal(el) {
    if (el.__rv) return;
    el.__rv = true;
    var key = keyOf(el);
    if (seen[key]) return;
    seen[key] = true;
    el.classList.add("pp-rv");
    observer.observe(el);
  }

  function scan(root) {
    if (root.matches && root.matches(".nw-list .nw-row")) addReveal(root);
    if (root.querySelectorAll) {
      Array.prototype.forEach.call(root.querySelectorAll(".nw-list .nw-row"), addReveal);
    }
  }

  function boot() {
    scan(document);
    new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        Array.prototype.forEach.call(mutation.addedNodes, function (node) {
          if (node.nodeType === 1) scan(node);
        });
      });
    }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();