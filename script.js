(function () {
  "use strict";

  /* Список фотографий лежит в файле photos.js, здесь ничего менять не нужно. */

  const ALL = "Все";
  const SOURCE = window.PHOTOS || [];

  // Приводим список к виду [{ file, category }]
  const PHOTOS = [];
  if (Array.isArray(SOURCE)) {
    SOURCE.forEach(function (file) { PHOTOS.push({ file: file, category: "" }); });
  } else {
    Object.keys(SOURCE).forEach(function (category) {
      SOURCE[category].forEach(function (file) {
        PHOTOS.push({ file: file, category: category });
      });
    });
  }

  const gallery = document.getElementById("gallery");
  const filtersEl = document.getElementById("filters");
  const dlg = document.getElementById("lightbox");
  const lbImg = document.getElementById("lbImg");

  let activeCategory = ALL;
  let list = PHOTOS;   // какие фото сейчас листаются в просмотре
  let index = 0;

  // Пробелы, кириллица и # в именах файлов превращаются в безопасный адрес
  function url(file) {
    if (/^https?:\/\//i.test(file)) return file;
    return file.split("/").map(encodeURIComponent).join("/");
  }

  /* ---------- Фильтры ---------- */
  function renderFilters() {
    const cats = [];
    PHOTOS.forEach(function (p) {
      if (p.category && cats.indexOf(p.category) === -1) cats.push(p.category);
    });

    // Если тема всего одна (или их нет), фильтры не нужны
    if (cats.length < 2) {
      filtersEl.hidden = true;
      return;
    }

    [ALL].concat(cats).forEach(function (name) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.textContent = name;
      b.setAttribute("aria-pressed", name === activeCategory ? "true" : "false");
      b.addEventListener("click", function () {
        activeCategory = name;
        Array.prototype.forEach.call(filtersEl.children, function (c) {
          c.setAttribute("aria-pressed", c === b ? "true" : "false");
        });
        renderGallery();
      });
      filtersEl.appendChild(b);
    });
  }

  /* ---------- Галерея ---------- */
  function renderGallery() {
    const shown = PHOTOS.filter(function (p) {
      return activeCategory === ALL || p.category === activeCategory;
    });

    gallery.textContent = "";

    if (shown.length === 0) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "Фотографий пока нет. Добавьте их в файл photos.js.";
      gallery.appendChild(empty);
      return;
    }

    shown.forEach(function (photo, i) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tile";
      btn.setAttribute("aria-label", "Открыть фото " + (i + 1) + " из " + shown.length);

      const img = document.createElement("img");
      img.src = url(photo.file);
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";

      btn.appendChild(img);
      btn.addEventListener("click", function () { openLightbox(shown, i); });
      gallery.appendChild(btn);
    });
  }

  /* ---------- Просмотр на весь экран ---------- */
  function show(i) {
    index = (i + list.length) % list.length;
    lbImg.src = url(list[index].file);
    lbImg.alt = "Фото " + (index + 1) + " из " + list.length;

    const single = list.length < 2;
    dlg.querySelector(".lb-prev").hidden = single;
    dlg.querySelector(".lb-next").hidden = single;

    // Заранее подгружаем следующий снимок, чтобы листать без паузы
    if (!single) new Image().src = url(list[(index + 1) % list.length].file);
  }

  function openLightbox(items, i) {
    list = items;
    show(i);
    if (!dlg.open) dlg.showModal();
    document.body.classList.add("lb-open");
  }

  dlg.querySelector(".lb-close").addEventListener("click", function () { dlg.close(); });
  dlg.querySelector(".lb-prev").addEventListener("click", function () { show(index - 1); });
  dlg.querySelector(".lb-next").addEventListener("click", function () { show(index + 1); });

  dlg.addEventListener("close", function () {
    document.body.classList.remove("lb-open");
  });

  // Клик по тёмному фону закрывает просмотр
  dlg.addEventListener("click", function (e) {
    if (!e.target.closest("img, button")) dlg.close();
  });

  dlg.addEventListener("keydown", function (e) {
    if (e.key === "ArrowLeft") show(index - 1);
    if (e.key === "ArrowRight") show(index + 1);
  });

  // Листание свайпом на телефоне
  let touchX = null;
  dlg.addEventListener("touchstart", function (e) {
    touchX = e.changedTouches[0].clientX;
  }, { passive: true });
  dlg.addEventListener("touchend", function (e) {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) > 50) show(dx > 0 ? index - 1 : index + 1);
  }, { passive: true });

  /* ---------- Запуск ---------- */
  document.getElementById("year").textContent = new Date().getFullYear();
  renderFilters();
  renderGallery();
})();
