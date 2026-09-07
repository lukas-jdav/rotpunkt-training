import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_URL = 'https://www.8a.nu/gyms/badminton-kletterhalle-tivoli/topos/sportclimbing';
const GYM_BASE = 'https://www.8a.nu/gyms/badminton-kletterhalle-tivoli';
const SNAPSHOT_DIR = path.join('data', 'snapshots');
const SOURCE_FILE_PREFIX = 'tivoli-routes-';
const SYNC_METADATA_JSON_PATH = path.join('data', 'latest-route-sync.json');
const SYNC_METADATA_JS_PATH = path.join('data', 'latest-route-sync.js');
const CSV_HEADERS = ['location', 'difficulty', 'color_1', 'color_2', 'name', 'notes', 'set_at', 'link', 'web_link', 'mobile_link', 'routesetter', 'area', 'sector'];
const MIN_ROUTE_COUNT = 50;
const collator = new Intl.Collator('de', { numeric: true, sensitivity: 'base' });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const jsDataPath = path.join(repoRoot, 'tivoli-routes-data.js');
const syncMetadataJsonPath = path.join(repoRoot, SYNC_METADATA_JSON_PATH);
const syncMetadataJsPath = path.join(repoRoot, SYNC_METADATA_JS_PATH);

main().catch(error => {
  console.error('[sync-tivoli-routes] Fehler:', error.message);
  process.exitCode = 1;
});

async function main() {
  const { html, sourceName } = await fetchSourceHtml();
  const extracted = extractRoutes(html);
  const routes = extracted.map(normalizeRoute).filter(Boolean).sort(compareRoutes);

  if (routes.length < MIN_ROUTE_COUNT) {
    throw new Error(`Nur ${routes.length} Routen erkannt. Mindestwert ${MIN_ROUTE_COUNT}; Abbruch zum Schutz vor unvollständigem Import.`);
  }

  const currentState = await readCurrentState();
  const existingByKey = new Map(currentState.rows.map(row => [buildRouteKey(row), row]));
  const existingByLooseKey = new Map(currentState.rows.map(row => [buildLooseRouteKey(row), row]));
  const nextByLooseKey = new Map(routes.map(route => [buildLooseRouteKey(route), route]));
  const updated = [];

  const mergedRoutes = routes.map(route => {
    const exactKey = buildRouteKey(route);
    const looseKey = buildLooseRouteKey(route);
    const existing = existingByKey.get(exactKey) || existingByLooseKey.get(looseKey);

    if (!existing) {
      if (!route.set_at) route.set_at = formatUtcStamp(new Date());
      return route;
    }

    const merged = {
      ...route,
      color_1: route.color_1 || existing.color_1 || '',
      color_2: route.color_2 || existing.color_2 || '',
      notes: route.notes || existing.notes || '',
      set_at: route.set_at || existing.set_at || '',
      link: route.link || existing.link || `${SOURCE_URL}`,
      web_link: route.web_link || existing.web_link || route.link || '',
      mobile_link: route.mobile_link || existing.mobile_link || (isVlLink(existing.link) ? existing.link : ''),
      routesetter: route.routesetter || existing.routesetter || 'N/A ',
      area: route.area || existing.area || '',
      sector: route.sector || existing.sector || ''
    };

    if (hasMeaningfulChanges(existing, merged)) updated.push({ before: existing, after: merged });
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
  const csvSnapshotPath = path.join(repoRoot, SNAPSHOT_DIR, `${SOURCE_FILE_PREFIX}${todayStamp}.csv`);
  const metadataState = await readCurrentSyncMetadata();
  const syncMetadata = buildSyncMetadata({ totalRoutes: mergedRoutes.length, added, updated, removed, sourceName });
  const syncMetadataJson = JSON.stringify(syncMetadata, null, 2) + '\n';
  const syncMetadataJs = `window.TIVOLI_ROUTE_SYNC = ${JSON.stringify(syncMetadata, null, 2)};\n`;
  const metadataChanged = normalizeNewlines(metadataState.jsonSource) !== normalizeNewlines(syncMetadataJson)
    || normalizeNewlines(metadataState.jsSource) !== normalizeNewlines(syncMetadataJs);

  if (jsChanged) {
    await mkdir(path.dirname(csvSnapshotPath), { recursive: true });
    await writeFile(jsDataPath, jsBody, 'utf8');
    await writeFile(csvSnapshotPath, csvBody + '\n', 'utf8');
  }

  if (metadataChanged) {
    await mkdir(path.dirname(syncMetadataJsonPath), { recursive: true });
    await writeFile(syncMetadataJsonPath, syncMetadataJson, 'utf8');
    await writeFile(syncMetadataJsPath, syncMetadataJs, 'utf8');
  }

  printSummary({ totalRoutes: mergedRoutes.length, added, updated, removed, updatedFiles: [
    ...(jsChanged ? [path.basename(jsDataPath), path.basename(csvSnapshotPath)] : []),
    ...(metadataChanged ? [path.basename(syncMetadataJsonPath), path.basename(syncMetadataJsPath)] : [])
  ], sourceName });
}

async function fetchSourceHtml() {
  const encoded = encodeURIComponent(SOURCE_URL);
  const sources = [
    { url: SOURCE_URL, name: '8a.nu', headers: { accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' } },
    { url: `https://r.jina.ai/${SOURCE_URL}`, name: 'Jina Reader', headers: { accept: 'text/html,*/*;q=0.8', 'x-return-format': 'html' } },
    { url: `https://api.allorigins.win/raw?url=${encoded}`, name: 'AllOrigins proxy', headers: { accept: 'text/html,*/*;q=0.8' } },
    { url: `https://corsproxy.io/?url=${encoded}`, name: 'Corsproxy', headers: { accept: 'text/html,*/*;q=0.8' } },
    { url: `https://api.codetabs.com/v1/proxy?quest=${encoded}`, name: 'CodeTabs proxy', headers: { accept: 'text/html,*/*;q=0.8' } }
  ];

  const failures = [];
  for (const source of sources) {
    try {
      const response = await fetch(source.url, {
        headers: { ...source.headers, 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/136.0 Safari/537.36' },
        redirect: 'follow'
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const html = await response.text();
      if (!html.trim()) throw new Error('Leere Antwort');

      const probe = extractRoutes(html);
      if (!probe.length || probe.length < MIN_ROUTE_COUNT) {
        throw new Error(`Antwort enthält nur ${probe.length} erkannte Routen`);
      }

      console.log(`[sync-tivoli-routes] Datenquelle: ${source.name} (${probe.length} Routen erkannt)`);
      return { html, sourceName: source.name };
    } catch (error) {
      failures.push(`${source.name}: ${error.message}`);
    }
  }

  throw new Error(`Keine verlässliche Routendatenquelle erreichbar. ${failures.join(' | ')}`);
}

function extractRoutes(html) {
  const nuxtRoutes = extractRoutesFromNuxtData(html);
  if (nuxtRoutes.length >= MIN_ROUTE_COUNT) return nuxtRoutes;

  const tableRoutes = extractRoutesFromRenderedTables(html);
  if (tableRoutes.length >= MIN_ROUTE_COUNT) return tableRoutes;

  return [];
}

function extractRoutesFromNuxtData(html) {
  const match = html.match(/<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return [];

  try {
    const payload = JSON.parse(match[1]);
    const root = decodeNuxtPayload(payload, 0);
    const routes = root?.pinia?.gymZlaggables?.routes;
    return Array.isArray(routes) ? routes : [];
  } catch (error) {
    console.warn(`[sync-tivoli-routes] __NUXT_DATA__ konnte nicht gelesen werden: ${error.message}`);
    return [];
  }
}

function extractRoutesFromRenderedTables(html) {
  const rows = [];
  for (const match of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const rowHtml = match[1];
    const cells = [...rowHtml.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map(cell => cleanHtmlText(cell[1]))
      .filter(Boolean);
    if (cells.length < 2) continue;

    const location = cells.find(cell => /^\d+(?:\.\d+)?$/.test(cell));
    if (!location) continue;

    const difficulty = cells.find(cell => /^(?:[1-9]|10)(?:[+-])?$/.test(cell));
    if (!difficulty) continue;

    const nameCandidates = cells.filter(cell => cell !== location && cell !== difficulty && !isLikelyColumnLabel(cell));
    const name = nameCandidates.sort((a, b) => b.length - a.length)[0] || '';
    if (!name || name.length < 2) continue;

    const idMatch = rowHtml.match(/(?:sportclimbing|zlaggables)[^"']*\/(\d+)(?:["'/?#])/i);
    const id = idMatch ? idMatch[1] : '';

    const hrefMatch = rowHtml.match(/href=["']([^"']*(?:zlaggables|route)[^"']*)["']/i);
    const link = hrefMatch?.[1] ? new URL(hrefMatch[1], SOURCE_URL).href : (id ? `${SOURCE_URL}#route-${id}` : SOURCE_URL);

    rows.push({
      route_card_label: location,
      difficulty,
      name,
      notes: '',
      set_at: '',
      link,
      id,
      web_link: id ? buildWebRouteLink({ id }) : link,
      virtual_gym_route_link: '',
      route_setter: null,
      parent_name: '',
      sector_name: '',
      color_1: '',
      color_2: ''
    });
  }

  const unique = new Map(rows.map(route => [buildLooseRawKey(route), route]));
  return [...unique.values()];
}

function cleanHtmlText(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function isLikelyColumnLabel(value) {
  return /^(name|route|grade|difficulty|ascents|stars|recommended|sector|location)$/i.test(value.trim());
}

function buildLooseRawKey(route) {
  return [route.route_card_label, route.name].map(value => String(value || '').trim().toLowerCase()).join('|');
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
    if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 && raw < payload.length) return decodeByIndex(raw);
    if (raw === null || typeof raw === 'string' || typeof raw === 'boolean') return raw;
    if (Array.isArray(raw)) {
      const tag = raw[0];
      if (tag === 'Reactive' || tag === 'ShallowReactive' || tag === 'Ref') return decodeValue(raw[1]);
      if (tag === 'EmptyRef') return null;
      if (tag === 'Date') return raw[1] ? new Date(raw[1]).toISOString() : null;
      if (tag === 'Set') return raw.slice(1).map(decodeValue);
      if (tag === 'Map') {
        const entries = [];
        for (let index = 1; index < raw.length; index += 2) entries.push([decodeValue(raw[index]), decodeValue(raw[index + 1])]);
        return Object.fromEntries(entries);
      }
      return raw.map(item => decodeValue(item));
    }
    if (typeof raw === 'object') {
      const out = {};
      for (const [key, value] of Object.entries(raw)) out[key] = decodeValue(value);
      return out;
    }
    return raw;
  }

  function decodeInto(placeholder, raw) {
    if (raw === null || typeof raw === 'string' || typeof raw === 'boolean' || typeof raw === 'number') return decodeValue(raw);
    if (Array.isArray(raw)) {
      const tag = raw[0];
      if (tag === 'Reactive' || tag === 'ShallowReactive' || tag === 'Ref' || tag === 'EmptyRef' || tag === 'Date' || tag === 'Set' || tag === 'Map') return decodeValue(raw);
      placeholder.length = 0;
      for (const item of raw) placeholder.push(decodeValue(item));
      return placeholder;
    }
    for (const [key, value] of Object.entries(raw)) placeholder[key] = decodeValue(value);
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
  const webLink = route.web_link || (route.id ? buildWebRouteLink(route) : '');
  const mobileLink = extractVlLink(route);
  const link = mobileLink || route.link || `${SOURCE_URL}#route-${route.id || ''}`;

  return {
    location,
    difficulty,
    color_1: normalizeColor(route.color_1),
    color_2: normalizeColor(route.color_2),
    name,
    notes,
    set_at: setAt,
    link,
    web_link: webLink || link,
    mobile_link: mobileLink,
    routesetter,
    area,
    sector
  };
}

function splitParentName(parentName, sectorName) {
  const parts = String(parentName || '').split(',').map(part => part.trim()).filter(Boolean);
  if (parts.length >= 2) return { area: parts[0], sector: parts.slice(1).join(', ') };
  const normalizedSector = String(sectorName || '').trim();
  if (parts.length === 1) return { area: parts[0], sector: normalizedSector && normalizedSector !== parts[0] ? normalizedSector : '' };
  return { area: normalizedSector, sector: '' };
}

function extractVlLink(route) {
  const vl = route.virtual_gym_route_link || route.vl_link || route.share_url || route.short_url || route.climb_link;
  return vl && typeof vl === 'string' && vl.startsWith('http') ? vl : '';
}

function isVlLink(url) {
  return typeof url === 'string' && url.includes('vertical-life.info');
}

function buildWebRouteLink(route) {
  return `${GYM_BASE}/zlaggables/sportclimbing/${route.id}/ascents`;
}

async function readCurrentState() {
  const jsSource = await readFile(jsDataPath, 'utf8');
  return { jsSource, rows: parseCsv(extractRawCsvFromJs(jsSource)) };
}

async function readCurrentSyncMetadata() {
  const [jsonSource, jsSource] = await Promise.all([readOptionalFile(syncMetadataJsonPath), readOptionalFile(syncMetadataJsPath)]);
  return { jsonSource, jsSource };
}

function extractRawCsvFromJs(source) {
  const match = source.match(/String\.raw`([\s\S]*)`;/);
  if (!match) throw new Error('Bestehende CSV in tivoli-routes-data.js konnte nicht gelesen werden');
  return match[1].replace(/\\`/g, '`').replace(/\$\{/g, '${');
}

function parseCsv(rawCsv) {
  const lines = normalizeNewlines(rawCsv).split('\n').map(line => line.trimEnd()).filter(Boolean);
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

function buildSyncMetadata({ totalRoutes, added, updated, removed, sourceName }) {
  const generatedAt = new Date().toISOString();
  const hasChanges = added.length > 0 || updated.length > 0 || removed.length > 0;
  return {
    generatedAt,
    sourceUrl: SOURCE_URL,
    sourceName,
    totalRoutes,
    hasChanges,
    changeId: hasChanges ? createChangeId(generatedAt, { added, updated, removed }) : '',
    summary: { added: added.length, updated: updated.length, removed: removed.length },
    changes: {
      added: added.map(toRoutePreview),
      updated: updated.map(({ before, after }) => ({ before: toRoutePreview(before), after: toRoutePreview(after) })),
      removed: removed.map(toRoutePreview)
    }
  };
}

function toRoutePreview(route) {
  return {
    location: route.location || '',
    difficulty: route.difficulty || '',
    name: route.name || '',
    set_at: route.set_at || '',
    routesetter: route.routesetter || '',
    area: route.area || '',
    sector: route.sector || ''
  };
}

function createChangeId(generatedAt, { added, updated, removed }) {
  const source = JSON.stringify({ generatedAt, added, updated, removed });
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0).toString(16);
}

function buildRouteKey(route) {
  return [route.location, route.difficulty, route.name].map(value => String(value || '').trim().toLowerCase()).join('|');
}

function buildLooseRouteKey(route) {
  return [route.location, route.name].map(value => String(value || '').trim().toLowerCase()).join('|');
}

function hasMeaningfulChanges(existing, next) {
  return ['location', 'difficulty', 'color_1', 'color_2', 'name', 'notes', 'set_at', 'link', 'web_link', 'mobile_link', 'routesetter', 'area', 'sector']
    .some(field => String(existing[field] || '') !== String(next[field] || ''));
}

function compareRoutes(left, right) {
  const locationDiff = collator.compare(left.location || '', right.location || '');
  return locationDiff !== 0 ? locationDiff : collator.compare(left.name || '', right.name || '');
}

function formatUtcStamp(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString().replace('T', ' ').replace(/\.000Z$/, ' UTC');
}

function formatDateStamp(date) {
  return date.toISOString().slice(0, 10);
}

function escapeCsvValue(value) {
  const stringValue = String(value ?? '');
  if (/[",\n\r]/.test(stringValue)) return `"${stringValue.replace(/"/g, '""')}"`;
  return stringValue;
}

function escapeForRawTemplate(value) {
  return String(value).replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
}

function normalizeNewlines(value) {
  return String(value || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

async function readOptionalFile(filePath) {
  try {
    return await readFile(filePath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return '';
    throw error;
  }
}

function printSummary({ totalRoutes, added, updated, removed, updatedFiles, sourceName }) {
  console.log(`[sync-tivoli-routes] Datenquelle: ${sourceName}`);
  console.log(`[sync-tivoli-routes] ${totalRoutes} Routen verarbeitet.`);
  console.log(`[sync-tivoli-routes] Neu: ${added.length} | Geändert: ${updated.length} | Entfernt: ${removed.length}`);
  if (updatedFiles.length) console.log(`[sync-tivoli-routes] Dateien aktualisiert: ${updatedFiles.join(', ')}`);
  else console.log('[sync-tivoli-routes] Keine Routendatenänderung.');
}

function normalizeColor(value) {
  const stringValue = String(value ?? '').trim();
  if (!stringValue) return '';
  if (stringValue.startsWith('#')) return stringValue;
  const named = {
    red: '#ff0000', blue: '#0000ff', green: '#008000', yellow: '#ffff00', orange: '#ffa500',
    pink: '#ff69b4', white: '#ffffff', black: '#000000', grey: '#808080', gray: '#808080', purple: '#9400d3'
  };
  return named[stringValue.toLowerCase()] || stringValue;
}
