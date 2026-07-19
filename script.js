const isMobile = /Mobi|Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 900;
if (isMobile) document.documentElement.classList.add('mobile');

const viewerContent = document.getElementById('viewerContent');
const viewerLabel = document.getElementById('viewerLabel');
const arrowLeft = document.getElementById('arrowLeft');
const arrowRight = document.getElementById('arrowRight');

let slides = [];
let currentSlide = 0;

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
    viewerContent.innerHTML = `<div class="viewer-placeholder"><img src="jI5PI.png" alt="" class="viewer-logo"></div>`;
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
    viewerContent.innerHTML = `<div class="viewer-placeholder" style="flex-direction:column;gap:20px"><img src="jI5PI.png" alt="" class="viewer-logo" style="opacity:0.4"><a href="${slide.url}" target="_blank" rel="noopener" style="color:#00d4ff;font-size:18px;text-transform:uppercase;letter-spacing:2px;border:1px solid rgba(0,212,255,0.3);padding:14px 32px;border-radius:8px;text-decoration:none">Watch on ${slide.label}</a></div>`;
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

async function buildSlides() {
  let ytVideoId = null;
  let twitchLive = false;
  let twitchVodId = null;
  let kickUrl = null;

  // YouTube latest video
  try {
    const res = await fetch('https://decapi.me/youtube/videos/fullmetalreptile?limit=1');
    const text = await res.text();
    if (text && text.startsWith('http')) {
      ytVideoId = extractYouTubeId(text);
    }
  } catch (e) {}

  // Twitch
  try {
    const liveRes = await fetch('https://decapi.me/twitch/uptime/fullmetalreptile');
    const liveText = await liveRes.text();
    twitchLive = liveText && liveText.length > 0 && !liveText.includes('offline');
  } catch (e) {}

  try {
    const vodRes = await fetch('https://decapi.me/twitch/vods/fullmetalreptile?limit=1');
    const vodText = await vodRes.text();
    if (vodText && vodText.startsWith('http')) {
      twitchVodId = extractTwitchVodId(vodText);
    }
  } catch (e) {}

  // Kick
  try {
    const kickRes = await fetch(`https://kick.com/api/v2/channels/full-metal-reptile`);
    if (kickRes.ok) {
      const data = await kickRes.json();
      if (data?.livestream?.is_live === true) {
        kickUrl = 'https://kick.com/full-metal-reptile';
      }
    }
  } catch (e) {}

  slides = [];

  if (ytVideoId) {
    slides.push({ type: 'youtube', id: ytVideoId, label: 'Latest YouTube Video' });
  }
  if (twitchLive) {
    slides.push({ type: 'twitch', id: 'channel=fullmetalreptile', label: 'Twitch Live' });
  } else if (twitchVodId) {
    slides.push({ type: 'twitch-vod', id: twitchVodId, label: 'Latest Twitch VOD' });
  }
  if (kickUrl) {
    slides.push({ type: 'link', url: kickUrl, label: 'Kick Live' });
  }

  if (slides.length > 0) {
    currentSlide = 0;
    renderSlide(0);
  }
}

buildSlides();

async function checkLiveStatus() {
  const badges = document.querySelectorAll('.live-badge');
  let twitchLive = false;
  let kickLive = false;
  let youtubeLive = false;

  try {
    const twitchRes = await fetch('https://decapi.me/twitch/uptime/fullmetalreptile');
    const twitchText = await twitchRes.text();
    twitchLive = twitchText && twitchText.length > 0 && !twitchText.includes('offline');
  } catch (e) {}

  try {
    const kickRes = await fetch(`https://kick.com/api/v2/channels/full-metal-reptile`);
    if (kickRes.ok) {
      const data = await kickRes.json();
      kickLive = data?.livestream?.is_live === true;
    }
  } catch (e) {}

  try {
    const ytRes = await fetch(`https://www.youtube.com/@FullMetalReptile`, { mode: 'cors' });
    const ytText = await ytRes.text();
    youtubeLive = ytText.includes('isLiveNow') || ytText.includes('"isLive":true');
  } catch (e) {
    try {
      const ytRes2 = await fetch(`https://www.youtube.com/@FullMetalReptile/live`, { mode: 'cors' });
      youtubeLive = ytRes2.redirected || ytRes2.url.includes('/watch');
    } catch (e2) {}
  }

  const liveServices = [];
  if (twitchLive) liveServices.push('twitch');
  if (kickLive) liveServices.push('kick');
  if (youtubeLive) liveServices.push('youtube');

  const chosen = liveServices.length > 0
    ? liveServices[Math.floor(Math.random() * liveServices.length)]
    : null;

  badges.forEach(b => {
    if (b.dataset.service === chosen) {
      b.textContent = 'LIVE';
      b.classList.add('live');
    } else {
      b.textContent = '';
      b.classList.remove('live');
    }
  });
}
checkLiveStatus();
