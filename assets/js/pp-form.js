/* PersianPod — ارسال پرسشنامه به ایمیل از طریق Cloudflare Worker روی همین دامنه (/api/form)، با ذخیره‌ی پیش‌نویس */
(function () {
  "use strict";
  var form = document.getElementById("pp-join");
  if (!form) return;
  var DRAFT = "pp-join-draft";
  var status = document.getElementById("pp-status");
  var submit = document.getElementById("pp-submit");
  var fallback = document.getElementById("pp-fallback");
  var thanks = document.getElementById("pp-thanks");

  /* --- شمارنده‌ی کاراکتر --- */
  document.querySelectorAll(".pp-counter").forEach(function (c) {
    var el = document.getElementById(c.dataset.for), max = +c.dataset.max;
    function upd() { c.textContent = el.value.length + " / " + max; }
    el.addEventListener("input", upd); upd();
  });

  /* --- پیش‌نویس --- */
  function fields() { return Array.prototype.slice.call(form.querySelectorAll("input[name], textarea, select")); }
  function saveDraft() {
    try {
      var d = {};
      fields().forEach(function (el) {
        if (el.type === "hidden" || el.name === "botcheck") return;
        d[el.name] = el.type === "checkbox" ? el.checked : el.value;
      });
      localStorage.setItem(DRAFT, JSON.stringify(d));
    } catch (e) {}
  }
  function loadDraft() {
    try {
      var d = JSON.parse(localStorage.getItem(DRAFT) || "null"); if (!d) return;
      fields().forEach(function (el) {
        if (!(el.name in d)) return;
        if (el.type === "checkbox") el.checked = !!d[el.name]; else el.value = d[el.name];
      });
      document.querySelectorAll(".pp-counter").forEach(function (c) {
        document.getElementById(c.dataset.for).dispatchEvent(new Event("input"));
      });
    } catch (e) {}
  }
  loadDraft();
  form.addEventListener("input", saveDraft);
  form.addEventListener("change", saveDraft);

  /* --- ساخت داده --- */
  function collect() {
    var data = {};
    fields().forEach(function (el) {
      if (!el.name) return;
      if (el.type === "checkbox") {
        if (el.name === "botcheck") { data.botcheck = el.checked; return; }
        data[el.name] = el.checked ? "بله" : "خیر";
      } else if (el.value.trim() !== "") {
        data[el.name] = el.value.trim();
      }
    });
    return data;
  }
  function asText(data) {
    return Object.keys(data).filter(function (k) { return ["access_key", "subject", "from_name", "botcheck"].indexOf(k) === -1; })
      .map(function (k) { return k + ":\n" + data[k]; }).join("\n\n");
  }

  function fail(msg) {
    status.textContent = msg; status.className = "err";
    submit.disabled = false;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    status.className = ""; status.textContent = ""; fallback.hidden = true;

    // اعتبارسنجی ساده با پیام فارسی
    var firstBad = null;
    form.querySelectorAll("[required]").forEach(function (el) {
      var bad = el.type === "checkbox" ? !el.checked : !el.value.trim();
      if (!bad && el.type === "email") bad = !/^\S+@\S+\.\S+$/.test(el.value.trim());
      el.classList.toggle("invalid", bad);
      if (bad && !firstBad) firstBad = el;
    });
    if (firstBad) {
      fail("لطفاً موارد ستاره‌دار را کامل کنید.");
      firstBad.scrollIntoView({ block: "center" }); firstBad.focus();
      return;
    }

    var data = collect();

    submit.disabled = true; status.textContent = "در حال ارسال…";
    fetch("/api/form", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(data)
    }).then(function (r) { return r.json(); }).then(function (res) {
      if (res && res.success) {
        try { localStorage.removeItem(DRAFT); } catch (e) {}
        form.hidden = true; thanks.hidden = false; thanks.focus();
        thanks.scrollIntoView({ block: "center" });
      } else {
        fail("ارسال انجام نشد. دوباره تلاش کنید یا از راه‌های جایگزین استفاده کنید.");
        fallback.hidden = false;
      }
    }).catch(function () {
      fail("اتصال برقرار نشد. اینترنت را بررسی کنید و دوباره تلاش کنید.");
      fallback.hidden = false;
    });
  });

  document.getElementById("pp-copy").addEventListener("click", function () {
    var txt = asText(collect());
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () {
      status.className = ""; status.textContent = "پاسخ‌ها کپی شد.";
    }).catch(function () {
      var t = document.createElement("textarea"); t.value = txt; document.body.appendChild(t); t.select();
      try { document.execCommand("copy"); status.textContent = "پاسخ‌ها کپی شد."; } catch (e) {}
      document.body.removeChild(t);
    });
  });
})();
