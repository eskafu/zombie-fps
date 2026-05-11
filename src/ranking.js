// ═══════════════════════════════════════════════════════
// Zombie FPS — Integração com Google Sheets Ranking
// ═══════════════════════════════════════════════════════
// Substitui o URL abaixo pelo teu depois de implementar o Apps Script
// Vai a script.google.com > Implementar > App Web e copia o URL

const API_URL = 'https://script.google.com/macros/s/AKfycbx89UcpQkAc-_PlNlhWr9_YAjmCFUo2FlQN53lZzfLOHc2GD286fOd7Urn62m93X8YshA/exec';

let cachedLeaderboard = null;
let cachedTime = 0;
const CACHE_DURATION = 60; // segundos

// ═══════════════════════════════════════════════════════
// Enviar score para o ranking
// ═══════════════════════════════════════════════════════
export async function submitScore(name, score, round, kills) {
  if (API_URL.includes('COLA_AQUI')) {
    console.warn('Ranking: URL do Apps Script não configurado');
    return { success: false, error: 'API não configurada' };
  }

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      mode: 'no-cors', // Google Apps Script requer no-cors para POST cross-origin
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, score, round, kills }),
    });
    // no-cors não permite ler a resposta, assumimos sucesso
    // Invalidar cache para forçar refresh
    cachedLeaderboard = null;
    return { success: true };
  } catch (err) {
    console.error('Ranking: erro ao submeter score', err);
    return { success: false, error: err.message };
  }
}

// ═══════════════════════════════════════════════════════
// Obter top 10 do ranking
// ═══════════════════════════════════════════════════════
export async function getLeaderboard() {
  if (API_URL.includes('COLA_AQUI')) {
    return [];
  }

  // Usar cache
  const now = Date.now() / 1000;
  if (cachedLeaderboard && (now - cachedTime) < CACHE_DURATION) {
    return cachedLeaderboard;
  }

  try {
    const res = await fetch(API_URL, { method: 'GET' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    cachedLeaderboard = data;
    cachedTime = now;
    return data;
  } catch (err) {
    console.error('Ranking: erro ao carregar leaderboard', err);
    // Retornar cache antigo se disponível
    return cachedLeaderboard || [];
  }
}

// ═══════════════════════════════════════════════════════
// Verificar se o ranking está configurado
// ═══════════════════════════════════════════════════════
export function isConfigured() {
  return !API_URL.includes('COLA_AQUI');
}
