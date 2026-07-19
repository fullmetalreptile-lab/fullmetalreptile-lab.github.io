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
      localStorage.setItem('fmr_' + key, JSON.stringify({ data, expiry: Date.now() + ttlMs }));
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

const TWITCH_PARENTS = (function() {
  const h = location.hostname;
  const bases = [h];
  if (h === 'fullmetalreptile.com') bases.push('www.fullmetalreptile.com');
  else if (h === 'www.fullmetalreptile.com') bases.push('fullmetalreptile.com');
  return bases.join('&parent=');
})();

// Load Twitch Embed API
(function() {
  var s = document.createElement('script');
  s.src = 'https://embed.twitch.tv/embed/v1.js';
  s.async = true;
  document.head.appendChild(s);
})();

var tPlayerId = 0;

function waitTwitch(cb) {
  if (window.Twitch) { cb(); return; }
  var check = setInterval(function() {
    if (window.Twitch) { clearInterval(check); cb(); }
  }, 100);
}

function createIframe(parent, src) {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('allow', 'autoplay; fullscreen');
  iframe.setAttribute('allowfullscreen', '');
  parent.appendChild(iframe);
  iframe.src = src;
  return iframe;
}

function renderSlide(index) {
  const slide = slides[index];
  if (!slide) {
    viewerContent.innerHTML = '<div class="viewer-placeholder"><img src="logo.webp" alt="" class="viewer-logo"></div>';
    viewerLabel.textContent = '';
    arrowLeft.style.display = 'none';
    arrowRight.style.display = 'none';
    return;
  }
  arrowLeft.style.display = index === 0 ? 'none' : '';
  arrowRight.style.display = index === slides.length - 1 ? 'none' : '';
  viewerLabel.textContent = slide.label;
  viewerContent.innerHTML = '';
  if (slide.type === 'youtube') {
    createIframe(viewerContent, `https://www.youtube.com/embed/${slide.id}?autoplay=1&mute=1`);
  } else if (slide.type === 'twitch') {
    var id = 'tw-p-' + (++tPlayerId);
    var div = document.createElement('div');
    div.id = id;
    div.style.cssText = 'width:100%;height:100%';
    viewerContent.appendChild(div);
    waitTwitch(function() {
      new Twitch.Player(id, { channel: 'fullmetalreptile', width: '100%', height: '100%', autoplay: true });
    });
  } else if (slide.type === 'twitch-vod') {
    var id = 'tw-p-' + (++tPlayerId);
    var div = document.createElement('div');
    div.id = id;
    div.style.cssText = 'width:100%;height:100%';
    viewerContent.appendChild(div);
    waitTwitch(function() {
      new Twitch.Player(id, { video: slide.id, width: '100%', height: '100%', autoplay: true });
    });
  } else if (slide.type === 'link') {
    viewerContent.innerHTML = `<div class="viewer-placeholder" style="flex-direction:column;gap:20px"><img src="logo.webp" alt="" class="viewer-logo" style="opacity:0.4"><a href="${slide.url}" target="_blank" rel="noopener" style="color:#00d4ff;font-size:18px;text-transform:uppercase;letter-spacing:2px;border:1px solid rgba(0,212,255,0.3);padding:14px 32px;border-radius:8px;text-decoration:none">Watch on ${slide.label}</a></div>`;
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

function updateBadges(twitchLive, kickLive) {
  const liveServices = [];
  if (twitchLive) liveServices.push('twitch');
  if (kickLive) liveServices.push('kick');
  const chosen = liveServices.length > 0 ? liveServices[Math.floor(Math.random() * liveServices.length)] : null;
  document.querySelectorAll('.live-badge').forEach(b => {
    if (b.dataset.service === chosen) {
      b.textContent = 'LIVE';
      b.classList.add('live');
    } else {
      b.textContent = '';
      b.classList.remove('live');
    }
  });
}

function buildSlidesFrom(results) {
  slides = [];
  if (results.ytVideoId) slides.push({ type: 'youtube', id: results.ytVideoId, label: 'Latest YouTube Video' });
  if (results.twitchLive) slides.push({ type: 'twitch', id: 'channel=fullmetalreptile', label: 'Twitch Live' });
  else if (results.twitchVodId) slides.push({ type: 'twitch-vod', id: results.twitchVodId, label: 'Latest Twitch VOD' });
  if (results.kickLive) slides.push({ type: 'link', url: 'https://kick.com/full-metal-reptile', label: 'Kick Live' });

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
  fetches.push(
    API.json(RSS2JSON + YT_RSS, 'yt_rss', 300000).then(d => {
      if (d && d.items && d.items.length > 0) {
        results.ytVideoId = extractYouTubeId(d.items[0].link);
      }
    }).catch(() => {})
  );

  // Twitch live
  fetches.push(
    API.text('https://decapi.me/twitch/uptime/fullmetalreptile', 'tw_uptime', 0).then(t => {
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

  // Kick live
  fetches.push(
    API.json('https://kick.com/api/v2/channels/full-metal-reptile', 'kick', 0).then(d => {
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
