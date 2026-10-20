#!/usr/bin/env python3
"""
Собирает список фотографий (файл photos.js) из папок внутри photos/.

Как пользоваться:
  1. Создайте внутри папки photos подпапки по темам, например
     photos/Портреты, photos/Пейзажи, photos/Свадьбы.
     Название подпапки станет названием темы в фильтре.
  2. Разложите в них фотографии.
  3. Запустите скрипт:  python3 update-photos.py   (на Windows: python update-photos.py)
  4. Загрузите обновлённый photos.js и папку photos на GitHub.

Внимание: скрипт полностью перезаписывает photos.js.
Файлы, лежащие прямо в папке photos (не в подпапках), в галерею не попадают.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PHOTOS_DIR = ROOT / "photos"
EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif", ".svg"}

HEADER = """/* Этот файл создан скриптом update-photos.py.
   Чтобы обновить список, добавьте фото в подпапки photos и запустите скрипт снова.
   Править файл вручную тоже можно, но скрипт его перезапишет. */
"""


def natural_key(text):
    """Сортировка, при которой IMG_2 идёт раньше IMG_10."""
    return [int(part) if part.isdigit() else part.lower() for part in re.split(r"(\d+)", text)]


def main():
    if not PHOTOS_DIR.is_dir():
        sys.exit("Не нашёл папку photos рядом со скриптом.")

    groups = {}
    folders = sorted((p for p in PHOTOS_DIR.iterdir() if p.is_dir()), key=lambda p: natural_key(p.name))
    for folder in folders:
        files = sorted(
            (f for f in folder.iterdir() if f.is_file() and f.suffix.lower() in EXTENSIONS),
            key=lambda f: natural_key(f.name),
        )
        if files:
            groups[folder.name] = ["photos/%s/%s" % (folder.name, f.name) for f in files]

    if not groups:
        sys.exit("В подпапках photos нет фотографий. Создайте подпапки по темам и положите в них снимки.")

    content = HEADER + "window.PHOTOS = " + json.dumps(groups, ensure_ascii=False, indent=2) + ";\n"
    (ROOT / "photos.js").write_text(content, encoding="utf-8")

    total = sum(len(v) for v in groups.values())
    print("Готово: %d фото в %d темах." % (total, len(groups)))
    for name, files in groups.items():
        print("  %s: %d" % (name, len(files)))


if __name__ == "__main__":
    main()
