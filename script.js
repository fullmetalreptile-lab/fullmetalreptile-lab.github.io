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
  set(key, data, ttlMs = 120000) {
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
    cache.set(cacheKey, text, ttl);
    return text;
  },
  async json(url, cacheKey, ttl) {
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const data = await res.json();
    cache.set(cacheKey, data, ttl);
    return data;
  }
};

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

function renderSlide(index) {
  const slide = slides[index];
  if (!slide) {
    viewerContent.innerHTML = '<div class="viewer-placeholder"><img src="logo.webp" alt="" class="viewer-logo"></div>';
    viewerLabel.textContent = '';
    return;
  }
  viewerLabel.textContent = slide.label;
  if (slide.type === 'youtube') {
    viewerContent.innerHTML = `<iframe src="https://www.youtube.com/embed/${slide.id}?autoplay=1" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
  } else if (slide.type === 'twitch') {
    viewerContent.innerHTML = `<iframe src="https://player.twitch.tv/?${slide.id}&parent=fullmetalreptile.com&autoplay=true" allow="autoplay" allowfullscreen></iframe>`;
  } else if (slide.type === 'twitch-vod') {
    viewerContent.innerHTML = `<iframe src="https://player.twitch.tv/?video=${slide.id}&parent=fullmetalreptile.com&autoplay=true" allow="autoplay" allowfullscreen></iframe>`;
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

async function fetchAll() {
  const results = { ytVideoId: null, twitchLive: false, twitchVodId: null, kickLive: false, ytLive: false };

  const fetches = [];

  fetches.push(
    API.text('https://decapi.me/youtube/videos/fullmetalreptile?limit=1', 'yt_video', 300000).then(t => {
      if (t && t.startsWith('http')) results.ytVideoId = extractYouTubeId(t);
    }).catch(() => {})
  );

  fetches.push(
    API.text('https://decapi.me/twitch/uptime/fullmetalreptile', 'tw_uptime', 120000).then(t => {
      results.twitchLive = t && t.length > 0 && !t.includes('offline');
    }).catch(() => {})
  );

  fetches.push(
    API.text('https://decapi.me/twitch/vods/fullmetalreptile?limit=1', 'tw_vod', 300000).then(t => {
      if (t && t.startsWith('http')) results.twitchVodId = extractTwitchVodId(t);
    }).catch(() => {})
  );

  fetches.push(
    API.json('https://kick.com/api/v2/channels/full-metal-reptile', 'kick', 120000).then(d => {
      results.kickLive = d?.livestream?.is_live === true;
    }).catch(() => {})
  );

  // YouTube live check (race with timeout)
  fetches.push(
    new Promise(resolve => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      fetch('https://www.youtube.com/@FullMetalReptile', { signal: controller.signal, mode: 'cors' })
        .then(r => r.text())
        .then(t => { results.ytLive = t.includes('isLiveNow') || t.includes('"isLive":true'); })
        .catch(() => {})
        .finally(() => { clearTimeout(timeout); resolve(); });
    })
  );

  await Promise.allSettled(fetches);

  slides = [];
  if (results.ytVideoId) slides.push({ type: 'youtube', id: results.ytVideoId, label: 'Latest YouTube Video' });
  if (results.twitchLive) slides.push({ type: 'twitch', id: 'channel=fullmetalreptile', label: 'Twitch Live' });
  else if (results.twitchVodId) slides.push({ type: 'twitch-vod', id: results.twitchVodId, label: 'Latest Twitch VOD' });
  if (results.kickLive) slides.push({ type: 'link', url: 'https://kick.com/full-metal-reptile', label: 'Kick Live' });

  if (slides.length > 0) {
    currentSlide = 0;
    renderSlide(0);
  }

  // Update live badges
  const liveServices = [];
  if (results.twitchLive) liveServices.push('twitch');
  if (results.kickLive) liveServices.push('kick');
  if (results.ytLive) liveServices.push('youtube');
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

fetchAll();
