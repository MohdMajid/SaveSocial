import os
import sys
import re
import time
import uuid
import html
import shutil
import urllib.parse
import threading
import subprocess
from pathlib import Path
from typing import Dict, Any, Optional, List, Tuple

from fastapi import FastAPI, Form, HTTPException, Request, Query
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import yt_dlp
import requests

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

# Handle Serverless (Vercel) where root filesystem is read-only except /tmp
if os.environ.get("VERCEL") or not os.access(BASE_DIR, os.W_OK):
    DOWNLOAD_DIR = Path("/tmp/downloads")
else:
    DOWNLOAD_DIR = BASE_DIR / "downloads"

DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)

# In-memory store for background download jobs
JOBS: Dict[str, Dict[str, Any]] = {}
JOBS_LOCK = threading.Lock()

# Standard browser headers for CDN proxy and redirect resolution
BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "identity;q=1, *;q=0",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
}

def get_ffmpeg_path() -> Optional[str]:
    """Locate ffmpeg binary across system PATH, imageio-ffmpeg, local bin, and venv."""
    p = shutil.which("ffmpeg")
    if p:
        return p

    try:
        import imageio_ffmpeg
        p = imageio_ffmpeg.get_ffmpeg_exe()
        if p and os.path.isfile(p):
            return p
    except Exception:
        pass

    candidates = [
        BASE_DIR / "bin" / "ffmpeg.exe",
        Path(sys.executable).parent / "ffmpeg.exe",
        BASE_DIR / "ffmpeg.exe",
        BASE_DIR / "ffmpeg" / "bin" / "ffmpeg.exe",
    ]
    for c in candidates:
        if c.is_file():
            return str(c)

    local_app_data = os.environ.get("LOCALAPPDATA", "")
    if local_app_data:
        winget_links = Path(local_app_data) / "Microsoft" / "WinGet" / "Links" / "ffmpeg.exe"
        if winget_links.is_file():
            return str(winget_links)
        for cand in Path(local_app_data).glob("Microsoft/WinGet/Packages/**/ffmpeg.exe"):
            if cand.is_file():
                return str(cand)

    for common in [
        r"C:\ffmpeg\bin\ffmpeg.exe",
        r"C:\Program Files\ffmpeg\bin\ffmpeg.exe",
    ]:
        if os.path.isfile(common):
            return common

    return None

def setup_environment():
    """Ensure local bin, FFmpeg directory, Deno, and Node are included in system PATH."""
    paths_to_add = [
        str(BASE_DIR / "bin"),
        str(Path.home() / ".deno" / "bin"),
        r"C:\Program Files\nodejs",
    ]
    ffmpeg_exe = get_ffmpeg_path()
    if ffmpeg_exe:
        paths_to_add.insert(0, str(Path(ffmpeg_exe).parent))

    current_path = os.environ.get("PATH", "")
    for p in paths_to_add:
        if os.path.isdir(p) and p.lower() not in current_path.lower():
            current_path = p + os.pathsep + current_path
    os.environ["PATH"] = current_path

setup_environment()

app = FastAPI(title="Social Media Video Downloader - Developed by Mohd Majid")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

def detect_platform(url: str) -> str:
    """Detect platform from URL."""
    u = url.strip().lower()
    if any(d in u for d in ["instagram.com", "instagr.am", "ig.me"]):
        return "instagram"
    if any(d in u for d in ["facebook.com", "fb.watch", "fb.com", "m.facebook.com", "web.facebook.com"]):
        return "facebook"
    if any(d in u for d in ["youtube.com", "youtu.be", "youtube-nocookie.com"]):
        return "youtube"
    if any(d in u for d in ["tiktok.com", "douyin.com"]):
        return "tiktok"
    if any(d in u for d in ["twitter.com", "x.com"]):
        return "twitter"
    return "generic"

def resolve_and_clean_url(url: str) -> Tuple[str, str]:
    """
    1. Strips tracking query parameters (utm_source, stkn, igsh, fbclid, mibextid, rdid).
    2. Resolves Facebook share redirects (/share/v/, /share/r/, /share/p/, fb.watch).
    3. Normalizes Instagram & Facebook URLs to canonical form.
    """
    url = url.strip()
    platform = detect_platform(url)

    # Clean Facebook share links by resolving HTTP redirect
    if platform == "facebook":
        if any(token in url for token in ["facebook.com/share/", "fb.watch/", "/share/v/", "/share/r/", "/share/p/"]):
            try:
                r = requests.get(url, headers=BROWSER_HEADERS, allow_redirects=True, timeout=12)
                if r.status_code == 200 and r.url:
                    url = r.url
            except Exception:
                pass

        # Strip Facebook tracking parameters from resolved URL
        parsed = urllib.parse.urlparse(url)
        clean_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
        # Keep v= query parameter if present for standard watch links
        if "watch" in parsed.path and "v=" in parsed.query:
            q_dict = urllib.parse.parse_qs(parsed.query)
            if "v" in q_dict:
                clean_url += f"?v={q_dict['v'][0]}"
        return clean_url, "facebook"

    # Clean Instagram links (strip utm_source, stkn, igsh, etc.)
    if platform == "instagram":
        parsed = urllib.parse.urlparse(url)
        clean_path = parsed.path.rstrip("/")
        clean_url = f"{parsed.scheme}://{parsed.netloc}{clean_path}/"
        return clean_url, "instagram"

    # Clean YouTube links
    if platform == "youtube":
        parsed = urllib.parse.urlparse(url)
        if "youtu.be" in parsed.netloc:
            video_id = parsed.path.strip("/")
            return f"https://www.youtube.com/watch?v={video_id}", "youtube"
        elif "youtube.com" in parsed.netloc and "watch" in parsed.path:
            q_dict = urllib.parse.parse_qs(parsed.query)
            if "v" in q_dict:
                return f"https://www.youtube.com/watch?v={q_dict['v'][0]}", "youtube"

    return url, platform

def scrape_instagram_profile(url: str) -> Optional[dict]:
    """
    Robust Instagram Profile and Feed extractor.
    Extracts profile metadata (name, username, bio, avatar) and recent post/reel links.
    """
    match = re.search(r'instagram\.com/([a-zA-Z0-9\._]+)', url)
    if not match:
        return None
    username = match.group(1).rstrip("/")
    if username in ["p", "reel", "reels", "stories", "tv", "explore", "direct", "accounts"]:
        return None

    clean_url = f"https://www.instagram.com/{username}/"
    try:
        r = requests.get(clean_url, headers=BROWSER_HEADERS, timeout=12)
        if r.status_code != 200:
            return None

        text = r.text
        og_title_m = re.search(r'<meta\s+(?:property|name)="og:title"\s+content="([^"]*)"', text, re.I)
        og_image_m = re.search(r'<meta\s+(?:property|name)="og:image"\s+content="([^"]*)"', text, re.I)
        og_desc_m = re.search(r'<meta\s+(?:property|name)="og:description"\s+content="([^"]*)"', text, re.I)

        raw_title = html.unescape(og_title_m.group(1)) if og_title_m else f"@{username}"
        name_match = re.match(r'^(.*?)\s*\(@', raw_title)
        display_name = name_match.group(1).strip() if name_match else f"@{username}"

        avatar = og_image_m.group(1) if og_image_m else ""
        desc = html.unescape(og_desc_m.group(1)) if og_desc_m else ""

        # Extract recent post/reel shortcodes found in profile page
        shortcodes = list(dict.fromkeys(re.findall(r'/(?:p|reel)/([a-zA-Z0-9_-]{10,13})', text)))

        items = []
        for idx, code in enumerate(shortcodes[:24]):
            post_url = f"https://www.instagram.com/reel/{code}/"
            items.append({
                "index": idx + 1,
                "id": code,
                "title": f"Post #{idx + 1} ({code})",
                "thumbnail": avatar,
                "media_type": "video",
                "ext": "mp4",
                "url": post_url,
                "direct_url": "",
                "duration": "",
            })

        return {
            "ok": True,
            "platform": "instagram",
            "is_profile": True,
            "is_carousel": False,
            "profile_name": display_name or username,
            "profile_handle": f"@{username}",
            "profile_avatar": avatar,
            "profile_desc": desc,
            "posts_count": len(items),
            "items": items,
            "webpage_url": clean_url,
        }
    except Exception:
        return None

def is_profile_or_feed_url(url: str) -> bool:
    """Check if URL is likely a profile, channel, or page."""
    u = url.strip().lower()
    if "instagram.com" in u or "instagr.am" in u:
        if not re.search(r'/(p|reel|reels|tv)/[a-zA-Z0-9_-]+', u):
            return True
    if "facebook.com" in u or "fb.com" in u:
        if not re.search(r'/(videos|reel|watch)/|v=|story_fbid=', u):
            if "profile.php" in u or re.search(r'facebook\.com/[a-zA-Z0-9\._-]+/?$', u):
                return True
    if "youtube.com" in u or "youtu.be" in u:
        if "/@" in u or "/channel/" in u or "/c/" in u or "/user/" in u:
            return True
    return False

def extract_video_id(url: str) -> Optional[str]:
    """Extract YouTube 11-character video ID from various URL structures."""
    url = url.strip()
    patterns = [
        r"(?:v=|\/v\/|youtu\.be\/|\/embed\/|\/shorts\/|\/e\/|watch\?v=|\&v=)([a-zA-Z0-9_-]{11})",
        r"^([a-zA-Z0-9_-]{11})$",
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None

def is_valid_url(url: str) -> bool:
    """Validate whether input is a plausible URL."""
    if not url or not isinstance(url, str):
        return False
    u = url.strip()
    if u.startswith("http://") or u.startswith("https://") or re.match(r"^[a-zA-Z0-9_-]{11}$", u):
        return True
    return False

def format_duration(seconds: Optional[int]) -> str:
    """Format duration in seconds into human-readable HH:MM:SS or MM:SS."""
    if not seconds or seconds < 0:
        return "Unknown"
    h = int(seconds) // 3600
    m = (int(seconds) % 3600) // 60
    s = int(seconds) % 60
    if h > 0:
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m}:{s:02d}"

def format_bytes(bytes_num: Optional[int]) -> str:
    """Format bytes count into human-readable string (MB, GB, etc.)."""
    if not bytes_num or bytes_num <= 0:
        return "Unknown size"
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if bytes_num < 1024.0:
            return f"{bytes_num:.1f} {unit}"
        bytes_num /= 1024.0
    return f"{bytes_num:.1f} PB"

def sanitize_filename(title: str, max_length: int = 100) -> str:
    """Sanitize title for filesystems."""
    if not title or not title.strip():
        return "Media_Download"

    clean = re.sub(r'[\\/:*?"<>|]', " - ", title)
    clean = re.sub(r'[\r\n\t]+', " ", clean)
    clean = re.sub(r'\s*-\s*', " - ", clean)
    clean = re.sub(r'\s+', " ", clean).strip(" .-_")

    if not clean:
        clean = "Media_Download"

    if len(clean) > max_length:
        clean = clean[:max_length].rstrip(" .-_")

    return clean

def make_content_disposition(title: str, ext: str = "mp4") -> str:
    """
    Generate RFC 5987 compliant Content-Disposition header.
    Guaranteed to contain only pure 7-bit ASCII in the fallback filename parameter.
    """
    ascii_clean = re.sub(r'[^\w\s\.-]', '', title, flags=re.UNICODE)
    ascii_clean = ascii_clean.encode('ascii', 'ignore').decode('ascii').strip()
    ascii_clean = re.sub(r'\s+', '_', ascii_clean)
    if not ascii_clean or ascii_clean == "_":
        ascii_clean = "Media_Download"
    if len(ascii_clean) > 50:
        ascii_clean = ascii_clean[:50].rstrip(" .-_")
    ascii_filename = f"{ascii_clean}.{ext}"

    clean_title = sanitize_filename(title)
    encoded_filename = urllib.parse.quote(f"{clean_title}.{ext}")

    return f'attachment; filename="{ascii_filename}"; filename*=UTF-8\'\'{encoded_filename}'

def get_unique_filepath(directory: Path, base_title: str, extension: str) -> Path:
    """Handle duplicate filenames without overwriting."""
    ext = extension.lstrip(".")
    target = directory / f"{base_title}.{ext}"
    if not target.exists():
        return target

    counter = 1
    while True:
        target = directory / f"{base_title} ({counter}).{ext}"
        if not target.exists():
            return target
        counter += 1

def get_cookie_file() -> Optional[str]:
    """Check for cookies.txt in root/tmp or generate from YOUTUBE_COOKIES env var."""
    candidates = [
        BASE_DIR / "cookies.txt",
        DOWNLOAD_DIR / "cookies.txt",
        Path("/tmp/cookies.txt"),
    ]
    for c in candidates:
        if c.is_file() and c.stat().st_size > 0:
            return str(c)

    env_cookies = os.environ.get("YOUTUBE_COOKIES", "").strip()
    if env_cookies:
        try:
            import base64
            if not env_cookies.startswith("# Netscape") and len(env_cookies) > 50:
                try:
                    decoded = base64.b64decode(env_cookies).decode("utf-8")
                    if "# Netscape" in decoded or "\t" in decoded:
                        env_cookies = decoded
                except Exception:
                    pass
            target = Path("/tmp/cookies.txt") if os.environ.get("VERCEL") else (BASE_DIR / "cookies.txt")
            target.write_text(env_cookies, encoding="utf-8")
            return str(target)
        except Exception:
            pass
    return None

def get_ydl_base_opts(platform: str = "generic") -> dict:
    """Common base options for yt-dlp tailored to platform."""
    ffmpeg_exe = get_ffmpeg_path()
    opts = {
        "quiet": True,
        "no_warnings": True,
        "nocheckcertificate": True,
        "user_agent": BROWSER_HEADERS["User-Agent"],
    }

    cookie_file = get_cookie_file()
    if cookie_file:
        opts["cookiefile"] = cookie_file

    proxy = os.environ.get("HTTP_PROXY") or os.environ.get("HTTPS_PROXY") or os.environ.get("PROXY_URL")
    if proxy:
        opts["proxy"] = proxy

    if platform == "youtube":
        opts["extractor_args"] = {
            "youtube": {
                "player_client": ["ios", "android", "mweb", "tv_embedded", "web_embedded"]
            }
        }
    elif platform == "facebook":
        opts["http_headers"] = BROWSER_HEADERS
    elif platform == "instagram":
        opts["http_headers"] = BROWSER_HEADERS

    if ffmpeg_exe:
        opts["ffmpeg_location"] = ffmpeg_exe
    return opts

def clean_error_message(error_str: str, platform: str = "generic") -> str:
    """Convert raw technical tracebacks and ANSI codes into clean, user-friendly error text."""
    err = str(error_str).strip()
    # Strip ANSI color escape codes (e.g. ≡[0;31m, \x1b[0m)
    err = re.sub(r'(\x1b|≡)\[[0-9;]*[a-zA-Z]', '', err)
    err = re.sub(r'^ERROR:\s*', '', err, flags=re.I).strip()
    err = re.sub(r'\[[a-zA-Z0-9_:-]+\]\s*', '', err).strip()
    err_lower = err.lower()

    if "login_required" in err_lower or "private" in err_lower or "this content isn't available" in err_lower:
        if platform == "instagram":
            return "This Instagram post/reel/story is private or requires logging in to view."
        elif platform == "facebook":
            return "This Facebook video/page is private or restricted to specific audiences."
        return "This media is private or restricted."
    if "unavailable" in err_lower or "not available" in err_lower or "does not exist" in err_lower:
        return "The requested media is unavailable or has been deleted."
    if "429" in err or "too many requests" in err_lower or "rate-limit" in err_lower:
        return "Platform has temporarily rate-limited requests. Please wait a moment and try again."
    if "incompleteread" in err_lower or "connection reset" in err_lower or "timed out" in err_lower:
        return "Network connection interrupted. Please try again."

    clean = re.sub(r"Use --cookies[^\.\n]+\.?", "", err, flags=re.I).strip()
    clean = re.sub(r"See https?://\S+", "", clean).strip()
    clean = re.sub(r"\s+", " ", clean).strip(" .:,")

    if len(clean) > 180:
        clean = clean[:180].rstrip(" .:,") + "..."

    return clean or "An error occurred while processing the media link."

@app.get("/", response_class=HTMLResponse)
def home():
    return (STATIC_DIR / "index.html").read_text(encoding="utf-8")

@app.get("/style.css")
def get_css():
    return FileResponse(STATIC_DIR / "style.css", media_type="text/css")

@app.get("/app.js")
def get_js():
    return FileResponse(STATIC_DIR / "app.js", media_type="application/javascript")

@app.get("/manifest.json")
def get_manifest():
    f = STATIC_DIR / "manifest.json"
    if f.is_file():
        return FileResponse(f, media_type="application/manifest+json")
    return JSONResponse({"name": "SaveSocial"})

@app.get("/sw.js")
def get_sw():
    f = STATIC_DIR / "sw.js"
    if f.is_file():
        return FileResponse(f, media_type="application/javascript")
    return JSONResponse({})

@app.get("/icon-192.png")
def get_icon192():
    f = STATIC_DIR / "icon-192.png"
    if f.is_file():
        return FileResponse(f, media_type="image/png")
    return FileResponse(STATIC_DIR / "favicon.png", media_type="image/png") if (STATIC_DIR / "favicon.png").is_file() else JSONResponse({})

@app.get("/favicon.png")
def get_favicon_png():
    for name in ["favicon.png", "icon-192.png"]:
        f = STATIC_DIR / name
        if f.is_file():
            return FileResponse(f, media_type="image/png")
    return JSONResponse({})

@app.get("/favicon.ico")
def get_favicon_ico():
    for name in ["favicon.ico", "favicon.png", "icon-192.png"]:
        f = STATIC_DIR / name
        if f.is_file():
            return FileResponse(f, media_type="image/x-icon")
    return JSONResponse({})

@app.get("/.well-known/{path:path}")
def well_known(path: str):
    return JSONResponse({})

@app.post("/api/info")
def fetch_info(url: str = Form(...)):
    """
    Fetch comprehensive media details for YouTube, Instagram, Facebook, and Profile/Stories.
    """
    raw_url = url.strip()
    if not is_valid_url(raw_url):
        return {"ok": False, "error": "Please enter a valid link (e.g. Instagram Reel/Post/Profile, Facebook Video/Page, or YouTube)."}

    # Resolve redirects (e.g. facebook share links) and strip tracking query parameters
    url, platform = resolve_and_clean_url(raw_url)

    # 1. Check for Instagram Profile
    if platform == "instagram" and is_profile_or_feed_url(url):
        profile_data = scrape_instagram_profile(url)
        if profile_data and profile_data.get("items"):
            return profile_data

    is_profile = is_profile_or_feed_url(url)
    opts = get_ydl_base_opts(platform)
    opts["skip_download"] = True

    if is_profile:
        opts["extract_flat"] = "in_playlist"
        opts["playlistend"] = 20

    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            data = ydl.extract_info(url, download=False)
    except Exception as e:
        # If profile extraction failed on Instagram, try fallback scrape
        if platform == "instagram" and is_profile:
            profile_data = scrape_instagram_profile(url)
            if profile_data:
                return profile_data
        return {"ok": False, "error": clean_error_message(str(e), platform)}

    if not data:
        return {"ok": False, "error": "Could not extract media details from this link."}

    # Check for Profile / Channel Feed / Playlist
    entries = data.get("entries")
    if is_profile or (entries and isinstance(entries, list) and (len(entries) > 1 or data.get("_type") == "playlist")):
        items = []
        for idx, entry in enumerate(entries or []):
            if not entry:
                continue
            item_title = entry.get("title") or entry.get("description") or f"Post #{idx + 1}"
            if len(item_title) > 80:
                item_title = item_title[:80].strip() + "..."

            item_thumb = entry.get("thumbnail") or ""
            item_url = entry.get("webpage_url") or entry.get("url") or ""
            item_duration = entry.get("duration")
            item_ext = entry.get("ext") or "mp4"
            is_video = (entry.get("vcodec") not in (None, "none")) or item_ext in ["mp4", "webm"] or (item_duration and item_duration > 0)

            direct_dl = ""
            if entry.get("url") and entry.get("url").startswith("http"):
                direct_dl = entry.get("url")
            elif entry.get("formats"):
                formats = entry.get("formats", [])
                best_f = formats[-1] if formats else {}
                direct_dl = best_f.get("url", "")

            items.append({
                "index": idx + 1,
                "id": entry.get("id") or str(idx + 1),
                "title": item_title,
                "thumbnail": item_thumb or direct_dl,
                "media_type": "video" if is_video else "image",
                "ext": item_ext if is_video else "jpg",
                "url": item_url if (item_url.startswith("http")) else url,
                "direct_url": direct_dl,
                "duration": format_duration(item_duration) if is_video else "",
            })

        profile_name = data.get("uploader") or data.get("channel") or data.get("title") or f"{platform.capitalize()} Profile"
        profile_handle = data.get("uploader_id") or data.get("channel_id") or profile_name

        return {
            "ok": True,
            "platform": platform,
            "is_profile": True,
            "is_carousel": False,
            "profile_name": profile_name,
            "profile_handle": f"@{profile_handle.lstrip('@')}",
            "profile_avatar": data.get("thumbnail") or (items[0]["thumbnail"] if items else ""),
            "posts_count": len(items),
            "items": items,
            "webpage_url": data.get("webpage_url") or url,
        }

    # Check for Instagram Carousel Post (Multiple Photos/Videos in a single post)
    if entries and isinstance(entries, list) and len(entries) > 0:
        items = []
        for idx, entry in enumerate(entries):
            if not entry:
                continue
            item_title = entry.get("title") or f"Item {idx + 1}"
            item_thumb = entry.get("thumbnail") or ""
            item_url = entry.get("url") or ""
            item_duration = entry.get("duration")
            item_ext = entry.get("ext") or "mp4"
            is_video = (entry.get("vcodec") not in (None, "none")) or item_ext in ["mp4", "webm"] or (item_duration and item_duration > 0)

            direct_dl = item_url
            if not direct_dl and entry.get("formats"):
                formats = entry.get("formats", [])
                best_f = formats[-1] if formats else {}
                direct_dl = best_f.get("url", "")

            items.append({
                "index": idx + 1,
                "title": item_title,
                "thumbnail": item_thumb or direct_dl,
                "media_type": "video" if is_video else "image",
                "ext": item_ext if is_video else "jpg",
                "direct_url": direct_dl,
                "duration": format_duration(item_duration) if is_video else "",
            })

        return {
            "ok": True,
            "platform": platform,
            "is_profile": False,
            "is_carousel": True,
            "title": data.get("title") or f"Instagram Post ({len(items)} items)",
            "uploader": data.get("uploader") or data.get("channel") or data.get("uploader_id") or "Instagram Creator",
            "items_count": len(items),
            "items": items,
            "webpage_url": data.get("webpage_url") or url,
        }

    # Single Media Processing (YouTube Video, Facebook Video/Reel, Instagram Reel/Single Post)
    video_id = data.get("id") or (extract_video_id(url) if platform == "youtube" else "")
    title = data.get("title") or f"{platform.capitalize()} Video"
    thumbnail = data.get("thumbnail") or ""
    duration = data.get("duration")
    duration_formatted = format_duration(duration)
    uploader = data.get("uploader") or data.get("channel") or data.get("uploader_id") or "Creator"
    raw_formats = data.get("formats") or []

    is_image = False
    if data.get("ext") in ["jpg", "jpeg", "png", "webp"] and not raw_formats and not duration:
        is_image = True

    qualities = []
    preview_url = data.get("url") or ""

    if is_image:
        qualities.append({
            "id": "image_best",
            "label": "High-Resolution Image (JPG)",
            "height": 0,
            "is_audio": False,
            "is_image": True,
            "direct_url": data.get("url") or thumbnail,
        })
        if not preview_url:
            preview_url = thumbnail or data.get("url") or ""
    else:
        height_map = {}
        has_audio = False
        direct_best_url = ""

        for f in raw_formats:
            vcodec = f.get("vcodec")
            acodec = f.get("acodec")
            height = f.get("height")
            filesize = f.get("filesize") or f.get("filesize_approx")
            f_url = f.get("url", "")
            format_id = f.get("format_id", "")

            if acodec not in (None, "none"):
                has_audio = True

            if vcodec not in (None, "none") and height and isinstance(height, int) and height >= 144:
                if height not in height_map or (filesize and not height_map[height].get("filesize")):
                    height_map[height] = {
                        "height": height,
                        "fps": f.get("fps") or 30,
                        "ext": f.get("ext") or "mp4",
                        "filesize": filesize,
                        "url": f_url,
                        "format_id": format_id,
                    }

            if vcodec not in (None, "none") and acodec not in (None, "none") and f_url:
                if not direct_best_url:
                    direct_best_url = f_url
                if not preview_url:
                    preview_url = f_url

        standard_heights = sorted(height_map.keys(), reverse=True)

        best_height = standard_heights[0] if standard_heights else None
        best_desc = f"Up to {best_height}p" if best_height else "HD Original"
        qualities.append({
            "id": "best",
            "label": f"⚡ Best Quality ({best_desc})",
            "height": best_height or 0,
            "is_audio": False,
            "direct_url": direct_best_url or preview_url,
        })

        quality_names = {
            2160: "4K (2160p)",
            1440: "2K (1440p)",
            1080: "Full HD (1080p)",
            720: "HD (720p)",
            480: "SD (480p)",
            360: "Standard (360p)",
            240: "Low (240p)",
            144: "144p",
        }

        for h in standard_heights:
            if len(standard_heights) > 1:
                name = quality_names.get(h, f"{h}p")
                f_info = height_map[h]
                size_str = f" • ~{format_bytes(f_info['filesize'])}" if f_info.get("filesize") else ""
                qualities.append({
                    "id": str(h),
                    "label": f"{name} — MP4{size_str}",
                    "height": h,
                    "is_audio": False,
                    "direct_url": f_info.get("url", ""),
                })

        if has_audio or raw_formats or duration:
            qualities.append({
                "id": "audio_mp3",
                "label": "🎵 Audio Only — MP3 (192kbps)",
                "height": 0,
                "is_audio": True,
            })

    if not preview_url:
        preview_url = data.get("url") or ""

    return {
        "ok": True,
        "platform": platform,
        "is_profile": False,
        "is_carousel": False,
        "video_id": video_id,
        "title": title,
        "thumbnail": thumbnail or preview_url,
        "duration": duration_formatted,
        "duration_raw": duration,
        "uploader": uploader,
        "webpage_url": data.get("webpage_url") or url,
        "preview_url": preview_url,
        "media_type": "image" if is_image else "video",
        "qualities": qualities,
    }

def run_download_job(job_id: str, url: str, quality: str):
    """Background worker that performs the download and FFmpeg merge."""
    with JOBS_LOCK:
        job = JOBS.get(job_id)
        if not job:
            return

    def update_job(**kwargs):
        with JOBS_LOCK:
            if job_id in JOBS:
                JOBS[job_id].update(kwargs)

    resolved_url, platform = resolve_and_clean_url(url)
    ffmpeg_exe = get_ffmpeg_path()
    has_ffmpeg = ffmpeg_exe is not None

    temp_tmpl = str(DOWNLOAD_DIR / f"{job_id}_temp.%(ext)s")

    is_audio_mp3 = quality in ["audio_only", "audio_mp3"]
    is_audio_only = is_audio_mp3

    if is_audio_mp3:
        fmt = "bestaudio/best"
        postprocessors = [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "mp3",
            "preferredquality": "192",
        }] if has_ffmpeg else []
    else:
        postprocessors = []
        if quality == "best" or not quality.isdigit():
            if has_ffmpeg:
                fmt = "bestvideo+bestaudio/best/hd/sd"
            else:
                fmt = "best/hd/sd"
        else:
            h = int(quality)
            if has_ffmpeg:
                fmt = f"bestvideo[height<={h}]+bestaudio/best[height<={h}]/best"
            else:
                fmt = f"best[height<={h}]/best"

    def progress_hook(d):
        status = d.get("status")
        if status == "downloading":
            total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
            downloaded = d.get("downloaded_bytes") or 0
            speed = d.get("speed") or 0
            eta = d.get("eta") or 0

            pct = 0.0
            if total > 0:
                pct = round((downloaded / total) * 100.0, 1)

            speed_str = f"{format_bytes(speed)}/s" if speed else "Downloading..."
            eta_str = f"{int(eta)}s" if eta and eta < 3600 else f"{int(eta//60)}m {int(eta%60)}s" if eta else "--"
            size_str = f"{format_bytes(downloaded)} / {format_bytes(total)}" if total else format_bytes(downloaded)

            filename_hint = str(d.get("filename", "")).lower()
            if ".f" in filename_hint and any(ext in filename_hint for ext in ["webm", "m4a", "opus"]):
                stage = "Downloading audio stream..."
            elif is_audio_only:
                stage = "Downloading audio stream..."
            else:
                stage = "Downloading video stream..."

            update_job(
                status="downloading",
                stage_text=stage,
                percentage=pct,
                speed_text=speed_str,
                size_text=size_str,
                eta_text=eta_str,
                downloaded_bytes=downloaded,
                total_bytes=total,
            )

        elif status == "finished":
            update_job(
                stage_text="Merging audio & video with FFmpeg..." if not is_audio_only else "Processing audio...",
                percentage=99.0,
            )

    def postprocessor_hook(d):
        status = d.get("status")
        if status == "started":
            update_job(stage_text="Merging media streams...", percentage=99.0)
        elif status == "finished":
            update_job(stage_text="Finalizing file...", percentage=100.0)

    ydl_opts = get_ydl_base_opts(platform)
    ydl_opts.update({
        "format": fmt,
        "outtmpl": temp_tmpl,
        "noplaylist": True,
        "progress_hooks": [progress_hook],
        "postprocessor_hooks": [postprocessor_hook],
    })

    if ffmpeg_exe:
        ydl_opts["ffmpeg_location"] = ffmpeg_exe
        if not is_audio_only:
            ydl_opts["merge_output_format"] = "mp4"

    if postprocessors:
        ydl_opts["postprocessors"] = postprocessors

    try:
        update_job(status="preparing", stage_text="Connecting to media server...", percentage=0.0)

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(resolved_url, download=True)

        raw_title = info.get("title") or f"{platform.capitalize()}_Media"
        clean_title = sanitize_filename(raw_title)

        temp_files = list(DOWNLOAD_DIR.glob(f"{job_id}_temp*"))
        if not temp_files:
            update_job(status="error", error="Download finished but file could not be found.")
            return

        if is_audio_only:
            mp3_files = [f for f in temp_files if f.suffix.lower() == ".mp3"]
            source_file = mp3_files[0] if mp3_files else temp_files[0]
            ext = source_file.suffix.lstrip(".")
        else:
            mp4_files = [f for f in temp_files if f.suffix.lower() == ".mp4"]
            source_file = mp4_files[0] if mp4_files else temp_files[0]
            ext = source_file.suffix.lstrip(".")

        target_path = get_unique_filepath(DOWNLOAD_DIR, clean_title, ext)
        final_filename = target_path.name

        shutil.move(str(source_file), str(target_path))

        for remaining in DOWNLOAD_DIR.glob(f"{job_id}_temp*"):
            try:
                remaining.unlink()
            except Exception:
                pass

        file_size = target_path.stat().st_size if target_path.exists() else 0

        update_job(
            status="completed",
            stage_text="Download completed successfully!",
            percentage=100.0,
            filename=final_filename,
            download_url=f"/api/file/{urllib.parse.quote(final_filename)}",
            saved_path=str(target_path.resolve()),
            saved_folder=str(DOWNLOAD_DIR.resolve()),
            file_size_text=format_bytes(file_size),
        )

    except Exception as e:
        err_msg = clean_error_message(str(e), platform)
        update_job(
            status="error",
            error=err_msg,
            stage_text=f"Failed: {err_msg}",
        )
        for f in DOWNLOAD_DIR.glob(f"{job_id}_temp*"):
            try:
                f.unlink()
            except Exception:
                pass

@app.post("/api/download")
def start_download_job(url: str = Form(...), quality: str = Form("best")):
    """Start background download job to save directly to local downloads folder with progress."""
    url = url.strip()
    if not is_valid_url(url):
        return {"ok": False, "error": "Invalid media URL."}

    job_id = str(uuid.uuid4())
    with JOBS_LOCK:
        JOBS[job_id] = {
            "job_id": job_id,
            "status": "queued",
            "stage_text": "Queuing download...",
            "percentage": 0.0,
            "speed_text": "--",
            "size_text": "--",
            "eta_text": "--",
            "filename": None,
            "download_url": None,
            "saved_path": None,
            "saved_folder": None,
            "error": None,
            "created_at": time.time(),
        }

    thread = threading.Thread(target=run_download_job, args=(job_id, url, quality), daemon=True)
    thread.start()

    return {"ok": True, "job_id": job_id}

@app.get("/api/progress/{job_id}")
def get_job_progress(job_id: str):
    """Fetch live progress statistics for a running download job."""
    with JOBS_LOCK:
        job = JOBS.get(job_id)
        if not job:
            return {"ok": False, "error": "Download job not found."}
        return {"ok": True, "job": job}

@app.get("/api/file/{filename}")
def download_saved_file(filename: str):
    """Serve a locally saved file from the downloads folder."""
    target_path = DOWNLOAD_DIR / filename
    if not target_path.exists() or not target_path.is_file():
        raise HTTPException(status_code=404, detail="File not found on server.")
    return FileResponse(
        path=str(target_path),
        filename=filename,
        media_type="application/octet-stream"
    )

@app.get("/api/download/direct")
@app.post("/api/download/direct")
def direct_download(
    url: str = Query(...),
    quality: str = Query("best"),
    title: Optional[str] = Query(None),
    direct_url: Optional[str] = Query(None),
    ext: Optional[str] = Query(None),
):
    """
    Direct 1-Click browser streaming download endpoint.
    Fixed with RFC 5987 latin-1 safe Content-Disposition headers for seamless downloads.
    """
    raw_url = url.strip()
    resolved_url, platform = resolve_and_clean_url(raw_url)
    clean_title = sanitize_filename(title) if title and title.strip() else f"{platform.capitalize()}_Download"
    is_audio = quality in ["audio_only", "audio_mp3"]
    out_ext = "mp3" if is_audio else (ext or "mp4")

    safe_cd_header = make_content_disposition(clean_title, out_ext)

    # 1. If direct_url is passed, try streaming directly from CDN with browser headers
    if direct_url and direct_url.startswith("http"):
        try:
            req_headers = dict(BROWSER_HEADERS)
            if platform == "facebook":
                req_headers["Referer"] = "https://www.facebook.com/"
            elif platform == "instagram":
                req_headers["Referer"] = "https://www.instagram.com/"

            req = requests.get(direct_url, stream=True, timeout=20, headers=req_headers)
            if req.status_code == 200:
                content_type = req.headers.get("Content-Type", "video/mp4" if out_ext == "mp4" else "application/octet-stream")

                def iter_cdn_stream():
                    try:
                        for chunk in req.iter_content(chunk_size=128 * 1024):
                            if chunk:
                                yield chunk
                    except Exception:
                        pass

                return StreamingResponse(
                    iter_cdn_stream(),
                    media_type=content_type,
                    headers={
                        "Content-Disposition": safe_cd_header,
                        "Cache-Control": "no-cache",
                    }
                )
        except Exception:
            pass

    # 2. yt-dlp Direct Streaming Pipe Fallback
    if is_audio:
        fmt_arg = "bestaudio/best"
    elif platform == "facebook":
        fmt_arg = "best/bestvideo+bestaudio/hd/sd"
    elif quality == "best" or not quality.isdigit():
        fmt_arg = "best[ext=mp4]/bestvideo[ext=mp4]+bestaudio/best"
    else:
        fmt_arg = f"best[height<={quality}][ext=mp4]/bestvideo[height<={quality}]+bestaudio/best"

    cmd = [
        sys.executable, "-m", "yt_dlp",
        "--no-warnings", "-q",
        "-f", fmt_arg,
        "-o", "-",
        resolved_url,
    ]
    cookie_file = get_cookie_file()
    if cookie_file:
        cmd.extend(["--cookies", cookie_file])
    proxy = os.environ.get("HTTP_PROXY") or os.environ.get("HTTPS_PROXY") or os.environ.get("PROXY_URL")
    if proxy:
        cmd.extend(["--proxy", proxy])
    if platform == "youtube":
        cmd.extend(["--extractor-args", "youtube:player_client=ios,android,mweb,web_embedded"])

    def stream_generator():
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, bufsize=512 * 1024)
        try:
            while True:
                chunk = proc.stdout.read(128 * 1024)
                if not chunk:
                    break
                yield chunk
        finally:
            if proc.poll() is None:
                try:
                    proc.kill()
                except Exception:
                    pass

    return StreamingResponse(
        stream_generator(),
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": safe_cd_header,
            "Cache-Control": "no-cache",
        }
    )

@app.post("/api/open-folder")
def open_downloads_folder():
    """Opens local downloads folder in Windows Explorer."""
    try:
        folder_path = str(DOWNLOAD_DIR.resolve())
        if sys.platform == "win32":
            subprocess.Popen(["explorer", folder_path])
            return {"ok": True, "message": f"Opened {folder_path}"}
        elif sys.platform == "darwin":
            subprocess.Popen(["open", folder_path])
            return {"ok": True, "message": f"Opened {folder_path}"}
        else:
            subprocess.Popen(["xdg-open", folder_path])
            return {"ok": True, "message": f"Opened {folder_path}"}
    except Exception as e:
        return {"ok": False, "error": f"Could not open folder: {str(e)}"}

@app.get("/api/health")
def health_check():
    ffmpeg_exe = get_ffmpeg_path()
    return {
        "status": "healthy",
        "ffmpeg_available": ffmpeg_exe is not None,
        "ffmpeg_path": ffmpeg_exe,
        "active_jobs": len(JOBS),
    }

if __name__ == "__main__":
    import uvicorn
    print("\n" + "="*60)
    print("  🚀 Social Media Video Downloader Starting...")
    print("  ⭐ Developed by Mohd Majid")
    print("  🌐 Local:   http://127.0.0.1:8000")
    print("  📱 Network: http://192.168.1.3:8000 (Use this in SaveSocial mobile app)")
    print("="*60 + "\n")
    uvicorn.run(app, host="0.0.0.0", port=8000)
