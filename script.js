// One-time cache cleanup from old versions
try {
  if (!localStorage.getItem('fmr_v2')) {
    Object.keys(localStorage).filter(k => k.startsWith('fmr_')).forEach(k => localStorage.removeItem(k));
    localStorage.setItem('fmr_v2', '1');
  }
} catch {}

const isMobile = /Mobi|Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 900;
if (isMobile) document.documentElement.classList.add('mobile');

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const viewerStage = document.getElementById('viewerStage');
const viewerFrame = document.getElementById('viewerFrame');
const viewerContent = document.getElementById('viewerContent');
const viewerLabel = document.getElementById('viewerLabel');
const viewerCounter = document.getElementById('viewerCounter');
const viewerDots = document.getElementById('viewerDots');
const viewerLoader = document.getElementById('viewerLoader');
const liveBanner = document.getElementById('liveBanner');
const autoToggle = document.getElementById('autoToggle');
const arrowLeft = document.getElementById('arrowLeft');
const arrowRight = document.getElementById('arrowRight');

let slides = [];
let currentSlide = 0;
let loaderTimer = null;

const cache = {
  get(key) {
    try {
      const raw = localStorage.getItem('fmr_' + key);
      if (!raw) return null;
      const { data, expiry } = JSON.parse(raw);
      return Date.now() < expiry ? data : null;
    } catch { return null; }
  },
  set(key, data, ttlMs) {
    try {
      // Never allow zero/negative TTL (would expire immediately)
      const safeTtl = Math.max(ttlMs || 0, 5000);
      localStorage.setItem('fmr_' + key, JSON.stringify({ data, expiry: Date.now() + safeTtl }));
    } catch {}
  }
};

const API = {
  async text(url, cacheKey, ttl) {
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const text = await res.text();
    if (cacheKey) cache.set(cacheKey, text, ttl);
    return text;
  },
  async json(url, cacheKey, ttl) {
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const data = await res.json();
    if (cacheKey) cache.set(cacheKey, data, ttl);
    return data;
  }
};

const YT_CHANNEL_ID = 'UCH0pZ3TvrJiA51F_jzArXNA';
const RSS2JSON = 'https://api.rss2json.com/v1/api.json?rss_url=';
const YT_RSS = encodeURIComponent(`https://www.youtube.com/feeds/videos.xml?channel_id=${YT_CHANNEL_ID}`);

function extractYouTubeId(url) {
  if (!url) return null;
  const m = url.match(/(?:v=|youtu\.be\/|\/embed\/)([\w-]{11})/);
  return m ? m[1] : null;
}

function extractTwitchVodId(url) {
  if (!url) return null;
  const m = url.match(/(?:videos\/|video=)(\d+)/);
  return m ? m[1] : null;
}

// Build Twitch parent list for embeds (custom domain + www + github.io fallback)
const TWITCH_PARENTS = (function() {
  const h = location.hostname;
  const bases = new Set([h]);
  if (h === 'fullmetalreptile.com' || h === 'www.fullmetalreptile.com') {
    bases.add('fullmetalreptile.com');
    bases.add('www.fullmetalreptile.com');
  }
  // Allow GitHub Pages preview / fallback
  if (h.endsWith('.github.io')) {
    bases.add(h);
  }
  return Array.from(bases).join('&parent=');
})();

function createIframe(parent, src) {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('allow', 'autoplay; fullscreen');
  iframe.setAttribute('allowfullscreen', '');
  iframe.setAttribute('title', 'Stream player');
  parent.appendChild(iframe);
  iframe.src = src;
  return iframe;
}

function showLoader(show) {
  if (loaderTimer) { clearTimeout(loaderTimer); loaderTimer = null; }
  if (show) {
    // Only show loader if the embed takes a moment to boot
    loaderTimer = setTimeout(() => { viewerLoader.hidden = false; }, 350);
  } else {
    viewerLoader.hidden = true;
  }
}

function isLiveSlide(slide) {
  return slide && (slide.type === 'twitch' || slide.label === 'Kick Live');
}

function renderDots() {
  viewerDots.innerHTML = '';
  if (slides.length <= 1) { viewerDots.hidden = true; return; }
  viewerDots.hidden = false;
  slides.forEach((s, i) => {
    const dot = document.createElement('button');
    dot.className = 'dot' + (i === currentSlide ? ' active' : '');
    dot.type = 'button';
    dot.setAttribute('role', 'tab');
    dot.setAttribute('aria-selected', i === currentSlide ? 'true' : 'false');
    dot.setAttribute('aria-label', `Go to slide ${i + 1}: ${s.label}`);
    dot.addEventListener('click', () => { currentSlide = i; renderSlide(i); resetAutoTimer(); });
    viewerDots.appendChild(dot);
  });
}

function renderSlide(index) {
  const slide = slides[index];
  viewerFrame.classList.toggle('is-live', isLiveSlide(slide));
  liveBanner.hidden = !isLiveSlide(slide);

  if (!slide) {
    viewerContent.innerHTML = '<div class="viewer-placeholder"><img src="logo.webp" alt="" class="viewer-logo" width="400" height="400"></div>';
    viewerLabel.textContent = 'ALL SYSTEMS OFFLINE';
    viewerCounter.textContent = '-- / --';
    arrowLeft.style.display = 'none';
    arrowRight.style.display = 'none';
    arrowLeft.setAttribute('aria-hidden', 'true');
    arrowRight.setAttribute('aria-hidden', 'true');
    viewerDots.hidden = true;
    return;
  }

  arrowLeft.style.display = index === 0 ? 'none' : '';
  arrowRight.style.display = index === slides.length - 1 ? 'none' : '';
  arrowLeft.setAttribute('aria-hidden', index === 0 ? 'true' : 'false');
  arrowRight.setAttribute('aria-hidden', index === slides.length - 1 ? 'true' : 'false');

  viewerLabel.textContent = slide.label;
  viewerCounter.textContent = `${String(index + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`;
  viewerContent.innerHTML = '';
  showLoader(true);

  if (slide.type === 'youtube') {
    createIframe(viewerContent, `https://www.youtube.com/embed/${slide.id}?autoplay=1&mute=1`);
  } else if (slide.type === 'twitch') {
    createIframe(viewerContent, `https://player.twitch.tv/?channel=fullmetalreptile&parent=${TWITCH_PARENTS}&autoplay=true&muted=true`);
  } else if (slide.type === 'twitch-vod') {
    createIframe(viewerContent, `https://player.twitch.tv/?video=${slide.id}&parent=${TWITCH_PARENTS}&autoplay=true&muted=true`);
  } else if (slide.type === 'link') {
    showLoader(false);
    viewerContent.innerHTML = `<div class="viewer-card kick viewer-placeholder"><img src="logo.webp" alt="" class="viewer-logo" style="opacity:0.4" width="400" height="400"><a class="card-cta" href="${slide.url}" target="_blank" rel="noopener">Watch on ${slide.label}</a></div>`;
  }

  if (!reducedMotion) {
    viewerContent.classList.remove('slide-in');
    void viewerContent.offsetWidth;
    viewerContent.classList.add('slide-in');
  }

  // Hide loader after a grace period (embeds give no reliable load event cross-origin)
  showLoader(false);

  renderDots();
}

function next(delta) {
  if (slides.length === 0) return;
  currentSlide = (currentSlide + delta + slides.length) % slides.length;
  renderSlide(currentSlide);
}

arrowLeft.addEventListener('click', () => { next(-1); resetAutoTimer(); });
arrowRight.addEventListener('click', () => { next(1); resetAutoTimer(); });

document.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft') { next(-1); resetAutoTimer(); }
  if (e.key === 'ArrowRight') { next(1); resetAutoTimer(); }
});

// --- Touch / swipe navigation ---
let touchStartX = null;
let touchStartY = null;

viewerStage.addEventListener('touchstart', e => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });

viewerStage.addEventListener('touchend', e => {
  if (touchStartX === null) return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  touchStartX = touchStartY = null;
  if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
  if (!reducedMotion && viewerStage.classList) {
    const cls = dx < 0 ? 'nudge-right' : 'nudge-left';
    viewerStage.classList.remove('nudge-left', 'nudge-right');
    void viewerStage.offsetWidth;
    viewerStage.classList.add(cls);
    setTimeout(() => viewerStage.classList.remove(cls), 300);
  }
  next(dx < 0 ? 1 : -1);
  resetAutoTimer();
}, { passive: true });

// --- Auto-advance ---
const AUTO_INTERVAL = 20000;
let autoOn = false;
let autoTimer = null;

try {
  autoOn = localStorage.getItem('fmr_auto') === '1';
} catch {}

function applyAutoState() {
  autoToggle.classList.toggle('on', autoOn);
  autoToggle.setAttribute('aria-pressed', autoOn ? 'true' : 'false');
  if (autoOn) {
    autoTimer = setInterval(() => next(1), AUTO_INTERVAL);
  } else if (autoTimer) {
    clearInterval(autoTimer);
    autoTimer = null;
  }
}

function resetAutoTimer() {
  if (autoOn) {
    clearInterval(autoTimer);
    autoTimer = setInterval(() => next(1), AUTO_INTERVAL);
  }
}

autoToggle.addEventListener('click', () => {
  autoOn = !autoOn;
  try { localStorage.setItem('fmr_auto', autoOn ? '1' : '0'); } catch {}
  applyAutoState();
});

// --- LIVE badges ---
function updateBadges(twitchLive, kickLive) {
  document.querySelectorAll('.live-badge').forEach(b => {
    const service = b.dataset.service;
    const isLive =
      (service === 'twitch' && twitchLive) ||
      (service === 'kick' && kickLive);
    // YouTube live detection requires official API key – left disabled for now
    if (isLive) {
      b.textContent = 'LIVE';
      b.classList.add('live');
    } else {
      b.textContent = '';
      b.classList.remove('live');
    }
  });
}

let lastSlidesKey = '';

function buildSlidesFrom(results) {
  const newSlides = [];
  if (results.ytVideoId) newSlides.push({ type: 'youtube', id: results.ytVideoId, label: 'Latest YouTube Video' });
  if (results.twitchLive) newSlides.push({ type: 'twitch', id: 'channel=fullmetalreptile', label: 'Twitch Live' });
  else if (results.twitchVodId) newSlides.push({ type: 'twitch-vod', id: results.twitchVodId, label: 'Latest Twitch VOD' });
  if (results.kickLive) newSlides.push({ type: 'link', url: 'https://kick.com/full-metal-reptile', label: 'Kick Live' });

  const newKey = newSlides.map(s => s.type + ':' + (s.id || s.url)).join('|');
  // Empty key check: first run must always render (incl. offline state)
  if (newKey === lastSlidesKey && lastSlidesKey !== '') return;
  lastSlidesKey = newKey;

  slides = newSlides;
  if (slides.length > 0) {
    currentSlide = Math.min(currentSlide, slides.length - 1);
    renderSlide(currentSlide);
  } else {
    renderSlide(-1);
  }
}

async function fetchAll() {
  const results = { ytVideoId: null, twitchLive: false, twitchVodId: null, kickLive: false };

  const fetches = [];

  // YouTube latest video via rss2json (CORS-friendly RSS-to-JSON)
  // Cache 5 minutes
  fetches.push(
    API.json(RSS2JSON + YT_RSS, 'yt_rss', 300000).then(d => {
      if (d && d.items && d.items.length > 0) {
        results.ytVideoId = extractYouTubeId(d.items[0].link);
      }
    }).catch(() => {})
  );

  // Twitch live status – short cache (20s) so it stays reasonably fresh
  fetches.push(
    API.text('https://decapi.me/twitch/uptime/fullmetalreptile', 'tw_uptime', 20000).then(t => {
      results.twitchLive = t && t.length > 0 && !t.includes('offline');
    }).catch(() => {})
  );

  // Twitch VODs (endpoint is /videos/ not /vods/, response has leading " - ")
  fetches.push(
    API.text('https://decapi.me/twitch/videos/fullmetalreptile?limit=1', 'tw_vod', 60000).then(t => {
      const trimmed = t ? t.replace(/^[\s\-]+/, '').trim() : '';
      if (trimmed.startsWith('http')) results.twitchVodId = extractTwitchVodId(trimmed);
    }).catch(() => {})
  );

  // Kick live – note: direct browser fetch is usually blocked by CORS/Cloudflare.
  // Kept for cases where it works (or future proxy). Fails silently otherwise.
  fetches.push(
    API.json('https://kick.com/api/v2/channels/full-metal-reptile', 'kick', 20000).then(d => {
      results.kickLive = d?.livestream?.is_live === true;
    }).catch(() => {})
  );

  await Promise.allSettled(fetches);

  buildSlidesFrom(results);
  updateBadges(results.twitchLive, results.kickLive);
}

// --- Ambient logo glitch (mecha flavor, skipped for reduced motion) ---
if (!reducedMotion) {
  const logo = document.querySelector('.logo');
  if (logo) {
    setInterval(() => {
      logo.classList.add('glitching');
      setTimeout(() => logo.classList.remove('glitching'), 400);
    }, 9000);
  }
}

// Init
applyAutoState();
fetchAll();
setInterval(fetchAll, 30000);
