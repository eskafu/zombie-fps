// ═══════════════════════════════════════════════════════
// Zombie FPS — Ranking via Google Sheets + Apps Script
// ═══════════════════════════════════════════════════════
// Instruções:
// 1. Cria uma Google Sheet em branco no teu Drive
// 2. Vai a Extensões > Apps Script
// 3. Cola este código e guarda
// 4. Clica em "Implementar" > "Nova implementação" > "App Web"
// 5. Executa como: "Eu", Acesso: "Qualquer pessoa"
// 6. Copia o URL gerado para o ficheiro src/ranking.js

const SHEET_NAME = 'Ranking';
const MAX_SCORES = 500; // máximo de linhas antes de limpar

function doGet(e) {
  const sheet = getOrCreateSheet();
  const data = sheet.getDataRange().getValues();

  // Ignorar cabeçalho
  const scores = data.slice(1)
    .filter(row => row[0] && row[1])
    .map(row => ({
      name: String(row[0]).substring(0, 20),
      score: Number(row[1]) || 0,
      round: Number(row[2]) || 1,
      kills: Number(row[3]) || 0,
      date: row[4] || '',
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  return ContentService
    .createTextOutput(JSON.stringify(scores))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const name = String(data.name || 'Anónimo').substring(0, 20).trim();
    const score = Number(data.score) || 0;
    const round = Number(data.round) || 1;
    const kills = Number(data.kills) || 0;

    if (!name) {
      return errorResponse('Nome inválido');
    }

    const sheet = getOrCreateSheet();

    // Limpar scores antigos se ultrapassar o máximo
    const lastRow = sheet.getLastRow();
    if (lastRow > MAX_SCORES) {
      // Manter os 100 melhores + cabeçalho
      const allData = sheet.getDataRange().getValues();
      const sorted = allData.slice(1)
        .filter(row => row[0])
        .sort((a, b) => (b[1] || 0) - (a[1] || 0))
        .slice(0, 100);
      sheet.clear();
      sheet.getRange(1, 1, 1, 5).setValues([['Nome', 'Score', 'Round', 'Kills', 'Data']]);
      if (sorted.length > 0) {
        sheet.getRange(2, 1, sorted.length, 5).setValues(sorted);
      }
    }

    const date = new Date().toLocaleString('pt-PT');
    sheet.appendRow([name, score, round, kills, date]);

    // Ordenar por score
    sortSheetByScore(sheet);

    return ContentService
      .createTextOutput(JSON.stringify({ success: true, name, score }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return errorResponse('Erro: ' + err.toString());
  }
}

function errorResponse(msg) {
  return ContentService
    .createTextOutput(JSON.stringify({ success: false, error: msg }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.getRange(1, 1, 1, 5).setValues([['Nome', 'Score', 'Round', 'Kills', 'Data']]);
    sheet.setFrozenRows(1);
    // Estilo do cabeçalho
    sheet.getRange(1, 1, 1, 5)
      .setFontWeight('bold')
      .setBackground('#333333')
      .setFontColor('#ffffff');
  }
  return sheet;
}

function sortSheetByScore(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;
  const range = sheet.getRange(2, 1, lastRow - 1, 5);
  range.sort({ column: 2, ascending: false });
}
