/* PersianPod — جست‌وجو و نوار اسلایدی موضوعات آموزش */
(function () {
  "use strict";
  var list = document.getElementById("a-list");
  if (!list) return;
  var FA = "۰۱۲۳۴۵۶۷۸۹";
  function norm(s) {
    return String(s || "").replace(/[يى]/g, "ی").replace(/ك/g, "ک")
      .replace(/[\u064B-\u065F\u0670]/g, "").replace(/\u200c/g, " ")
      .replace(/[۰-۹]/g, function (d) { return FA.indexOf(d); }).toLowerCase().trim();
  }
  var items = Array.prototype.slice.call(list.children), active = "";
  var tags = {};
  items.forEach(function (li) {
    (li.dataset.tags || "").split(",").forEach(function (t) {
      t = t.trim(); if (t) tags[t] = 1;
    });
  });
  var track = document.getElementById("a-tags");
  var current = document.getElementById("a-tag-current");
  var rail = document.getElementById("a-tag-filter");
  var prev = rail.querySelector(".pp-learn-arrow--prev");
  var next = rail.querySelector(".pp-learn-arrow--next");
  var search = document.getElementById("a-q");
  var empty = document.getElementById("a-empty");

  function center(button) {
    if (!button || track.scrollWidth <= track.clientWidth + 2) return;
    var tr = track.getBoundingClientRect(), br = button.getBoundingClientRect();
    track.scrollBy({ left: (br.left + br.width / 2) - (tr.left + tr.width / 2), behavior: "smooth" });
  }
  function updateArrows() {
    var max = track.scrollWidth - track.clientWidth;
    var rtl = getComputedStyle(track).direction === "rtl";
    var pos = Math.abs(track.scrollLeft);
    prev.hidden = max < 2 || (rtl ? max - pos : pos) < 2;
    next.hidden = max < 2 || (rtl ? pos : max - pos) < 2;
    rail.classList.toggle("has-overflow", max > 2);
  }
  function scrollByPage(dir) {
    track.scrollBy({ left: dir * Math.max(160, track.clientWidth * .7), behavior: "smooth" });
  }
  prev.addEventListener("click", function(){ scrollByPage(-1); });
  next.addEventListener("click", function(){ scrollByPage(1); });
  track.addEventListener("scroll", updateArrows, {passive:true});
  if (window.ResizeObserver) new ResizeObserver(updateArrows).observe(track);
  window.addEventListener("resize", updateArrows);

  function apply() {
    var q = norm(search.value), shown = 0;
    items.forEach(function(li) {
      var tagList = (li.dataset.tags || "").split(",").map(function(s){return s.trim();});
      var ok = (!q || norm(li.dataset.text).indexOf(q) !== -1) && (!active || tagList.indexOf(active) !== -1);
      li.hidden = !ok; if (ok) shown++;
    });
    empty.hidden = shown > 0;
  }
  function choose(tag, button) {
    active = tag;
    track.querySelectorAll("button[data-tag]").forEach(function (b) {
      var selected = b.getAttribute("data-tag") === active;
      b.classList.toggle("is-active", selected);
      b.setAttribute("aria-pressed", String(selected));
    });
    current.hidden = !active;
    current.textContent = active ? "فیلتر فعال: " + active + " ×" : "";
    apply();
    center(button);
  }
  Object.keys(tags).sort(function (a,b) { return a.localeCompare(b,"fa"); }).forEach(function (tag) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "pp-learn-tag";
    b.textContent = tag; b.setAttribute("data-tag", tag); b.setAttribute("aria-pressed","false");
    b.addEventListener("click", function(){ choose(tag,b); });
    track.appendChild(b);
  });
  track.querySelector('[data-tag=""]').addEventListener("click", function(){ choose("",this); });
  current.addEventListener("click", function(){ choose("",track.querySelector('[data-tag=""]')); });
  search.addEventListener("input", apply);

  /* کشیدن نوار با ماوس؛ لمس موبایل به‌صورت طبیعی و بومی کار می‌کند. */
  var drag = null, moved = false;
  track.addEventListener("mousedown", function(e) {
    if (e.button !== 0 || track.scrollWidth <= track.clientWidth + 2) return;
    drag = {x:e.clientX, left:track.scrollLeft}; moved = false;
  });
  window.addEventListener("mousemove", function(e) {
    if (!drag) return;
    var dx=e.clientX-drag.x;
    if (!moved && Math.abs(dx)<5) return;
    moved=true; track.classList.add("is-dragging"); track.scrollLeft=drag.left-dx; e.preventDefault();
  });
  function stopDrag() {
    if (!drag) return;
    track.classList.remove("is-dragging"); drag=null;
    setTimeout(function(){moved=false;},0);
  }
  window.addEventListener("mouseup",stopDrag);
  window.addEventListener("blur",stopDrag);
  track.addEventListener("click",function(e){
    if(moved){e.preventDefault();e.stopPropagation();}
  },true);
  updateArrows();
})();