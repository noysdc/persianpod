/* PersianPod UI — روز/شب، اندازه فونت، حالت مطالعه
   همه‌ی انتخاب‌ها در localStorage ذخیره می‌شوند. */
(function () {
  "use strict";
  var root = document.documentElement;
  var KEY = { theme: "pp-theme", font: "pp-font", read: "pp-reading" };
  var SIZES = [87.5, 100, 112.5, 125, 150];   // درصد

  function get(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  var theme = get(KEY.theme, null) ||
    (window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  var fontIdx = Math.min(Math.max(parseInt(get(KEY.font, "1"), 10) || 1, 0), SIZES.length - 1);
  var reading = get(KEY.read, "0") === "1";

  function apply() {
    root.setAttribute("data-theme", theme);
    root.style.setProperty("--pp-font-scale", SIZES[fontIdx] + "%");
    root.classList.toggle("pp-reading", reading);
  }
  apply();

  function btn(label, text, onClick, pressed) {
    var b = document.createElement("button");
    b.type = "button";
    b.setAttribute("aria-label", label);
    b.title = label;
    b.textContent = text;
    if (pressed !== undefined) b.setAttribute("aria-pressed", String(pressed));
    b.addEventListener("click", onClick);
    return b;
  }

  function build() {
    if (document.getElementById("pp-toolbar")) return;
    var bar = document.createElement("div");
    bar.id = "pp-toolbar";
    bar.setAttribute("role", "toolbar");
    bar.setAttribute("aria-label", "تنظیمات نمایش");

    var themeBtn = btn("تغییر حالت روز و شب", theme === "dark" ? "☀" : "☾", function () {
      theme = theme === "dark" ? "light" : "dark";
      set(KEY.theme, theme); apply();
      themeBtn.textContent = theme === "dark" ? "☀" : "☾";
    });

    var smaller = btn("کوچک‌کردن فونت", "A−", function () {
      if (fontIdx > 0) { fontIdx--; set(KEY.font, fontIdx); apply(); }
    });
    var bigger = btn("بزرگ‌کردن فونت", "A+", function () {
      if (fontIdx < SIZES.length - 1) { fontIdx++; set(KEY.font, fontIdx); apply(); }
    });

    var readBtn = btn("حالت مطالعه", "مطالعه", function () {
      reading = !reading; set(KEY.read, reading ? "1" : "0"); apply();
      readBtn.setAttribute("aria-pressed", String(reading));
    }, reading);

    var sep = document.createElement("span"); sep.className = "pp-sep";
    var sep2 = sep.cloneNode();

    bar.append(themeBtn, sep, smaller, bigger, sep2, readBtn);

    // اگر در صفحه‌ات المانی با data-pp-toolbar داری، نوار داخل همان می‌رود
    var slot = document.querySelector("[data-pp-toolbar]");
    if (slot) { bar.style.position = "static"; bar.style.boxShadow = "none"; slot.appendChild(bar); }
    else document.body.appendChild(bar);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
})();
