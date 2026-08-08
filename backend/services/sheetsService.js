const path = require('path');
const fs = require('fs');

let google = null;
try {
  google = require('googleapis').google;
} catch (e) {
  console.warn('⚠️ googleapis package warning:', e.message);
}

const KEYFILE_PATH = path.join(__dirname, '../google-credentials.json');
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

let auth = null;
let sheets = null;

if (google && fs.existsSync(KEYFILE_PATH)) {
  try {
    auth = new google.auth.GoogleAuth({
      keyFile: KEYFILE_PATH,
      scopes: SCOPES,
    });
    sheets = google.sheets({ version: 'v4', auth });
  } catch (e) {
    console.warn('⚠️ Google Sheets Auth file error:', e.message);
  }
}

async function appendRowToSheet(spreadsheetId, range, values) {
  if (!sheets || !spreadsheetId) return null;
  try {
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [values],
      },
    });
    return response.data;
  } catch (error) {
    console.error('❌ Google Sheets API Warning:', error.message);
    return null;
  }
}

async function readSheetValues(spreadsheetId, range) {
  if (!sheets || !spreadsheetId) return [];
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });
    return response.data.values || [];
  } catch (error) {
    console.error('❌ Google Sheets API Warning:', error.message);
    return [];
  }
}

module.exports = {
  appendRowToSheet,
  readSheetValues,
};
