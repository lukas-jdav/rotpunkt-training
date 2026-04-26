function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(dateString) {
  if (!dateString) return 'Ohne Datum';
  const parsedDate = new Date(dateString + 'T00:00:00');
  if (Number.isNaN(parsedDate.getTime())) return dateString;
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' }).format(parsedDate);
}

function getTodayValue() {
  const now = new Date();
  const timezoneOffset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += character;
  }

  values.push(current);
  return values;
}

function extractHallDate(value) {
  const match = String(value || '').match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '';
}

function normalizeHallGrade(value) {
  const match = String(value || '').match(/\d+/);
  return match ? match[0] : '';
}

const _UIAA_TO_FRENCH = {
  '3': '3', '4-': '3+', '4': '4a', '4+': '4c',
  '5-': '5a', '5': '5b', '5+': '5c',
  '6-': '6a', '6': '6b', '6+': '6c',
  '7-': '7a', '7': '7b', '7+': '7c',
  '8-': '8a', '8': '8b', '8+': '8c',
  '9-': '9a', '9': '9b', '9+': '9c',
  '10-': '9c+', '10': '9c+'
};

function toFrenchGrade(uiaa) {
  const key = String(uiaa || '').trim();
  if (key.includes('/')) {
    const parts = key.split('/');
    const f = parts.map(p => _UIAA_TO_FRENCH[p.trim()]).filter(Boolean);
    return f.length ? f.join('/') : null;
  }
  return _UIAA_TO_FRENCH[key] || null;
}

function normalizeColor(value) {
  const color = String(value || '').trim();
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color) ? color.toLowerCase() : '';
}

const _COLOR_NAMES = {
  '#000000': 'schwarz',
  '#0000ff': 'blau',
  '#008000': 'grün',
  '#32cd32': 'hellgrün',
  '#3cb03c': 'grün',
  '#808080': 'grau',
  '#9400d3': 'lila',
  '#cfab8f': 'beige',
  '#ff0000': 'rot',
  '#ff69b4': 'pink',
  '#ffa500': 'orange',
  '#ffd700': 'gelb',
  '#ffff00': 'gelb',
  '#ffffff': 'weiß'
};

function colorName(hex) {
  return _COLOR_NAMES[String(hex || '').toLowerCase()] || null;
}

function createEntryId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
  return String(Date.now()) + Math.random().toString(16).slice(2);
}

function openRouteLink(url) {
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isMobile) {
    // On mobile, window.location triggers iOS Universal Links & Android App Links,
    // so the OS opens the Vertical-Life app if installed, otherwise falls back to browser.
    window.location.href = url;
  } else {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noreferrer noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}
