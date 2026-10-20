(function () {
  "use strict";

  /* ============================================================
     ВАШИ ФОТОГРАФИИ
     Чтобы добавить снимок, скопируйте любую строку ниже и поменяйте:
       file      путь к файлу в папке photos (jpg, webp, png)
       title     название, оно появится при наведении и в просмотре
       category  тема для фильтра (например: Пейзаж, Портрет, Свадьбы)
       width, height  размеры фото в пикселях. Нужны только пропорции,
                      так страница не «прыгает» при загрузке
       alt       короткое описание для незрячих людей и поисковиков
       featured  true у одного снимка: он показывается на первом экране
     ============================================================ */
  const PHOTOS = [
    { file: "photos/01.svg", title: "Рассвет над холмами", category: "Пейзаж", width: 1200, height: 800, alt: "Холмы на рассвете и оранжевое небо", featured: true },
    { file: "photos/02.svg", title: "Портрет в контровом свете", category: "Портрет", width: 800, height: 1200, alt: "Силуэт человека в тёплом контровом свете" },
    { file: "photos/03.svg", title: "Вечерний квартал", category: "Улица", width: 800, height: 1000, alt: "Городской квартал с горящими окнами" },
    { file: "photos/04.svg", title: "Туман в долине", category: "Пейзаж", width: 1200, height: 800, alt: "Туманная долина в мягком свете" },
    { file: "photos/05.svg", title: "Золотой час", category: "Портрет", width: 800, height: 1000, alt: "Портрет на фоне золотого заката" },
    { file: "photos/06.svg", title: "Огни города", category: "Улица", width: 1200, height: 800, alt: "Городская улица в сумерках" },
    { file: "photos/07.svg", title: "Закат у воды", category: "Пейзаж", width: 1000, height: 1000, alt: "Красное солнце садится за холмы" },
    { file: "photos/08.svg", title: "Силуэт", category: "Портрет", width: 800, height: 1200, alt: "Тёмный силуэт на тёплом фоне" },
    { file: "photos/09.svg", title: "Последний трамвай", category: "Улица", width: 1200, height: 800, alt: "Вечерняя улица с тёплыми огнями" }
  ];

  const ALL = "Все";

  const gallery = document.getElementById("gallery");
  const filtersEl = document.getElementById("filters");
  const heroFig = document.getElementById("heroPhoto");
  const dlg = document.getElementById("lightbox");
  const lbImg = document.getElementById("lbImg");
  const lbCap = document.getElementById("lbCap");

  let activeCategory = ALL;
  let list = PHOTOS;   // какие фото сейчас листаются в просмотре
  let index = 0;

  /* ---------- Первый экран ---------- */
  function renderHero() {
    const photo = PHOTOS.find(function (p) { return p.featured; }) || PHOTOS[0];
    if (!photo) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "hero-open";
    btn.setAttribute("aria-label", "Открыть фото: " + photo.title);

    const img = document.createElement("img");
    img.src = photo.file;
    img.width = photo.width;
    img.height = photo.height;
    img.alt = photo.alt || photo.title;
    img.fetchPriority = "high";
    btn.appendChild(img);

    const cap = document.createElement("figcaption");
    cap.textContent = photo.title;

    btn.addEventListener("click", function () {
      openLightbox(PHOTOS, PHOTOS.indexOf(photo));
    });

    heroFig.appendChild(btn);
    heroFig.appendChild(cap);
  }

  /* ---------- Фильтры ---------- */
  function renderFilters() {
    const cats = [];
    PHOTOS.forEach(function (p) {
      if (p.category && cats.indexOf(p.category) === -1) cats.push(p.category);
    });

    // Если тема всего одна, фильтры не нужны
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

    shown.forEach(function (photo, i) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "shot";
      btn.setAttribute("aria-label", "Открыть фото: " + photo.title);

      const img = document.createElement("img");
      img.src = photo.file;
      img.width = photo.width;
      img.height = photo.height;
      img.alt = photo.alt || photo.title;
      img.loading = "lazy";
      img.decoding = "async";

      const cap = document.createElement("span");
      cap.className = "shot-cap";
      const t = document.createElement("span");
      t.className = "shot-title";
      t.textContent = photo.title;
      const c = document.createElement("span");
      c.className = "shot-cat";
      c.textContent = photo.category || "";
      cap.appendChild(t);
      cap.appendChild(c);

      btn.appendChild(img);
      btn.appendChild(cap);
      btn.addEventListener("click", function () { openLightbox(shown, i); });
      gallery.appendChild(btn);
    });
  }

  /* ---------- Просмотр на весь экран ---------- */
  function show(i) {
    index = (i + list.length) % list.length;
    const p = list[index];
    lbImg.src = p.file;
    lbImg.alt = p.alt || p.title;

    lbCap.textContent = "";
    lbCap.appendChild(document.createTextNode(p.title));
    if (p.category) {
      const em = document.createElement("em");
      em.textContent = p.category;
      lbCap.appendChild(em);
    }

    const single = list.length < 2;
    dlg.querySelector(".lb-prev").hidden = single;
    dlg.querySelector(".lb-next").hidden = single;
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
    if (!e.target.closest("img, button, figcaption")) dlg.close();
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
  renderHero();
  renderFilters();
  renderGallery();
})();
