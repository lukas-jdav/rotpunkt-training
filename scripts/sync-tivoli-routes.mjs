import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_URL = 'https://www.8a.nu/gyms/badminton-kletterhalle-tivoli/topos/sportclimbing';
const SOURCE_FILE_PREFIX = 'Tivoli Sports Klettern-routes-current-';
const CSV_HEADERS = [
  'location',
  'difficulty',
  'color_1',
  'color_2',
  'name',
  'notes',
  'set_at',
  'link',
  'routesetter',
  'area',
  'sector'
];
const collator = new Intl.Collator('de', { numeric: true, sensitivity: 'base' });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const jsDataPath = path.join(repoRoot, 'tivoli-routes-data.js');

main().catch(error => {
  console.error('[sync-tivoli-routes] Fehler:', error.message);
  process.exitCode = 1;
});

async function main() {
  const sourceHtml = await fetchSourceHtml();
  const routes = extractRoutesFromNuxtData(sourceHtml)
    .filter(route => route && route.archived_at == null)
    .map(normalizeRoute)
    .filter(Boolean)
    .sort(compareRoutes);

  const currentState = await readCurrentState();
  const existingByKey = new Map(currentState.rows.map(row => [buildRouteKey(row), row]));
  const existingByLooseKey = new Map(currentState.rows.map(row => [buildLooseRouteKey(row), row]));
  const nextByLooseKey = new Map(routes.map(route => [buildLooseRouteKey(route), route]));
  const updated = [];

  const mergedRoutes = routes.map(route => {
    const exactKey = buildRouteKey(route);
    const looseKey = buildLooseRouteKey(route);
    const existing = existingByKey.get(exactKey) || existingByLooseKey.get(looseKey);
    if (!existing) return route;

    const merged = {
      ...route,
      link: existing.link || route.link,
      routesetter: route.routesetter || existing.routesetter || 'N/A ',
      area: existing.area || route.area,
      sector: existing.sector || route.sector
    };

    if (hasMeaningfulChanges(existing, merged)) {
      updated.push({
        before: existing,
        after: merged
      });
    }

    return merged;
  });

  const added = mergedRoutes.filter(route => !existingByLooseKey.has(buildLooseRouteKey(route)));
  const removed = currentState.rows.filter(route => !nextByLooseKey.has(buildLooseRouteKey(route)));

  const csvBody = buildCsv([
    ['Tivoli Sports Klettern - export by 8a.nu sync'],
    CSV_HEADERS,
    ...mergedRoutes.map(route => CSV_HEADERS.map(header => route[header] ?? ''))
  ]);
  const jsBody = `window.TIVOLI_ROUTE_CSV = String.raw\`${escapeForRawTemplate(csvBody)}\`;\n`;

  const jsChanged = normalizeNewlines(currentState.jsSource) !== normalizeNewlines(jsBody);
  const todayStamp = formatDateStamp(new Date());
  const csvSnapshotPath = path.join(repoRoot, `${SOURCE_FILE_PREFIX}${todayStamp}.csv`);

  if (jsChanged) {
    await mkdir(path.dirname(csvSnapshotPath), { recursive: true });
    await writeFile(jsDataPath, jsBody, 'utf8');
    await writeFile(csvSnapshotPath, csvBody + '\n', 'utf8');
  }

  printSummary({
    totalRoutes: mergedRoutes.length,
    added,
    updated,
    removed,
    updatedFiles: jsChanged ? [path.basename(jsDataPath), path.basename(csvSnapshotPath)] : []
  });
}

async function fetchSourceHtml() {
  const response = await fetch(SOURCE_URL, {
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'
    }
  });

  if (!response.ok) {
    throw new Error(`Quelle konnte nicht geladen werden (${response.status} ${response.statusText})`);
  }

  return response.text();
}

function extractRoutesFromNuxtData(html) {
  const match = html.match(/<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) {
    throw new Error('Nuxt-Datenblock __NUXT_DATA__ nicht gefunden');
  }

  const payload = JSON.parse(match[1]);
  const root = decodeNuxtPayload(payload, 0);
  const routes = root?.pinia?.gymZlaggables?.routes;
  if (!Array.isArray(routes)) {
    throw new Error('Route-Liste in pinia.gymZlaggables.routes nicht gefunden');
  }

  return routes;
}

function decodeNuxtPayload(payload, rootIndex) {
  const cache = new Map();

  function decodeByIndex(index) {
    if (cache.has(index)) return cache.get(index);

    const raw = payload[index];
    const placeholder = Array.isArray(raw) ? [] : (raw && typeof raw === 'object' ? {} : raw);
    cache.set(index, placeholder);
    const decoded = decodeInto(placeholder, raw);
    cache.set(index, decoded);
    return decoded;
  }

  function decodeValue(raw) {
    if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 && raw < payload.length) {
      return decodeByIndex(raw);
    }
    if (raw === null || typeof raw === 'string' || typeof raw === 'boolean') return raw;
    if (Array.isArray(raw)) {
      const tag = raw[0];
      if (tag === 'Reactive' || tag === 'ShallowReactive' || tag === 'Ref') {
        return decodeValue(raw[1]);
      }
      if (tag === 'EmptyRef') return null;
      if (tag === 'Date') return raw[1] ? new Date(raw[1]).toISOString() : null;
      if (tag === 'Set') return raw.slice(1).map(decodeValue);
      if (tag === 'Map') {
        const entries = [];
        for (let index = 1; index < raw.length; index += 2) {
          entries.push([decodeValue(raw[index]), decodeValue(raw[index + 1])]);
        }
        return Object.fromEntries(entries);
      }
      return raw.map(item => decodeValue(item));
    }
    if (typeof raw === 'object') {
      const out = {};
      for (const [key, value] of Object.entries(raw)) {
        out[key] = decodeValue(value);
      }
      return out;
    }
    return raw;
  }

  function decodeInto(placeholder, raw) {
    if (raw === null || typeof raw === 'string' || typeof raw === 'boolean' || typeof raw === 'number') {
      return decodeValue(raw);
    }
    if (Array.isArray(raw)) {
      const tag = raw[0];
      if (tag === 'Reactive' || tag === 'ShallowReactive' || tag === 'Ref' || tag === 'EmptyRef' || tag === 'Date' || tag === 'Set' || tag === 'Map') {
        return decodeValue(raw);
      }
      placeholder.length = 0;
      for (const item of raw) placeholder.push(decodeValue(item));
      return placeholder;
    }
    for (const [key, value] of Object.entries(raw)) {
      placeholder[key] = decodeValue(value);
    }
    return placeholder;
  }

  return decodeByIndex(rootIndex);
}

function normalizeRoute(route) {
  const location = String(route.route_card_label || '').trim();
  const name = String(route.name || '').trim();
  const difficulty = String(route.difficulty || '').trim();
  if (!location || !name || !difficulty) return null;

  const { area, sector } = splitParentName(route.parent_name, route.sector_name);
  const routesetter = route.route_setter?.name ? String(route.route_setter.name).trim() : 'N/A ';
  const setAt = formatUtcStamp(route.set_at);
  const notes = String(route.notes || '').trim();

  return {
    location,
    difficulty,
    color_1: normalizeColor(route.color_1),
    color_2: normalizeColor(route.color_2),
    name,
    notes,
    set_at: setAt,
    link: `${SOURCE_URL}#route-${route.id}`,
    routesetter,
    area,
    sector
  };
}

function splitParentName(parentName, sectorName) {
  const parts = String(parentName || '')
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return {
      area: parts[0],
      sector: parts.slice(1).join(', ')
    };
  }

  const normalizedSector = String(sectorName || '').trim();
  if (parts.length === 1) {
    return {
      area: parts[0],
      sector: normalizedSector && normalizedSector !== parts[0] ? normalizedSector : ''
    };
  }

  return {
    area: normalizedSector,
    sector: ''
  };
}

async function readCurrentState() {
  const jsSource = await readFile(jsDataPath, 'utf8');
  const rawCsv = extractRawCsvFromJs(jsSource);
  const rows = parseCsv(rawCsv);
  return { jsSource, rows };
}

function extractRawCsvFromJs(source) {
  const match = source.match(/String\.raw`([\s\S]*)`;/);
  if (!match) {
    throw new Error('Bestehende CSV in tivoli-routes-data.js konnte nicht gelesen werden');
  }

  return match[1]
    .replace(/\\`/g, '`')
    .replace(/\$\{/g, '${');
}

function parseCsv(rawCsv) {
  const lines = normalizeNewlines(rawCsv)
    .split('\n')
    .map(line => line.trimEnd())
    .filter(Boolean);

  const headerIndex = lines.findIndex(line => line.startsWith('location,difficulty,'));
  if (headerIndex === -1) return [];

  const headers = parseCsvLine(lines[headerIndex]);
  return lines.slice(headerIndex + 1).map(line => {
    const values = parseCsvLine(line);
    return headers.reduce((row, header, index) => {
      row[header] = values[index] || '';
      return row;
    }, {});
  });
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      const nextCharacter = line[index + 1];
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

function buildCsv(rows) {
  return rows.map(columns => columns.map(escapeCsvValue).join(',')).join('\n');
}

function escapeCsvValue(value) {
  const stringValue = String(value ?? '');
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function buildRouteKey(route) {
  return [
    String(route.location || '').trim().toLowerCase(),
    String(route.name || '').trim().toLowerCase(),
    String(route.difficulty || '').trim().toLowerCase()
  ].join('||');
}

function buildLooseRouteKey(route) {
  return [
    String(route.location || '').trim().toLowerCase(),
    String(route.name || '').trim().toLowerCase()
  ].join('||');
}

function compareRoutes(left, right) {
  return collator.compare(String(left.location || ''), String(right.location || ''))
    || collator.compare(String(left.name || ''), String(right.name || ''));
}

function hasMeaningfulChanges(previous, next) {
  const fields = ['difficulty', 'color_1', 'color_2', 'notes', 'set_at', 'routesetter', 'area', 'sector'];
  return fields.some(field => String(previous[field] || '') !== String(next[field] || ''));
}

function normalizeColor(value) {
  const normalized = String(value || '').trim();
  return normalized ? normalized.toLowerCase() : '';
}

function formatUtcStamp(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
}

function formatDateStamp(date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0')
  ].join('-');
}

function escapeForRawTemplate(value) {
  return String(value).replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
}

function normalizeNewlines(value) {
  return String(value).replace(/\r\n/g, '\n');
}

function printSummary({ totalRoutes, added, updated, removed, updatedFiles }) {
  console.log(`[sync-tivoli-routes] Quelle: ${SOURCE_URL}`);
  console.log(`[sync-tivoli-routes] Aktive Routen: ${totalRoutes}`);
  console.log(`[sync-tivoli-routes] Neue Routen: ${added.length}`);
  if (added.length) {
    added.forEach(route => console.log(`  + ${route.location} ${route.name} (${route.difficulty})`));
  }
  console.log(`[sync-tivoli-routes] Aktualisierte Routen: ${updated.length}`);
  if (updated.length) {
    updated.forEach(({ before, after }) => {
      console.log(`  ~ ${after.location} ${after.name}: ${before.difficulty} -> ${after.difficulty}`);
    });
  }
  console.log(`[sync-tivoli-routes] Entfernte/archivierte Routen: ${removed.length}`);
  if (removed.length) {
    removed.forEach(route => console.log(`  - ${route.location} ${route.name} (${route.difficulty})`));
  }
  if (updatedFiles.length) {
    console.log(`[sync-tivoli-routes] Aktualisiert: ${updatedFiles.join(', ')}`);
  } else {
    console.log('[sync-tivoli-routes] Keine Dateiänderungen nötig.');
  }
}
