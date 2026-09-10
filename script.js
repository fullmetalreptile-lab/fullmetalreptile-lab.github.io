// One-time cache cleanup from old versions
try {
  if (!localStorage.getItem('fmr_v2')) {
    Object.keys(localStorage).filter(k => k.startsWith('fmr_')).forEach(k => localStorage.removeItem(k));
    localStorage.setItem('fmr_v2', '1');
  }
} catch {}

const isMobile = /Mobi|Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 900;
if (isMobile) document.documentElement.classList.add('mobile');

const viewerContent = document.getElementById('viewerContent');
const viewerLabel = document.getElementById('viewerLabel');
const arrowLeft = document.getElementById('arrowLeft');
const arrowRight = document.getElementById('arrowRight');

let slides = [];
let currentSlide = 0;

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

function renderSlide(index) {
  const slide = slides[index];
  if (!slide) {
    viewerContent.innerHTML = '<div class="viewer-placeholder"><img src="logo.webp" alt="" class="viewer-logo" width="400" height="400"></div>';
    viewerLabel.textContent = '';
    arrowLeft.style.display = 'none';
    arrowRight.style.display = 'none';
    arrowLeft.setAttribute('aria-hidden', 'true');
    arrowRight.setAttribute('aria-hidden', 'true');
    return;
  }
  arrowLeft.style.display = index === 0 ? 'none' : '';
  arrowRight.style.display = index === slides.length - 1 ? 'none' : '';
  arrowLeft.setAttribute('aria-hidden', index === 0 ? 'true' : 'false');
  arrowRight.setAttribute('aria-hidden', index === slides.length - 1 ? 'true' : 'false');
  viewerLabel.textContent = slide.label;
  viewerContent.innerHTML = '';

  if (slide.type === 'youtube') {
    createIframe(viewerContent, `https://www.youtube.com/embed/${slide.id}?autoplay=1&mute=1`);
  } else if (slide.type === 'twitch') {
    createIframe(viewerContent, `https://player.twitch.tv/?channel=fullmetalreptile&parent=${TWITCH_PARENTS}&autoplay=true&muted=true`);
  } else if (slide.type === 'twitch-vod') {
    createIframe(viewerContent, `https://player.twitch.tv/?video=${slide.id}&parent=${TWITCH_PARENTS}&autoplay=true&muted=true`);
  } else if (slide.type === 'link') {
    viewerContent.innerHTML = `<div class="viewer-placeholder" style="flex-direction:column;gap:20px"><img src="logo.webp" alt="" class="viewer-logo" style="opacity:0.4" width="400" height="400"><a href="${slide.url}" target="_blank" rel="noopener" style="color:#00d4ff;font-size:18px;text-transform:uppercase;letter-spacing:2px;border:1px solid rgba(0,212,255,0.3);padding:14px 32px;border-radius:8px;text-decoration:none">Watch on ${slide.label}</a></div>`;
  }
}

arrowLeft.addEventListener('click', () => {
  if (slides.length === 0) return;
  currentSlide = (currentSlide - 1 + slides.length) % slides.length;
  renderSlide(currentSlide);
});

arrowRight.addEventListener('click', () => {
  if (slides.length === 0) return;
  currentSlide = (currentSlide + 1) % slides.length;
  renderSlide(currentSlide);
});

document.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft') arrowLeft.click();
  if (e.key === 'ArrowRight') arrowRight.click();
});

// Show LIVE badge on EVERY currently live service (not just one random)
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
  if (newKey === lastSlidesKey) return;
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

// Immediate fetch, then poll every 30s
fetchAll();
setInterval(fetchAll, 30000);
