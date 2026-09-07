// Platform Configurations
const PLATFORM_CONFIG = {
  all: {
    title: "Social Media Downloader",
    sub: "Download Instagram Reels, Stories, Posts & Profiles, Facebook Videos & Pages, and YouTube videos directly from link.",
    badge: "FAST • FREE • FULL HD QUALITY",
    placeholder: "Paste link from Instagram, Facebook, or YouTube here...",
    pills: ["⚡ 1-Click Fast Download", "📸 Reels & Stories", "👤 Profile & Feed Saver", "🎬 HD 1080p / 4K"],
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
  youtube: {
    title: "YouTube Downloader",
    sub: "Fast, high-quality YouTube video, Shorts, Channel feeds, and MP3 audio downloader with Full HD support.",
    badge: "YOUTUBE VIDEOS • SHORTS • CHANNELS • MP3",
    placeholder: "Paste YouTube video, Shorts, or Channel link here...",
    pills: ["⚡ 4K & 1080p Full HD", "📱 YouTube Shorts", "🎵 192kbps MP3 Audio", "▶ Instant Preview"],
  },
};

// DOM Elements
const form = document.getElementById("form");
const urlInput = document.getElementById("url");
const pasteBtn = document.getElementById("pasteBtn");
const infoBtn = document.getElementById("infoBtn");
const btnText = infoBtn.querySelector(".btn-text");
const btnSpinner = infoBtn.querySelector(".btn-spinner");
const statusBox = document.getElementById("status");
const navTabs = document.querySelectorAll(".nav-tab");

// Header Elements
const mainTitle = document.getElementById("mainTitle");
const mainSub = document.getElementById("mainSub");
const headerBadge = document.getElementById("headerBadge");
const badgeText = document.getElementById("badgeText");
const featurePills = document.getElementById("featurePills");

// Single Preview Card Elements
const previewSection = document.getElementById("preview");
const thumbImg = document.getElementById("thumb");
const durationBadge = document.getElementById("durationBadge");
const platformTagBadge = document.getElementById("platformTagBadge");
const videoTitle = document.getElementById("title");
const videoUploader = document.getElementById("uploader");
const playOverlayBtn = document.getElementById("playOverlayBtn");
const previewBtn = document.getElementById("previewBtn");
const copyDirectLinkBtn = document.getElementById("copyDirectLinkBtn");
const qualitySelect = document.getElementById("quality");
const directDownloadBtn = document.getElementById("directDownloadBtn");

// Profile Section Elements
const profileSection = document.getElementById("profileSection");
const profileAvatar = document.getElementById("profileAvatar");
const profileName = document.getElementById("profileName");
const profileHandle = document.getElementById("profileHandle");
const profilePlatformBadge = document.getElementById("profilePlatformBadge");
const profileCountBadge = document.getElementById("profileCountBadge");
const profileExternalBtn = document.getElementById("profileExternalBtn");
const profilePostsGrid = document.getElementById("profilePostsGrid");

// Carousel Section Elements
const carouselSection = document.getElementById("carouselSection");
const carouselTitle = document.getElementById("carouselTitle");
const carouselUploader = document.getElementById("carouselUploader");
const carouselCountBadge = document.getElementById("carouselCountBadge");
const carouselGrid = document.getElementById("carouselGrid");

// Progress Section Elements
const progressSection = document.getElementById("progressSection");
const progressStage = document.getElementById("progressStage");
const progressPct = document.getElementById("progressPct");
const progressBarFill = document.getElementById("progressBarFill");
const statSpeed = document.getElementById("statSpeed");
const statSize = document.getElementById("statSize");
const statEta = document.getElementById("statEta");

// Success Card Elements
const successCard = document.getElementById("successCard");
const savedFileName = document.getElementById("savedFileName");
const savedLocation = document.getElementById("savedLocation");
const openFolderBtn = document.getElementById("openFolderBtn");
const downloadAnotherBtn = document.getElementById("downloadAnotherBtn");

// Modal Elements
const previewModal = document.getElementById("previewModal");
const modalBackdrop = document.getElementById("modalBackdrop");
const modalCloseBtn = document.getElementById("modalCloseBtn");
const modalTitle = document.getElementById("modalTitle");
const previewVideo = document.getElementById("previewVideo");
const previewModalImg = document.getElementById("previewModalImg");
const previewIframe = document.getElementById("previewIframe");
const modalExternalLinkBtn = document.getElementById("modalExternalLinkBtn");

// App State
let activePlatform = "all";
let currentVideoId = "";
let currentPreviewUrl = "";
let currentWebpageUrl = "";
let currentMediaType = "video";
let currentTitleText = "";
let lastFetchedData = null;

// Platform Tab Switcher
function setPlatformTab(platform) {
  activePlatform = platform;
  document.body.className = `platform-${platform}`;

  navTabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.platform === platform);
  });

  const cfg = PLATFORM_CONFIG[platform] || PLATFORM_CONFIG.all;
  mainTitle.textContent = cfg.title;
  mainSub.textContent = cfg.sub;
  badgeText.textContent = cfg.badge;
  urlInput.placeholder = cfg.placeholder;

  featurePills.innerHTML = cfg.pills
    .map((pill) => `<span class="pill">${pill}</span>`)
    .join("");
}

navTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    setPlatformTab(tab.dataset.platform);
  });
});

// Auto-detect platform from URL input
function autoDetectPlatform(url) {
  const u = url.toLowerCase().trim();
  if (u.includes("instagram.com") || u.includes("instagr.am")) {
    setPlatformTab("instagram");
  } else if (u.includes("facebook.com") || u.includes("fb.watch") || u.includes("fb.com")) {
    setPlatformTab("facebook");
  } else if (u.includes("youtube.com") || u.includes("youtu.be")) {
    setPlatformTab("youtube");
  }
}

urlInput.addEventListener("input", () => {
  autoDetectPlatform(urlInput.value);
});

// 1-Click Clipboard Paste Button
pasteBtn.addEventListener("click", async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      urlInput.value = text.trim();
      autoDetectPlatform(text);
      fetchMedia();
    }
  } catch (err) {
    showStatus("Could not read clipboard. Please paste manually into the input box.", true);
  }
});

// Display Status Banner
function showStatus(message, isError = true) {
  if (!message) {
    statusBox.classList.add("hidden");
    statusBox.textContent = "";
    return;
  }
  statusBox.textContent = message;
  statusBox.className = `status ${isError ? "error" : "info"}`;
  statusBox.classList.remove("hidden");
}

// Toggle Loading State for Info Fetch
function setInfoLoading(isLoading) {
  infoBtn.disabled = isLoading;
  btnText.textContent = isLoading ? "Fetching..." : "Fetch Media";
  btnSpinner.classList.toggle("hidden", !isLoading);
}

// Open Media Preview Modal
function openPreviewModal() {
  if (!currentPreviewUrl && !currentVideoId) return;

  modalTitle.textContent = currentTitleText || "Media Preview";
  modalExternalLinkBtn.href = currentWebpageUrl || urlInput.value.trim() || "#";

  if (currentMediaType === "image") {
    previewVideo.classList.add("hidden");
    previewVideo.pause();
    previewIframe.classList.add("hidden");
    previewModalImg.src = currentPreviewUrl;
    previewModalImg.classList.remove("hidden");
  } else if (currentPreviewUrl) {
    previewModalImg.classList.add("hidden");
    previewIframe.classList.add("hidden");
    previewVideo.src = currentPreviewUrl;
    previewVideo.classList.remove("hidden");
    previewVideo.load();
    previewVideo.play().catch(() => {});
  } else if (currentVideoId) {
    previewModalImg.classList.add("hidden");
    previewVideo.classList.add("hidden");
    previewVideo.pause();
    previewIframe.src = `https://www.youtube.com/embed/${currentVideoId}?autoplay=1&rel=0`;
    previewIframe.classList.remove("hidden");
  }

  previewModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

// Close Video Preview Modal
function closePreviewModal() {
  if (previewVideo) {
    previewVideo.pause();
    previewVideo.removeAttribute("src");
    previewVideo.load();
  }
  if (previewIframe) {
    previewIframe.src = "";
  }
  previewModal.classList.add("hidden");
  document.body.style.overflow = "";
}

// Modal Event Listeners
playOverlayBtn.addEventListener("click", openPreviewModal);
previewBtn.addEventListener("click", openPreviewModal);
modalCloseBtn.addEventListener("click", closePreviewModal);
modalBackdrop.addEventListener("click", closePreviewModal);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !previewModal.classList.contains("hidden")) {
    closePreviewModal();
  }
});

// Copy Direct Link Button
copyDirectLinkBtn.addEventListener("click", () => {
  const url = currentWebpageUrl || urlInput.value.trim();
  if (!url) return;
  navigator.clipboard.writeText(url).then(() => {
    const originalText = copyDirectLinkBtn.innerHTML;
    copyDirectLinkBtn.innerHTML = `✓ Copied!`;
    setTimeout(() => {
      copyDirectLinkBtn.innerHTML = originalText;
    }, 2000);
  });
});

// Fetch Media Form Handler
async function fetchMedia() {
  const url = urlInput.value.trim();
  if (!url) {
    showStatus("Please enter a link to download.", true);
    return;
  }

  showStatus("");
  previewSection.classList.add("hidden");
  profileSection.classList.add("hidden");
  carouselSection.classList.add("hidden");
  progressSection.classList.add("hidden");
  successCard.classList.add("hidden");

  setInfoLoading(true);

  try {
    const formData = new URLSearchParams({ url });
    const response = await fetch("/api/info", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData,
    });

    const data = await response.json();
    if (!data.ok) {
      throw new Error(data.error || "Failed to fetch media details.");
    }

    lastFetchedData = data;
    currentWebpageUrl = data.webpage_url || url;

    // Detect and switch tab if appropriate
    if (data.platform && data.platform !== "generic") {
      setPlatformTab(data.platform);
    }

    // 1. Check if it's a Profile or Channel Feed
    if (data.is_profile && data.items && data.items.length > 0) {
      renderProfile(data);
      return;
    }

    // 2. Check if it's an Instagram Carousel / Multi-item Post
    if (data.is_carousel && data.items && data.items.length > 0) {
      renderCarousel(data);
      return;
    }

    // 3. Single Media Rendering
    renderSingleMedia(data);
  } catch (err) {
    showStatus(err.message || "Could not retrieve media from this link.", true);
  } finally {
    setInfoLoading(false);
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  fetchMedia();
});

// Render Single Media Card
function renderSingleMedia(data) {
  currentVideoId = data.video_id || "";
  currentPreviewUrl = data.preview_url || data.thumbnail || "";
  currentMediaType = data.media_type || "video";
  currentTitleText = data.title || "Media File";

  videoTitle.textContent = currentTitleText;
  videoUploader.textContent = data.uploader ? `By ${data.uploader}` : "";
  thumbImg.src = data.thumbnail || data.preview_url || "";
  
  if (data.duration && data.duration !== "Unknown") {
    durationBadge.textContent = data.duration;
    durationBadge.classList.remove("hidden");
  } else {
    durationBadge.classList.add("hidden");
  }

  platformTagBadge.textContent = (data.platform || "Media").toUpperCase();

  // Populate Quality Dropdown
  qualitySelect.innerHTML = "";
  if (data.qualities && data.qualities.length > 0) {
    data.qualities.forEach((q) => {
      const option = document.createElement("option");
      option.value = q.id;
      option.textContent = q.label;
      if (q.direct_url) {
        option.dataset.directUrl = q.direct_url;
      }
      qualitySelect.appendChild(option);
    });
  } else {
    const option = document.createElement("option");
    option.value = "best";
    option.textContent = "⚡ Best Quality (Original)";
    qualitySelect.appendChild(option);
  }

  previewSection.classList.remove("hidden");
}

// Render Profile & Feed Card
function renderProfile(data) {
  profileName.textContent = data.profile_name || "Profile Feed";
  profileHandle.textContent = data.profile_handle || "@profile";
  profilePlatformBadge.textContent = (data.platform || "Platform").toUpperCase();
  profileCountBadge.textContent = `${data.posts_count || data.items.length} posts/stories loaded`;
  profileAvatar.src = data.profile_avatar || (data.items[0] ? data.items[0].thumbnail : "");
  profileExternalBtn.href = data.webpage_url || urlInput.value.trim() || "#";

  profilePostsGrid.innerHTML = "";
  data.items.forEach((item) => {
    const card = document.createElement("div");
    card.className = "profile-post-card";

    const isVid = item.media_type === "video";
    const typeLabel = isVid ? "VIDEO" : "POST";
    const thumbSrc = item.thumbnail || item.direct_url || "";

    card.innerHTML = `
      <div class="profile-post-thumb-wrapper">
        <img src="${thumbSrc}" alt="${item.title}" loading="lazy">
        <span class="carousel-type-badge">${typeLabel}</span>
        ${item.duration ? `<span class="duration-badge">${item.duration}</span>` : ""}
      </div>
      <div class="profile-post-body">
        <span class="profile-post-title" title="${item.title}">${item.title}</span>
        <div class="profile-post-actions">
          <button type="button" class="btn-primary profile-post-dl" data-url="${item.url}" data-title="${item.title}" data-direct-url="${item.direct_url}" data-ext="${item.ext}">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            Download
          </button>
          <button type="button" class="btn-secondary profile-post-fetch" data-url="${item.url}">
            Details
          </button>
        </div>
      </div>
    `;

    const dlBtn = card.querySelector(".profile-post-dl");
    dlBtn.addEventListener("click", () => {
      triggerDirectDownload(
        item.url || urlInput.value.trim(),
        "best",
        item.title,
        item.direct_url,
        item.ext
      );
    });

    const fetchBtn = card.querySelector(".profile-post-fetch");
    fetchBtn.addEventListener("click", () => {
      urlInput.value = item.url;
      fetchMedia();
    });

    profilePostsGrid.appendChild(card);
  });

  profileSection.classList.remove("hidden");
}

// Render Instagram Carousel Multi-item Grid
function renderCarousel(data) {
  carouselTitle.textContent = data.title || "Instagram Post";
  carouselUploader.textContent = data.uploader ? `By ${data.uploader}` : "@creator";
  carouselCountBadge.textContent = `${data.items_count || data.items.length} items found`;

  carouselGrid.innerHTML = "";
  data.items.forEach((item) => {
    const card = document.createElement("div");
    card.className = "carousel-item-card";

    const isVid = item.media_type === "video";
    const typeLabel = isVid ? "VIDEO" : "PHOTO";
    const thumbSrc = item.thumbnail || item.direct_url || "";

    card.innerHTML = `
      <div class="carousel-thumb-wrapper">
        <img src="${thumbSrc}" alt="${item.title}" loading="lazy">
        <span class="carousel-type-badge">${typeLabel}</span>
      </div>
      <div class="carousel-item-body">
        <span class="carousel-item-title">${item.title}</span>
        <button type="button" class="btn-primary carousel-dl-btn" data-direct-url="${item.direct_url}" data-ext="${item.ext}" data-title="${item.title}">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          Download
        </button>
      </div>
    `;

    const dlBtn = card.querySelector(".carousel-dl-btn");
    dlBtn.addEventListener("click", () => {
      triggerDirectDownload(
        urlInput.value.trim(),
        "best",
        item.title,
        item.direct_url,
        item.ext
      );
    });

    carouselGrid.appendChild(card);
  });

  carouselSection.classList.remove("hidden");
}

// Trigger Direct Browser Download
function triggerDirectDownload(url, quality = "best", title = "", directUrl = "", ext = "") {
  showStatus("");
  const params = new URLSearchParams({
    url: url,
    quality: quality,
    title: title || currentTitleText || "Media",
  });

  if (directUrl) params.append("direct_url", directUrl);
  if (ext) params.append("ext", ext);

  const downloadEndpoint = `/api/download/direct?${params.toString()}`;

  const a = document.createElement("a");
  a.href = downloadEndpoint;
  a.setAttribute("download", "");
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  showStatus("Download started! Check your downloads bar.", false);
}

// Direct Download Button Listener
directDownloadBtn.addEventListener("click", () => {
  const url = urlInput.value.trim();
  const selectedOption = qualitySelect.options[qualitySelect.selectedIndex];
  const quality = qualitySelect.value;
  const directUrl = selectedOption ? selectedOption.dataset.directUrl || "" : "";
  const ext = currentMediaType === "image" ? "jpg" : (quality.includes("audio") ? "mp3" : "mp4");

  triggerDirectDownload(url, quality, currentTitleText, directUrl, ext);
});

// Download Another Video Button
downloadAnotherBtn.addEventListener("click", () => {
  urlInput.value = "";
  previewSection.classList.add("hidden");
  profileSection.classList.add("hidden");
  carouselSection.classList.add("hidden");
  progressSection.classList.add("hidden");
  successCard.classList.add("hidden");
  statusBox.classList.add("hidden");
  urlInput.focus();
});

// Open Folder Button
openFolderBtn.addEventListener("click", async () => {
  try {
    const res = await fetch("/api/open-folder", { method: "POST" });
    const data = await res.json();
    if (!data.ok) {
      showStatus(data.error || "Could not open folder on server.", true);
    }
  } catch (err) {
    showStatus("Could not communicate with server to open folder.", true);
  }
});
