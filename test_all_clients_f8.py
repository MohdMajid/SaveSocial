import yt_dlp

url = "https://youtu.be/f8_SIkp3p_s"

clients = [
    "android", "ios", "mweb", "tv", "web_embedded", "tv_embedded",
    "android_vr", "web_safari", "android_creator", "ios_creator",
    "android_music", "ios_music", "web_creator"
]

for c in clients:
    try:
        opts = {
            "quiet": True,
            "no_warnings": True,
            "skip_download": True,
            "extractor_args": {"youtube": {"player_client": [c]}}
        }
        with yt_dlp.YoutubeDL(opts) as ydl:
            data = ydl.extract_info(url, download=False)
            t = data.get("title")
            f_len = len(data.get("formats", []))
            print(f"SUCCESS with {c}: Title={t} | Formats={f_len}")
    except Exception as e:
        print(f"FAILED with {c}: {str(e)[:100]}")
