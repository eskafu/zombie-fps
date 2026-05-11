// ═══════════════════════════════════════════════════════
// Zombie FPS — Integração com Google Sheets Ranking
// ═══════════════════════════════════════════════════════

const API_URL = 'https://script.google.com/macros/s/AKfycbz9tyT1vcOgO6syx7gkB5H_9G4w0XiJhst9ByaTFCqtz42HYOlIZbE6VMfWu3-vQb0Ptw/exec';

let cachedLeaderboard = null;
let cachedTime = 0;
const CACHE_DURATION = 60;

// ═══════════════════════════════════════════════════════
// Enviar score (no-cors = fire and forget)
// ═══════════════════════════════════════════════════════
export async function submitScore(name, score, round, kills) {
  try {
    await fetch(API_URL, {
      method: 'POST',
      mode: 'no-cors',
      body: JSON.stringify({ name, score, round, kills }),
    });
    cachedLeaderboard = null;
    return { success: true };
  } catch (err) {
    console.error('Ranking POST error:', err);
    return { success: false, error: err.message };
  }
}

// ═══════════════════════════════════════════════════════
// Obter leaderboard via JSONP (bypass CORS)
// ═══════════════════════════════════════════════════════
export function getLeaderboard() {
  const now = Date.now() / 1000;
  if (cachedLeaderboard && (now - cachedTime) < CACHE_DURATION) {
    return Promise.resolve(cachedLeaderboard);
  }

  return new Promise((resolve) => {
    const callbackName = 'zm_ranking_' + Math.random().toString(36).slice(2);
    const script = document.createElement('script');
    const timeout = setTimeout(() => {
      cleanup();
      resolve(cachedLeaderboard || []);
    }, 5000);

    function cleanup() {
      clearTimeout(timeout);
      delete window[callbackName];
      if (script.parentNode) script.remove();
    }

    window[callbackName] = (data) => {
      cleanup();
      if (Array.isArray(data)) {
        cachedLeaderboard = data;
        cachedTime = Date.now() / 1000;
        resolve(data);
      } else {
        resolve(cachedLeaderboard || []);
      }
    };

    script.src = API_URL + '?callback=' + callbackName;
    script.onerror = () => {
      cleanup();
      resolve(cachedLeaderboard || []);
    };
    document.head.appendChild(script);
  });
}

export function isConfigured() {
  return true;
}
