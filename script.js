(function () {
  "use strict";

  /* Откуда брать фото, задаётся в файле photos.js: ссылка на папку Яндекс Диска
     или список файлов из папки photos.
     Единственная настройка здесь:
       true  — фото в галерее перемешиваются при каждой загрузке страницы
       false — фото идут по порядку (по имени файла на Диске или как записано в photos.js) */
  const SHUFFLE = true;

  const ALL = "Все";

  /* Яндекс Диск */
  const YD_API = "https://cloud-api.yandex.net/v1/disk/public/resources";
  const YD_PREVIEW_SIZE = "XXXL";   // самый крупный размер превью, который отдаёт Диск: 1280 px по большей стороне
  const YD_PAGE = 100;              // сколько файлов просить за один запрос
  const YD_MAX = 2000;              // защита: больше стольких фото в одной папке не читаем
  const YD_TIMEOUT = 20000;         // сколько ждать ответ Диска, миллисекунд
  const YD_REFRESH_PAUSE = 30000;   // как часто можно обновлять ссылки, миллисекунд

  const MSG_NO_LIST = "Не удалось прочитать список фотографий. Проверьте, что файл photos.js загружен на GitHub рядом с index.html и в нём нет опечаток.";
  const MSG_EMPTY = "Фотографий пока нет. Добавьте их в файл photos.js.";
  const MSG_BROKEN = "Фотографии не загрузились. Проверьте, что файлы лежат в папке photos и пути в photos.js совпадают с именами файлов, включая регистр букв: на GitHub IMG_1.JPG и IMG_1.jpg это разные файлы.";

  const MSG_YD_LOADING = "Загружаю фотографии с Яндекс Диска…";
  const MSG_YD_BADLINK = "Ссылка на Яндекс Диск в photos.js не подходит. Нужна ссылка на папку, она выглядит так: https://disk.yandex.ru/d/AbCdEf123. Ссылка на отдельный файл (с /i/) не подойдёт.";
  const MSG_YD_NOTFOUND = "Яндекс Диск не открыл папку. Проверьте ссылку в photos.js и что у папки включён доступ по ссылке.";
  const MSG_YD_LIMIT = "Яндекс Диск временно ограничил доступ к папке из-за большого числа обращений. Попробуйте открыть сайт позже.";
  const MSG_YD_NETWORK = "Не удалось связаться с Яндекс Диском. Проверьте подключение к интернету и попробуйте обновить страницу.";
  const MSG_YD_FAIL = "Не удалось получить список фотографий с Яндекс Диска. Попробуйте обновить страницу. Подробности в консоли браузера (клавиша F12, вкладка Console).";
  const MSG_YD_EMPTY = "В папке на Яндекс Диске нет фотографий. Поддерживаются JPG, PNG, WebP и другие изображения. Проверьте, что в photos.js указана ссылка на нужную папку.";
  const MSG_YD_BROKEN = "Яндекс Диск не отдал сами фотографии. Возможно, он временно ограничил загрузку или доступ к папке закрыт. Откройте ссылку на папку в обычном браузере и проверьте, что фото там видны.";

  const gallery = document.getElementById("gallery");
  const filtersEl = document.getElementById("filters");
  const dlg = document.getElementById("lightbox");
  const lbImg = document.getElementById("lbImg");

  let PHOTOS = [];
  let CATEGORIES = []; // темы фильтра в постоянном порядке (не зависит от перемешивания фото)
  let activeCategory = ALL;
  let list = [];       // какие фото сейчас листаются в просмотре
  let index = 0;
  let renderId = 0;    // номер последней отрисовки галереи

  const ydSource = parseYandexLink(window.YANDEX_DISK);

  /* ---------- Чтение списка из photos.js ---------- */
  function readPhotos() {
    const source = window.PHOTOS;
    const result = [];

    function add(file, category) {
      if (typeof file === "string" && file.trim()) {
        result.push({ file: file.trim(), category: category, failed: false });
      }
    }

    if (Array.isArray(source)) {
      source.forEach(function (file) { add(file, ""); });
    } else if (source && typeof source === "object") {
      Object.keys(source).forEach(function (category) {
        [].concat(source[category]).forEach(function (file) { add(file, category); });
      });
    }
    return result;
  }

  // Случайный порядок (алгоритм Фишера — Йетса)
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }

  // Пробелы, кириллица и # в именах файлов превращаются в безопасный адрес
  function url(file) {
    if (/^https?:\/\//i.test(file)) return file;
    return file.split("/").map(encodeURIComponent).join("/");
  }

  function showNote(text) {
    gallery.textContent = "";
    const p = document.createElement("p");
    p.className = "works-note";
    p.textContent = text;
    gallery.appendChild(p);
  }

 

  /* ---------- Фильтры ---------- */
  function renderFilters() {
    // Если тема всего одна (или их нет), фильтры не нужны
    if (CATEGORIES.length < 2) {
      filtersEl.hidden = true;
      return;
    }

    [ALL].concat(CATEGORIES).forEach(function (name) {
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
    const token = ++renderId;
    const shown = PHOTOS.filter(function (p) {
      return activeCategory === ALL || p.category === activeCategory;
    });

    gallery.textContent = "";

    if (shown.length === 0) {
      showNote(typeof window.PHOTOS === "undefined" ? MSG_NO_LIST : MSG_EMPTY);
      return;
    }

    let broken = 0;

    shown.forEach(function (photo, i) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tile";
      btn.setAttribute("aria-label", "Открыть фото " + (i + 1) + " из " + shown.length);

      const img = document.createElement("img");
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";

      // Фото не найдено: прячем пустую плитку и пишем причину в консоль браузера
      function giveUp() {
        photo.failed = true;
        btn.hidden = true;
        if (window.console) console.warn("Фото не загрузилось: " + photo.file);
        if (token !== renderId) return;
        broken++;
        if (broken === shown.length) showNote(ydSource ? MSG_YD_BROKEN : MSG_BROKEN);
      }

      img.addEventListener("load", function () { photo.failed = false; });

      img.addEventListener("error", function () {
        // С Диска: сначала пробуем получить свежие ссылки, и только потом сдаёмся
        if (ydSource && !photo.retried) {
          photo.retried = true;
          refreshLinks().then(function () { img.src = url(photo.file); }, giveUp);
          return;
        }
        giveUp();
      });

      img.src = url(photo.file);

      btn.appendChild(img);
      btn.addEventListener("click", function () {
        const ok = shown.filter(function (p) { return !p.failed; });
        openLightbox(ok, ok.indexOf(photo));
      });
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
    if (!items.length) return;
    list = items;
    show(Math.max(i, 0));
    if (!dlg.open) dlg.showModal();
    document.body.classList.add("lb-open");
  }

  // Ссылка с Диска устарела: обновляем ссылки и показываем то же фото ещё раз
  lbImg.addEventListener("error", function () {
    if (!ydSource) return;
    const current = list[index];
    refreshLinks().then(function () {
      if (list[index] === current && lbImg.getAttribute("src") !== url(current.file)) {
        lbImg.src = url(current.file);
      }
    }, function () { /* ничего не делаем: фото останется пустым */ });
  });

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

  /* ---------- Кнопки в верхней панели: подсвечиваем раздел, в котором вы находитесь ---------- */
  function initNavSpy() {
    const nav = document.querySelector(".topbar nav");
    if (!nav) return;

    const items = Array.prototype.slice.call(nav.querySelectorAll('a[href^="#"]'))
      .map(function (a) {
        return { link: a, section: document.getElementById(a.getAttribute("href").slice(1)) };
      })
      .filter(function (it) { return it.section; });
    if (!items.length) return;

    let current = null;
    let queued = false;

    function update() {
      queued = false;
      const line = window.innerHeight * 0.4;
      let active = null;

      // Активен последний раздел, верх которого уже поднялся выше «линии» на 40% экрана
      items.forEach(function (it) {
        if (it.section.getBoundingClientRect().top <= line) active = it;
      });
      // В самом низу страницы всегда активен последний раздел
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        active = items[items.length - 1];
      }
      if (active === current) return;
      current = active;

      items.forEach(function (it) {
        if (it === active) it.link.setAttribute("aria-current", "location");
        else it.link.removeAttribute("aria-current");
      });

      // Если кнопки не помещаются в строку (телефон), прокручиваем панель к активной
      if (active && nav.scrollWidth > nav.clientWidth) {
        const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        nav.scrollTo({
          left: active.link.offsetLeft - (nav.clientWidth - active.link.offsetWidth) / 2,
          behavior: reduce ? "auto" : "smooth"
        });
      }
    }

    function queue() {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(update);
    }

    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    update();
  }

  /* ---------- Запуск ---------- */
  function start(photos) {
    PHOTOS = photos;

    // Порядок тем запоминаем до перемешивания, чтобы кнопки фильтра не прыгали при каждой загрузке
    CATEGORIES = [];
    PHOTOS.forEach(function (p) {
      if (p.category && CATEGORIES.indexOf(p.category) === -1) CATEGORIES.push(p.category);
    });

    if (SHUFFLE) shuffle(PHOTOS);
    list = PHOTOS;
    renderFilters();
    renderGallery();
  }

  function fail(text) {
    filtersEl.hidden = true;
    showNote(text);
  }

  document.getElementById("year").textContent = new Date().getFullYear();
  initNavSpy();

  if (!ydSource) {
    start(readPhotos());
  } else if (ydSource.invalid) {
    fail(MSG_YD_BADLINK);
  } else {
    showNote(MSG_YD_LOADING);
    loadYandex(ydSource).then(start, function (err) {
      if (window.console) console.warn(err);
      fail(ydMessage(err));
    });
  }
})();
