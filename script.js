const header = document.getElementById('header');
window.addEventListener('scroll', () => {
  header.classList.toggle('scrolled', window.scrollY > 50);
});

const isMobile = /Mobi|Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 900;
if (isMobile) document.documentElement.classList.add('mobile');

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

async function getLatestVod() {
  try {
    const res = await fetch('https://decapi.me/twitch/vods/fullmetalreptile?limit=1');
    const url = await res.text();
    if (url && url.startsWith('http')) {
      const el = document.getElementById('latest-vod');
      if (el) el.href = url;
    }
  } catch (e) {}
}
getLatestVod();
