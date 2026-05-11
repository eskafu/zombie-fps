// ═══════════════════════════════════════════════════════
// Zombie FPS — Integração com Google Sheets Ranking
// ═══════════════════════════════════════════════════════

const API_URL = 'https://script.google.com/macros/s/AKfycbx89UcpQkAc-_PlNlhWr9_YAjmCFUo2FlQN53lZzfLOHc2GD286fOd7Urn62m93X8YshA/exec';

let cachedLeaderboard = null;
let cachedTime = 0;
const CACHE_DURATION = 60;

// ═══════════════════════════════════════════════════════
// Enviar score
// ═══════════════════════════════════════════════════════
export async function submitScore(name, score, round, kills) {
  if (API_URL.includes('COLA_AQUI')) {
    return { success: false, error: 'API não configurada' };
  }

  try {
    // Sem Content-Type: application/json evita CORS preflight
    const res = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ name, score, round, kills }),
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = {}; }
    cachedLeaderboard = null;
    return { success: true, kept: data.kept !== false, message: data.message || '' };
  } catch (err) {
    console.error('Ranking: erro POST', err);
    return { success: false, error: err.message };
  }
}

// ═══════════════════════════════════════════════════════
// Obter leaderboard
// ═══════════════════════════════════════════════════════
export async function getLeaderboard() {
  if (API_URL.includes('COLA_AQUI')) return [];

  const now = Date.now() / 1000;
  if (cachedLeaderboard && (now - cachedTime) < CACHE_DURATION) {
    return cachedLeaderboard;
  }

  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (Array.isArray(data)) {
      cachedLeaderboard = data;
      cachedTime = now;
      return data;
    }
    return cachedLeaderboard || [];
  } catch (err) {
    console.error('Ranking: erro GET', err);
    return cachedLeaderboard || [];
  }
}

export function isConfigured() {
  return !API_URL.includes('COLA_AQUI');
}
