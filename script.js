(function () {
  "use strict";

  const SHUFFLE = true;
  const ALL = "Все";

  /* ================= Google Drive API ================= */
  const GD_API = "https://www.googleapis.com/drive/v3/files";
  const GD_PAGE = 1000; // Максимум для одного запроса

  const MSG_NO_KEY = "Не указан API-ключ Google. Добавьте его в файл photos.js в переменную GOOGLE_API_KEY.";
  const MSG_NO_FOLDER = "Не указана ссылка на папку Google Drive в photos.js.";
  const MSG_EMPTY = "Фотографий пока нет. Добавьте их в папку на Google Drive.";
  const MSG_LOADING = "Загружаю фотографии с Google Drive…";
  const MSG_ERROR = "Не удалось загрузить фотографии с Google Drive. Проверьте API-ключ, ссылку на папку и права доступа.";
  const MSG_DRIVE_ERROR = "Google Drive вернул ошибку. Возможно, превышен лимит запросов или неверен API-ключ. Подробности в консоли.";

  const gallery = document.getElementById("gallery");
  const filtersEl = document.getElementById("filters");
  const dlg = document.getElementById("lightbox");
  const lbImg = document.getElementById("lbImg");

  let PHOTOS = [];
  let CATEGORIES = [];
  let activeCategory = ALL;
  let list = [];
  let index = 0;
  let renderId = 0;

  const apiKey = window.GOOGLE_API_KEY;
  const folderUrl = window.GOOGLE_DRIVE_FOLDER;
  const folderId = extractFolderId(folderUrl);

  /* ---------- Утилиты ---------- */
  function extractFolderId(url) {
    if (!url) return null;
    const match = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function showNote(text) {
    gallery.textContent = "";
    const p = document.createElement("p");
    p.className = "works-note";
    p.textContent = text;
    gallery.appendChild(p);
  }

  /* ---------- Google Drive: список файлов ---------- */
  function fetchDriveFiles(folderId, pageToken) {
    const q = `'${folderId}' in parents and trashed = false`;
    const fields = "nextPageToken, files(id, name, mimeType)";
    let url = `${GD_API}?q=${encodeURIComponent(q)}&key=${apiKey}&fields=${encodeURIComponent(fields)}&pageSize=${GD_PAGE}`;
    if (pageToken) {
      url += `&pageToken=${encodeURIComponent(pageToken)}`;
    }
    return fetch(url).then(res => {
      if (!res.ok) throw new Error("Drive API error: " + res.status);
      return res.json();
    });
  }

  // Рекурсивный сбор файлов: подпапки становятся категориями
  function loadAllPhotos(folderId, category = "") {
    let allPhotos = [];

    function processPage(pageToken) {
      return fetchDriveFiles(folderId, pageToken).then(data => {
        const files = data.files || [];
        const subfolderPromises = [];

        files.forEach(file => {
          if (file.mimeType === "application/vnd.google-apps.folder") {
            // Подпапка: рекурсивный вызов
            subfolderPromises.push(loadAllPhotos(file.id, file.name));
          } else if (file.mimeType.startsWith("image/")) {
            // Изображение: формируем прямую ссылку
            allPhotos.push({
              id: file.id,
              file: `https://lh3.googleusercontent.com/d/${file.id}`,
              category: category,
              failed: false
            });
          }
        });

        // Сначала добавляем фото из текущей папки, затем из подпапок
        return Promise.all(subfolderPromises).then(nested => {
          nested.forEach(arr => allPhotos = allPhotos.concat(arr));

          if (data.nextPageToken) {
            return processPage(data.nextPageToken);
          }
          return allPhotos;
        });
      });
    }

    return processPage(null);
  }

  /* ---------- Отрисовка (фильтры, галерея, лайтбокс) ---------- */
  function renderFilters() {
    if (CATEGORIES.length < 2) {
      filtersEl.hidden = true;
      return;
    }
    [ALL].concat(CATEGORIES).forEach(name => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.textContent = name;
      b.setAttribute("aria-pressed", name === activeCategory ? "true" : "false");
      b.addEventListener("click", () => {
        activeCategory = name;
        Array.from(filtersEl.children).forEach(c => c.setAttribute("aria-pressed", c === b ? "true" : "false"));
        renderGallery();
      });
      filtersEl.appendChild(b);
    });
  }

  function renderGallery() {
    const token = ++renderId;
    const shown = PHOTOS.filter(p => activeCategory === ALL || p.category === activeCategory);
    gallery.textContent = "";

    if (shown.length === 0) {
      showNote(MSG_EMPTY);
      return;
    }

    let broken = 0;
    shown.forEach((photo, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tile";
      btn.setAttribute("aria-label", `Открыть фото ${i + 1} из ${shown.length}`);

      const img = document.createElement("img");
      img.crossOrigin = "anonymous"; // Помогает при возможных CORS-проблемах[reference:2]
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";

      img.addEventListener("load", () => { photo.failed = false; });
      img.addEventListener("error", () => {
        photo.failed = true;
        btn.hidden = true;
        if (window.console) console.warn("Фото не загрузилось: " + photo.file);
        if (token !== renderId) return;
        broken++;
        if (broken === shown.length) showNote(MSG_ERROR);
      });

      img.src = photo.file;
      btn.appendChild(img);
      btn.addEventListener("click", () => {
        const ok = shown.filter(p => !p.failed);
        openLightbox(ok, ok.indexOf(photo));
      });
      gallery.appendChild(btn);
    });
  }

  /* ---------- Лайтбокс (без изменений) ---------- */
  function show(i) {
    index = (i + list.length) % list.length;
    lbImg.src = list[index].file;
    lbImg.alt = `Фото ${index + 1} из ${list.length}`;
    const single = list.length < 2;
    dlg.querySelector(".lb-prev").hidden = single;
    dlg.querySelector(".lb-next").hidden = single;
    if (!single) new Image().src = list[(index + 1) % list.length].file;
  }

  function openLightbox(items, i) {
    if (!items.length) return;
    list = items;
    show(Math.max(i, 0));
    if (!dlg.open) dlg.showModal();
    document.body.classList.add("lb-open");
  }

  dlg.querySelector(".lb-close").addEventListener("click", () => dlg.close());
  dlg.querySelector(".lb-prev").addEventListener("click", () => show(index - 1));
  dlg.querySelector(".lb-next").addEventListener("click", () => show(index + 1));
  dlg.addEventListener("close", () => document.body.classList.remove("lb-open"));
  dlg.addEventListener("click", e => { if (!e.target.closest("img, button")) dlg.close(); });
  dlg.addEventListener("keydown", e => {
    if (e.key === "ArrowLeft") show(index - 1);
    if (e.key === "ArrowRight") show(index + 1);
  });

  let touchX = null;
  dlg.addEventListener("touchstart", e => { touchX = e.changedTouches[0].clientX; }, { passive: true });
  dlg.addEventListener("touchend", e => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) > 50) show(dx > 0 ? index - 1 : index + 1);
  }, { passive: true });

  /* ---------- Запуск ---------- */
  function start(photos) {
    PHOTOS = photos;
    CATEGORIES = [];
    PHOTOS.forEach(p => { if (p.category && !CATEGORIES.includes(p.category)) CATEGORIES.push(p.category); });
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

  if (!apiKey) {
    fail(MSG_NO_KEY);
  } else if (!folderId) {
    fail(MSG_NO_FOLDER);
  } else {
    showNote(MSG_LOADING);
    loadAllPhotos(folderId).then(start).catch(err => {
      if (window.console) console.error(err);
      fail(MSG_DRIVE_ERROR);
    });
  }
})();