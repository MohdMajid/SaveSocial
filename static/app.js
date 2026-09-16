// ============================================================
//  SaveSocial — app.js
//  © 2026 SaveSocial. Designed & Developed by Mohd Majid.
// ============================================================

// Dynamic Backend API Base URL
function getApiBase() {
  const saved = localStorage.getItem("ss_api_base");
  if (saved && saved.trim()) return saved.trim().replace(/\/+$/, "");
  return "";
}

// Detect if running inside Capacitor (Android/iOS)
const IS_CAPACITOR = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

// ── Platform Configurations (YouTube removed) ──────────────
const PLATFORM_CONFIG = {
  all: {
    title: "Social Media Downloader",
    sub: "Download Instagram Reels, Stories, Posts & Profiles, Facebook Videos & Pages directly from link.",
    badge: "FAST • FREE • HD QUALITY",
    placeholder: "Paste link from Instagram, Facebook, or TikTok here...",
    pills: ["⚡ 1-Click Fast Download", "📸 Reels & Stories", "👤 Profile & Feed Saver", "🎬 HD 1080p Quality"],
  },
  instagram: {
    title: "Instagram Downloader",
    sub: "Download Instagram Reels, Stories, Posts, Photos, Profiles, and Carousels directly by pasting the link.",
    badge: "INSTAGRAM REELS • STORIES • POSTS • PROFILES",
    placeholder: "Paste Instagram Reel, Story, Post, or Profile link here...",
    pills: ["✨ Reels Video", "📸 High-Res Photos", "📖 Story Saver", "👤 Profile Posts Feed"],
  },
  facebook: {
    title: "Facebook Video Downloader",
    sub: "Download Facebook Public Videos, FB Watch clips, Pages, and Reels in Full HD or Standard quality.",
    badge: "FACEBOOK VIDEOS • WATCH • REELS • PAGES",
    placeholder: "Paste Facebook video, reel, or page link here...",
    pills: ["🎬 FB Watch Videos", "⚡ 1080p HD Quality", "📱 Facebook Reels", "📄 Page Videos Feed"],
  },
  tiktok: {
    title: "TikTok Downloader",
    sub: "Download TikTok videos and slideshows without watermark directly by pasting the link.",
    badge: "TIKTOK VIDEOS • SLIDESHOWS • NO WATERMARK",
    placeholder: "Paste TikTok video link here...",
    pills: ["🎵 TikTok Videos", "🖼️ Slideshows", "⚡ No Watermark", "📱 HD Quality"],
  },
};

// ── DOM Elements ─────────────────────────────────────────────
const form           = document.getElementById("form");
const urlInput       = document.getElementById("url");
const pasteBtn       = document.getElementById("pasteBtn");
const infoBtn        = document.getElementById("infoBtn");
const btnText        = infoBtn.querySelector(".btn-text");
const btnSpinner     = infoBtn.querySelector(".btn-spinner");
const statusBox      = document.getElementById("status");
const navTabs        = document.querySelectorAll(".nav-tab");

const mainTitle      = document.getElementById("mainTitle");
const mainSub        = document.getElementById("mainSub");
const headerBadge    = document.getElementById("headerBadge");
const badgeText      = document.getElementById("badgeText");
const featurePills   = document.getElementById("featurePills");

const previewSection    = document.getElementById("preview");
const thumbImg          = document.getElementById("thumb");
const durationBadge     = document.getElementById("durationBadge");
const platformTagBadge  = document.getElementById("platformTagBadge");
const videoTitle        = document.getElementById("title");
const videoUploader     = document.getElementById("uploader");
const playOverlayBtn    = document.getElementById("playOverlayBtn");
const previewBtn        = document.getElementById("previewBtn");
const copyDirectLinkBtn = document.getElementById("copyDirectLinkBtn");
const shareBtn          = document.getElementById("shareBtn");
const qualitySelect     = document.getElementById("quality");
const directDownloadBtn = document.getElementById("directDownloadBtn");

const profileSection      = document.getElementById("profileSection");
const profileAvatar       = document.getElementById("profileAvatar");
const profileName         = document.getElementById("profileName");
const profileHandle       = document.getElementById("profileHandle");
const profilePlatformBadge = document.getElementById("profilePlatformBadge");
const profileCountBadge   = document.getElementById("profileCountBadge");
const profileExternalBtn  = document.getElementById("profileExternalBtn");
const profilePostsGrid    = document.getElementById("profilePostsGrid");

const carouselSection     = document.getElementById("carouselSection");
const carouselTitle       = document.getElementById("carouselTitle");
const carouselUploader    = document.getElementById("carouselUploader");
const carouselCountBadge  = document.getElementById("carouselCountBadge");
const carouselGrid        = document.getElementById("carouselGrid");

const progressSection  = document.getElementById("progressSection");
const progressStage    = document.getElementById("progressStage");
const progressPct      = document.getElementById("progressPct");
const progressBarFill  = document.getElementById("progressBarFill");
const statSpeed        = document.getElementById("statSpeed");
const statSize         = document.getElementById("statSize");
const statEta          = document.getElementById("statEta");

const successCard           = document.getElementById("successCard");
const savedFileName         = document.getElementById("savedFileName");
const savedLocation         = document.getElementById("savedLocation");
const openFolderBtn         = document.getElementById("openFolderBtn");
const nativeShareSuccessBtn = document.getElementById("nativeShareSuccessBtn");
const downloadAnotherBtn    = document.getElementById("downloadAnotherBtn");

const previewModal       = document.getElementById("previewModal");
const modalBackdrop      = document.getElementById("modalBackdrop");
const modalCloseBtn      = document.getElementById("modalCloseBtn");
const modalTitle         = document.getElementById("modalTitle");
const previewVideo       = document.getElementById("previewVideo");
const previewModalImg    = document.getElementById("previewModalImg");
const modalExternalLinkBtn = document.getElementById("modalExternalLinkBtn");

const historyList          = document.getElementById("historyList");
const clearHistoryBtn      = document.getElementById("clearHistoryBtn");
const clearHistorySettingBtn = document.getElementById("clearHistorySettingBtn");
const themeSetting         = document.getElementById("themeSetting");
const notifSetting         = document.getElementById("notifSetting");
const serverUrlSetting     = document.getElementById("serverUrlSetting");

// ── App State ─────────────────────────────────────────────────
let activePlatform   = "all";
let currentVideoId   = "";
let currentPreviewUrl = "";
let currentWebpageUrl = "";
let currentMediaType = "video";
let currentTitleText = "";
let lastFetchedData  = null;
let currentDownloadUrl = "";

// ── Page Router ───────────────────────────────────────────────
const bottomNavItems = document.querySelectorAll(".bottom-nav-item");
const pages          = document.querySelectorAll(".page");

function showPage(pageId) {
  pages.forEach(p => {
    p.classList.toggle("active", p.id === `page-${pageId}`);
    p.classList.toggle("hidden", p.id !== `page-${pageId}`);
  });
  bottomNavItems.forEach(item => {
    item.classList.toggle("active", item.dataset.page === pageId);
  });
  if (pageId === "history") renderHistory();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

bottomNavItems.forEach(item => {
  item.addEventListener("click", () => showPage(item.dataset.page));
});

// ── Android Back Button Handler ───────────────────────────────
document.addEventListener("ionBackButton", (ev) => {
  ev.detail.register(10, () => {
    const activePage = document.querySelector(".page.active");
    if (activePage && activePage.id !== "page-home") {
      showPage("home");
    } else if (!previewModal.classList.contains("hidden")) {
      closePreviewModal();
    } else {
      // Exit the app on double back press
      if (window._backPressedOnce) {
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
          window.Capacitor.Plugins.App.exitApp();
        }
      } else {
        window._backPressedOnce = true;
        showStatus("Press back again to exit", false);
        setTimeout(() => { window._backPressedOnce = false; }, 2000);
      }
    }
  });
});

// ── Settings ──────────────────────────────────────────────────
function loadSettings() {
  const theme = localStorage.getItem("ss_theme") || "dark";
  const notif = localStorage.getItem("ss_notif") !== "false";
  const apiBase = localStorage.getItem("ss_api_base") || "";
  if (themeSetting) themeSetting.value = theme;
  if (notifSetting) notifSetting.checked = notif;
  if (serverUrlSetting) serverUrlSetting.value = apiBase;
  applyTheme(theme);
}

if (serverUrlSetting) {
  serverUrlSetting.addEventListener("change", () => {
    localStorage.setItem("ss_api_base", serverUrlSetting.value.trim());
    showStatus("Server URL saved!", false);
  });
}

function applyTheme(theme) {
  document.body.classList.toggle("theme-light", theme === "light");
  document.body.classList.toggle("theme-dark", theme !== "light");
}

if (themeSetting) {
  themeSetting.addEventListener("change", () => {
    localStorage.setItem("ss_theme", themeSetting.value);
    applyTheme(themeSetting.value);
  });
}

if (notifSetting) {
  notifSetting.addEventListener("change", () => {
    localStorage.setItem("ss_notif", notifSetting.checked ? "true" : "false");
    if (notifSetting.checked) requestNotificationPermission();
  });
}

async function requestNotificationPermission() {
  if (IS_CAPACITOR && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) {
    await window.Capacitor.Plugins.LocalNotifications.requestPermissions();
  } else if ("Notification" in window) {
    await Notification.requestPermission();
  }
}

async function sendDownloadNotification(title) {
  const notif = localStorage.getItem("ss_notif") !== "false";
  if (!notif) return;
  if (IS_CAPACITOR && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) {
    try {
      await window.Capacitor.Plugins.LocalNotifications.schedule({
        notifications: [{
          title: "Download Complete ✅",
          body: `${title} downloaded successfully!`,
          id: Date.now(),
          schedule: { at: new Date(Date.now() + 100) },
          sound: null,
          attachments: null,
          actionTypeId: "",
          extra: null,
        }],
      });
    } catch (e) { /* silently fail */ }
  }
}

// ── Platform Tab Switcher ─────────────────────────────────────
function setPlatformTab(platform) {
  activePlatform = platform;
  document.body.className = document.body.className
    .split(" ")
    .filter(c => !c.startsWith("platform-") && !c.startsWith("theme-"))
    .join(" ");
  document.body.classList.add(`platform-${platform}`);

  // Re-add theme class
  const theme = localStorage.getItem("ss_theme") || "dark";
  document.body.classList.add(theme === "light" ? "theme-light" : "theme-dark");

  navTabs.forEach(tab => {
    tab.classList.toggle("active", tab.dataset.platform === platform);
  });

  const cfg = PLATFORM_CONFIG[platform] || PLATFORM_CONFIG.all;
  mainTitle.textContent     = cfg.title;
  mainSub.textContent       = cfg.sub;
  badgeText.textContent     = cfg.badge;
  urlInput.placeholder      = cfg.placeholder;

  featurePills.innerHTML = cfg.pills
    .map(pill => `<span class="pill">${pill}</span>`)
    .join("");
}

navTabs.forEach(tab => {
  tab.addEventListener("click", () => setPlatformTab(tab.dataset.platform));
});

// ── Auto-detect platform from URL ────────────────────────────
function autoDetectPlatform(url) {
  const u = url.toLowerCase().trim();
  if (u.includes("instagram.com") || u.includes("instagr.am")) {
    setPlatformTab("instagram");
  } else if (u.includes("facebook.com") || u.includes("fb.watch") || u.includes("fb.com")) {
    setPlatformTab("facebook");
  } else if (u.includes("tiktok.com") || u.includes("douyin.com")) {
    setPlatformTab("tiktok");
  }
}

urlInput.addEventListener("input", () => autoDetectPlatform(urlInput.value));

// ── Clipboard Paste Button ────────────────────────────────────
pasteBtn.addEventListener("click", async () => {
  try {
    let text = "";
    // Try Capacitor Clipboard first
    if (IS_CAPACITOR && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Clipboard) {
      const result = await window.Capacitor.Plugins.Clipboard.read();
      text = result.value || "";
    } else {
      text = await navigator.clipboard.readText();
    }
    if (text) {
      urlInput.value = text.trim();
      autoDetectPlatform(text);
      hapticFeedback("light");
      fetchMedia();
    }
  } catch (err) {
    showStatus("Could not read clipboard. Please paste manually into the input box.", true);
  }
});

// ── Haptic Feedback (Android) ─────────────────────────────────
async function hapticFeedback(style = "light") {
  if (IS_CAPACITOR && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics) {
    try {
      const { ImpactStyle } = window.Capacitor.Plugins.Haptics;
      await window.Capacitor.Plugins.Haptics.impact({
        style: style === "heavy" ? ImpactStyle.Heavy : style === "medium" ? ImpactStyle.Medium : ImpactStyle.Light,
      });
    } catch (e) { /* silently fail */ }
  }
}

// ── Network Status Check ──────────────────────────────────────
async function checkNetwork() {
  if (IS_CAPACITOR && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Network) {
    try {
      const status = await window.Capacitor.Plugins.Network.getStatus();
      return status.connected;
    } catch (e) { return true; }
  }
  return navigator.onLine !== false;
}

// ── Status Banner ─────────────────────────────────────────────
function showStatus(message, isError = true) {
  if (!message) {
    statusBox.classList.add("hidden");
    statusBox.textContent = "";
    return;
  }
  statusBox.textContent = message;
  statusBox.className   = `status ${isError ? "error" : "info"}`;
  statusBox.classList.remove("hidden");
  // Auto-hide info messages
  if (!isError) {
    setTimeout(() => statusBox.classList.add("hidden"), 3500);
  }
}

// ── Toggle Loading State ──────────────────────────────────────
function setInfoLoading(isLoading) {
  infoBtn.disabled           = isLoading;
  btnText.textContent        = isLoading ? "Fetching..." : "Fetch Media";
  btnSpinner.classList.toggle("hidden", !isLoading);
}

// ── Open Preview Modal ────────────────────────────────────────
function openPreviewModal() {
  if (!currentPreviewUrl) return;

  modalTitle.textContent     = currentTitleText || "Media Preview";
  modalExternalLinkBtn.href  = currentWebpageUrl || urlInput.value.trim() || "#";

  if (currentMediaType === "image") {
    previewVideo.classList.add("hidden");
    previewVideo.pause();
    previewModalImg.src = currentPreviewUrl;
    previewModalImg.classList.remove("hidden");
  } else if (currentPreviewUrl) {
    previewModalImg.classList.add("hidden");
    previewVideo.src = currentPreviewUrl;
    previewVideo.classList.remove("hidden");
    previewVideo.load();
    previewVideo.play().catch(() => {});
  }

  previewModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

// ── Close Preview Modal ───────────────────────────────────────
function closePreviewModal() {
  if (previewVideo) {
    previewVideo.pause();
    previewVideo.removeAttribute("src");
    previewVideo.load();
  }
  previewModal.classList.add("hidden");
  document.body.style.overflow = "";
}

// Modal events
playOverlayBtn.addEventListener("click",   openPreviewModal);
previewBtn.addEventListener("click",       openPreviewModal);
modalCloseBtn.addEventListener("click",    closePreviewModal);
modalBackdrop.addEventListener("click",    closePreviewModal);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !previewModal.classList.contains("hidden")) closePreviewModal();
});

// ── Copy Direct Link ──────────────────────────────────────────
copyDirectLinkBtn.addEventListener("click", async () => {
  const url = currentWebpageUrl || urlInput.value.trim();
  if (!url) return;
  try {
    if (IS_CAPACITOR && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Clipboard) {
      await window.Capacitor.Plugins.Clipboard.write({ string: url });
    } else {
      await navigator.clipboard.writeText(url);
    }
    const orig = copyDirectLinkBtn.innerHTML;
    copyDirectLinkBtn.innerHTML = `✓ Copied!`;
    hapticFeedback("light");
    setTimeout(() => { copyDirectLinkBtn.innerHTML = orig; }, 2000);
  } catch (e) {}
});

// ── Share Button ──────────────────────────────────────────────
shareBtn.addEventListener("click", async () => {
  const url = currentWebpageUrl || urlInput.value.trim();
  if (!url) return;
  try {
    if (IS_CAPACITOR && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Share) {
      await window.Capacitor.Plugins.Share.share({
        title: currentTitleText || "SaveSocial",
        text: `Check this out: ${currentTitleText}`,
        url: url,
        dialogTitle: "Share via",
      });
    } else if (navigator.share) {
      await navigator.share({ title: currentTitleText, url });
    } else {
      await navigator.clipboard.writeText(url);
      showStatus("Link copied to clipboard!", false);
    }
    hapticFeedback("light");
  } catch (e) {}
});

// ── Fetch Media ───────────────────────────────────────────────
async function fetchMedia() {
  const url = urlInput.value.trim();
  if (!url) {
    showStatus("Please enter a link to download.", true);
    return;
  }

  const online = await checkNetwork();
  if (!online) {
    showStatus("No internet connection. Please check your network.", true);
    return;
  }

  showStatus("");
  hideAllSections();
  setInfoLoading(true);
  hapticFeedback("light");

  try {
    const formData = new URLSearchParams({ url });
    const response = await fetch(`${getApiBase()}/api/info`, {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    formData,
    });

    const data = await response.json();
    if (!data.ok) throw new Error(data.error || "Failed to fetch media details.");

    lastFetchedData   = data;
    currentWebpageUrl = data.webpage_url || url;

    if (data.platform && data.platform !== "generic") setPlatformTab(data.platform);

    if (data.is_profile && data.items && data.items.length > 0) {
      renderProfile(data);
      return;
    }
    if (data.is_carousel && data.items && data.items.length > 0) {
      renderCarousel(data);
      return;
    }
    renderSingleMedia(data);
  } catch (err) {
    hapticFeedback("medium");
    showStatus(err.message || "Could not retrieve media from this link.", true);
  } finally {
    setInfoLoading(false);
  }
}

function hideAllSections() {
  previewSection.classList.add("hidden");
  profileSection.classList.add("hidden");
  carouselSection.classList.add("hidden");
  progressSection.classList.add("hidden");
  successCard.classList.add("hidden");
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  fetchMedia();
});

// ── Render Single Media Card ──────────────────────────────────
function renderSingleMedia(data) {
  currentVideoId    = data.video_id || "";
  currentPreviewUrl = data.preview_url || data.thumbnail || "";
  currentMediaType  = data.media_type || "video";
  currentTitleText  = data.title || "Media File";

  videoTitle.textContent    = currentTitleText;
  videoUploader.textContent = data.uploader ? `By ${data.uploader}` : "";
  thumbImg.src              = data.thumbnail || data.preview_url || "";

  if (data.duration && data.duration !== "Unknown") {
    durationBadge.textContent = data.duration;
    durationBadge.classList.remove("hidden");
  } else {
    durationBadge.classList.add("hidden");
  }

  platformTagBadge.textContent = (data.platform || "Media").toUpperCase();

  qualitySelect.innerHTML = "";
  if (data.qualities && data.qualities.length > 0) {
    data.qualities.forEach(q => {
      const option         = document.createElement("option");
      option.value         = q.id;
      option.textContent   = q.label;
      if (q.direct_url)    option.dataset.directUrl = q.direct_url;
      qualitySelect.appendChild(option);
    });
  } else {
    const option       = document.createElement("option");
    option.value       = "best";
    option.textContent = "⚡ Best Quality (Original)";
    qualitySelect.appendChild(option);
  }

  previewSection.classList.remove("hidden");
}

// ── Render Profile & Feed ─────────────────────────────────────
function renderProfile(data) {
  profileName.textContent          = data.profile_name || "Profile Feed";
  profileHandle.textContent        = data.profile_handle || "@profile";
  profilePlatformBadge.textContent = (data.platform || "Platform").toUpperCase();
  profileCountBadge.textContent    = `${data.posts_count || data.items.length} posts/stories loaded`;
  profileAvatar.src                = data.profile_avatar || (data.items[0] ? data.items[0].thumbnail : "");
  profileExternalBtn.href          = data.webpage_url || urlInput.value.trim() || "#";

  profilePostsGrid.innerHTML = "";
  data.items.forEach(item => {
    const card      = document.createElement("div");
    card.className  = "profile-post-card";
    const isVid     = item.media_type === "video";
    const typeLabel = isVid ? "VIDEO" : "POST";
    const thumbSrc  = item.thumbnail || item.direct_url || "";

    card.innerHTML = `
      <div class="profile-post-thumb-wrapper">
        <img src="${thumbSrc}" alt="${item.title}" loading="lazy">
        <span class="carousel-type-badge">${typeLabel}</span>
        ${item.duration ? `<span class="duration-badge">${item.duration}</span>` : ""}
      </div>
      <div class="profile-post-body">
        <span class="profile-post-title" title="${item.title}">${item.title}</span>
        <div class="profile-post-actions">
          <button type="button" class="btn-primary profile-post-dl">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            Download
          </button>
          <button type="button" class="btn-secondary profile-post-fetch">Details</button>
        </div>
      </div>
    `;

    card.querySelector(".profile-post-dl").addEventListener("click", () => {
      triggerDirectDownload(item.url || urlInput.value.trim(), "best", item.title, item.direct_url, item.ext);
    });
    card.querySelector(".profile-post-fetch").addEventListener("click", () => {
      urlInput.value = item.url;
      fetchMedia();
    });

    profilePostsGrid.appendChild(card);
  });

  profileSection.classList.remove("hidden");
}

// ── Render Carousel Grid ──────────────────────────────────────
function renderCarousel(data) {
  carouselTitle.textContent    = data.title || "Multi-Item Post";
  carouselUploader.textContent = data.uploader ? `By ${data.uploader}` : "@creator";
  carouselCountBadge.textContent = `${data.items_count || data.items.length} items found`;

  carouselGrid.innerHTML = "";
  data.items.forEach(item => {
    const card      = document.createElement("div");
    card.className  = "carousel-item-card";
    const isVid     = item.media_type === "video";
    const typeLabel = isVid ? "VIDEO" : "PHOTO";
    const thumbSrc  = item.thumbnail || item.direct_url || "";

    card.innerHTML = `
      <div class="carousel-thumb-wrapper">
        <img src="${thumbSrc}" alt="${item.title}" loading="lazy">
        <span class="carousel-type-badge">${typeLabel}</span>
      </div>
      <div class="carousel-item-body">
        <span class="carousel-item-title">${item.title}</span>
        <button type="button" class="btn-primary carousel-dl-btn">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          Download
        </button>
      </div>
    `;

    card.querySelector(".carousel-dl-btn").addEventListener("click", () => {
      triggerDirectDownload(urlInput.value.trim(), "best", item.title, item.direct_url, item.ext);
    });

    carouselGrid.appendChild(card);
  });

  carouselSection.classList.remove("hidden");
}

// ── Trigger Download ──────────────────────────────────────────
function triggerDirectDownload(url, quality = "best", title = "", directUrl = "", ext = "") {
  showStatus("");
  hapticFeedback("medium");

  const params = new URLSearchParams({
    url:     url,
    quality: quality,
    title:   title || currentTitleText || "Media",
  });
  if (directUrl) params.append("direct_url", directUrl);
  if (ext)       params.append("ext", ext);

  const downloadEndpoint = `${getApiBase()}/api/download/direct?${params.toString()}`;

  const a = document.createElement("a");
  a.href = downloadEndpoint;
  a.setAttribute("download", "");
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  const finalTitle = title || currentTitleText || "Media";
  showStatus("Download started! Check your downloads.", false);

  // Save to history
  addToHistory({
    title:     finalTitle,
    url:       url,
    platform:  activePlatform,
    ext:       ext || "mp4",
    date:      new Date().toISOString(),
    thumbnail: thumbImg.src || "",
  });

  sendDownloadNotification(finalTitle);
}

// ── Direct Download Button ────────────────────────────────────
directDownloadBtn.addEventListener("click", () => {
  const url             = urlInput.value.trim();
  const selectedOption  = qualitySelect.options[qualitySelect.selectedIndex];
  const quality         = qualitySelect.value;
  const directUrl       = selectedOption ? selectedOption.dataset.directUrl || "" : "";
  const ext             = currentMediaType === "image" ? "jpg" : (quality.includes("audio") ? "mp3" : "mp4");
  triggerDirectDownload(url, quality, currentTitleText, directUrl, ext);
});

// ── Download Another ──────────────────────────────────────────
downloadAnotherBtn.addEventListener("click", () => {
  urlInput.value = "";
  hideAllSections();
  statusBox.classList.add("hidden");
  urlInput.focus();
  currentDownloadUrl = "";
});

// ── Open File / Folder ────────────────────────────────────────
openFolderBtn.addEventListener("click", async () => {
  try {
    const res  = await fetch(`${getApiBase()}/api/open-folder`, { method: "POST" });
    const data = await res.json();
    if (!data.ok) showStatus(data.error || "Could not open folder.", true);
  } catch (err) {
    showStatus("Could not communicate with server.", true);
  }
});

// ── Native Share on Success ───────────────────────────────────
nativeShareSuccessBtn.addEventListener("click", async () => {
  try {
    if (IS_CAPACITOR && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Share) {
      await window.Capacitor.Plugins.Share.share({
        title:       currentTitleText || "Downloaded via SaveSocial",
        text:        `Downloaded from SaveSocial: ${currentTitleText}`,
        dialogTitle: "Share File",
      });
    } else if (navigator.share) {
      await navigator.share({ title: currentTitleText, url: currentWebpageUrl });
    } else {
      showStatus("Share not supported on this device.", true);
    }
  } catch (e) {}
});

// ── Download History ──────────────────────────────────────────
function getHistory() {
  try {
    return JSON.parse(localStorage.getItem("ss_history") || "[]");
  } catch { return []; }
}

function saveHistory(history) {
  localStorage.setItem("ss_history", JSON.stringify(history.slice(0, 100)));
}

function addToHistory(item) {
  const history = getHistory();
  history.unshift({ ...item, id: Date.now() });
  saveHistory(history);
}

function renderHistory() {
  const history = getHistory();
  if (!historyList) return;

  if (!history.length) {
    historyList.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        <p>No downloads yet</p>
        <span>Downloaded files will appear here</span>
      </div>`;
    return;
  }

  historyList.innerHTML = history.map(item => `
    <div class="history-item" data-id="${item.id}">
      <div class="history-thumb">
        ${item.thumbnail ? `<img src="${item.thumbnail}" alt="${item.title}" loading="lazy">` : `<div class="history-thumb-placeholder"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="3"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg></div>`}
      </div>
      <div class="history-info">
        <span class="history-title" title="${item.title}">${item.title}</span>
        <span class="history-meta">
          <span class="history-platform">${(item.platform || "media").toUpperCase()}</span>
          <span class="history-date">${formatDate(item.date)}</span>
        </span>
        <span class="history-filename">${item.title}.${item.ext || "mp4"}</span>
      </div>
      <div class="history-actions">
        <button type="button" class="history-btn history-open-btn" data-url="${item.url}" title="Download again">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        </button>
        <button type="button" class="history-btn history-delete-btn" data-id="${item.id}" title="Delete">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>
        </button>
      </div>
    </div>
  `).join("");

  // Bind actions
  historyList.querySelectorAll(".history-open-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      urlInput.value = btn.dataset.url;
      showPage("home");
      fetchMedia();
    });
  });
  historyList.querySelectorAll(".history-delete-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id      = parseInt(btn.dataset.id);
      const history = getHistory().filter(h => h.id !== id);
      saveHistory(history);
      renderHistory();
      hapticFeedback("light");
    });
  });
}

function formatDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } catch { return ""; }
}

function clearHistory() {
  if (confirm("Clear all download history? This cannot be undone.")) {
    localStorage.removeItem("ss_history");
    renderHistory();
    hapticFeedback("medium");
  }
}

if (clearHistoryBtn) clearHistoryBtn.addEventListener("click", clearHistory);
if (clearHistorySettingBtn) clearHistorySettingBtn.addEventListener("click", () => {
  clearHistory();
  showPage("home");
});

// ── Init ──────────────────────────────────────────────────────
loadSettings();
setPlatformTab("all");
