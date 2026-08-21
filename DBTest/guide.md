# Apna College Database — Usage Guide

This guide explains how to read `apna_videos.db` from any other project so you can
download videos, PDFs and code files without scraping Apna College again.

## Overview

| Table        | Contents                                   |
|--------------|--------------------------------------------|
| `courses`    | Course id + display name                   |
| `videos`     | One row per lecture (stream URLs)          |
| `pdfs`       | One row per PDF (B2 key + buzzheavier link)|
| `code_files` | One row per code file (B2 key + link)      |

File location: `apna_videos.db` (SQLite, WAL mode). Open it with any SQLite client or
the `sqlite3` Python module.

## Schema

```
courses(id TEXT PRIMARY KEY, name TEXT, scraped_at TIMESTAMP)
videos(id, course_id, chapter_num, chapter_name, video_index, title,
       wistia_url, stream_url, downloaded)
pdfs(id, course_id, chapter_num, chapter_name, pdf_index, title,
     b2_key, bh_url, filename, file_size, stamped, uploaded_at)
code_files(id, course_id, chapter_num, chapter_name, file_index, title,
     filename, b2_key, bh_url, file_size, scraped_at)
```

Key points:

- `videos.stream_url` — permanent HLS (`.m3u8`) URL. No expiry. Download with
  `yt-dlp` / `ffmpeg`.
- `pdfs.b2_key` / `code_files.b2_key` — the **permanent object key** on Backblaze B2.
  **Do not use this as a URL.** Generate a fresh signed URL at download time (below).
- `pdfs.bh_url` / `code_files.bh_url` — permanent Buzzheavier share link, backup copy.
- `pdfs.stamped` — `1` = the stored file still has the Apna College watermark (legacy
  rows), remove it after download. `0` = already clean, use as-is.
- Old `gofile_*` and `b2_url` columns may still exist in older databases. Ignore them.
  `b2_url` held an expiring presigned URL (7 days) — that is why downloads broke.
  The migration on script start extracts the object key from those old URLs into
  `b2_key`.

## Listing content

```python
import sqlite3
db = sqlite3.connect("apna_videos.db")

courses = db.execute("SELECT id, name FROM courses").fetchall()

# chapters of one course with counts
rows = db.execute("""
    SELECT c.chapter_name,
           (SELECT COUNT(*) FROM videos v WHERE v.course_id = c.course_id AND v.chapter_name = c.chapter_name),
           (SELECT COUNT(*) FROM pdfs p WHERE p.course_id = c.course_id AND p.chapter_name = c.chapter_name),
           (SELECT COUNT(*) FROM code_files cf WHERE cf.course_id = c.course_id AND cf.chapter_name = c.chapter_name)
    FROM (SELECT DISTINCT course_id, chapter_name FROM videos WHERE course_id = ?) c
""", ("sigma-12",)).fetchall()
```

## Downloading videos

`stream_url` is a ready-to-use HLS stream:

```bash
yt-dlp "https://.../master.m3u8" -o "lecture.mp4"
# or ffmpeg -i "<stream_url>" -c copy lecture.mp4
```

## Downloading PDFs / code files (B2 primary)

The B2 bucket is private. Generate a short-lived presigned URL from `b2_key` using the
same keys as the downloader:

```python
import boto3
from botocore.config import Config

B2_ENDPOINT = "https://s3.eu-central-003.backblazeb2.com"
B2_BUCKET   = "samonide-pdf-storage"
B2_KEY_ID   = "0033460544f8d9f0000000001"
B2_APP_KEY  = "K003064GaKhKCh26s9lqJmcS4EnZcRE"
B2_REGION   = "eu-central-003"

s3 = boto3.client("s3",
    endpoint_url=B2_ENDPOINT,
    aws_access_key_id=B2_KEY_ID,
    aws_secret_access_key=B2_APP_KEY,
    config=Config(signature_version="s3v4"),
    region_name=B2_REGION)

row = db.execute("SELECT title, b2_key FROM pdfs WHERE course_id=? AND chapter_name=? LIMIT 1",
                 ("sigma-12", "Welcome to Sigma 12!")).fetchone()
title, b2_key = row

url = s3.generate_presigned_url("get_object",
      Params={"Bucket": B2_BUCKET, "Key": b2_key}, ExpiresIn=3600)
# download url with requests / curl
```

Example flow:

```python
import requests
r = requests.get(url, timeout=60)
open(f"{title}.pdf", "wb").write(r.content)
```

Same pattern for `code_files` using `b2_key`.

## Buzzheavier backup (fallback)

`bh_url` looks like `https://buzzheavier.com/<fileId>`. It is a permanent share page.

- If B2 is unreachable, fall back to it: `requests.get(bh_url)`.
- Note: Buzzheavier may show a Cloudflare check from datacenter IPs; from a normal
  residential connection it works.
- Uploads are anonymous by default and **expire after ~4 days**. For permanent backups
  set `BUZZHEAVIER_ACCOUNT_ID` in `apnadownloader.py` (your account id from
  buzzheavier.com settings). Uploads with that token are tied to your account and kept.

## New uploads (from the downloader)

Going forward `apnadownloader.py`:

1. Downloads the **stamped** PDF from Apna College.
2. Removes the watermark/stamp (`remove_pdf_stamp` — text spans with emails, tight
   quads for rotated stamps, background-matched redaction fill so no white box is left).
3. Uploads the **clean** PDF to B2 (primary) and Buzzheavier (backup) in parallel.
4. Saves `b2_key`, `bh_url` and `stamped=0` to the DB.

So any PDF uploaded with the new code is clean; old rows are `stamped=1` and the
downloader strips the stamp on the fly.

## Re-generating access for the future

Presigned URLs expire, but that is fine: regenerate from `b2_key` whenever you need
the file. `b2_key` itself never expires, so the DB stays permanently usable.
