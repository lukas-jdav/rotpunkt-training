// ── Tivoli-Routenarchiv ───────────────────────────────────────────────────────
// Historische Hallenrouten bleiben erhalten, auch wenn sie aus der aktuellen
// 8a.nu-Liste verschwinden. Die Archivierung erfolgt anhand der stabilen
// Hallen-/8a-ID und nicht anhand der Wandposition (z. B. 28.1).

const ORIGINAL_LOAD_PROFILE = loadProfile;
const ORIGINAL_LOAD_ROUTE_ENTRIES = loadRouteEntries;
const ORIGINAL_PERSIST_PROFILE = persistProfile;

function normalizeRouteArchiveRecord(record) {
  if (!record || typeof record !== 'object') return null;
  const route = record.route && typeof record.route === 'object' ? record.route : record;
  const id = String(record.id || route.id || '').trim();
  const name = String(route.name || '').trim();
  if (!id || !name) return null;

  return {
    id,
    archivedAt: String(record.archivedAt || '').trim(),
    route: {
      id,
      createdAt: Number(route.createdAt) || 0,
      updatedAt: Number(route.updatedAt) || 0,
      setDate: String(route.setDate || '').trim(),
      grade: String(route.grade || '').trim(),
      rawDifficulty: String(route.rawDifficulty || '').trim(),
      routeCode: String(route.routeCode || '').trim(),
      name,
      location: String(route.location || '').trim(),
      notes: String(route.notes || '').trim(),
      routesetter: String(route.routesetter || '').trim(),
      link: String(route.link || '').trim(),
      webLink: String(route.webLink || '').trim(),
      mobileLink: String(route.mobileLink || '').trim(),
      primaryColor: String(route.primaryColor || '').trim(),
      secondaryColor: String(route.secondaryColor || '').trim(),
      source: route.source === 'hall' ? 'hall' : 'custom',
      status: route.status === 'done' ? 'done' : 'open',
      ascentType: String(route.ascentType || '').trim(),
      date: String(route.date || '').trim(),
      attemptLog: Array.isArray(route.attemptLog) ? route.attemptLog : [],
      cycleHistory: Array.isArray(route.cycleHistory) ? route.cycleHistory : []
    }
  };
}

function mergeRouteArchiveRecords(existing, additions) {
  const byId = new Map();
  [...(existing || []), ...(additions || [])].forEach(raw => {
    const record = normalizeRouteArchiveRecord(raw);
    if (!record) return;
    const previous = byId.get(record.id);
    byId.set(record.id, previous ? {
      ...record,
      archivedAt: previous.archivedAt || record.archivedAt,
      route: {
        ...previous.route,
        ...record.route,
        attemptLog: record.route.attemptLog.length ? record.route.attemptLog : previous.route.attemptLog,
        cycleHistory: record.route.cycleHistory.length ? record.route.cycleHistory : previous.route.cycleHistory
      }
    } : record);
  });
  return [...byId.values()];
}

function loadProfile() {
  const profile = ORIGINAL_LOAD_PROFILE();
  try {
    const raw = localStorage.getItem(APP_CONFIG.storageKeys.profile);
    const parsed = raw ? JSON.parse(raw) : {};
    profile.routeArchive = mergeRouteArchiveRecords([], parsed.routeArchive);
  } catch (error) {
    profile.routeArchive = [];
  }
  return profile;
}

function loadRouteEntries() {
  let storedEntries = [];
  try {
    const raw = localStorage.getItem(APP_CONFIG.storageKeys.routes);
    const parsed = raw ? JSON.parse(raw) : [];
    storedEntries = Array.isArray(parsed) ? parsed.map(normalizeEntry).filter(Boolean) : [];
  } catch (error) {}

  const currentEntries = ORIGINAL_LOAD_ROUTE_ENTRIES();
  const currentHallIds = new Set(
    HALL_ROUTE_ENTRIES.map(entry => String(entry.id || '').trim()).filter(Boolean)
  );

  const removed = storedEntries.filter(entry =>
    entry.source === 'hall' && entry.id && !currentHallIds.has(String(entry.id))
  );

  if (removed.length) {
    const additions = removed.map(entry => ({
      id: entry.id,
      archivedAt: new Date().toISOString(),
      route: serializeEntry(entry)
    }));
    appState.profile.routeArchive = mergeRouteArchiveRecords(
      appState.profile.routeArchive,
      additions
    );
    ORIGINAL_PERSIST_PROFILE(false);
  }

  return currentEntries;
}

function persistRoutes(allowCloud = true) {
  // Für Hallenrouten wird bewusst jede aktuelle Route persistiert. Nur so kann
  // der nächste Start erkennen, welche Route zwischenzeitlich entfernt wurde.
  const persistedEntries = appState.routeEntries
    .filter(entry => entry.source === 'hall' || shouldPersistEntry(entry))
    .map(serializeEntry);

  localStorage.setItem(APP_CONFIG.storageKeys.routes, JSON.stringify(persistedEntries));
  if (allowCloud) writeCloudSnapshot().catch(() => {});
}

function getRouteArchive() {
  return mergeRouteArchiveRecords([], appState.profile.routeArchive);
}

function getArchivedTivoliRoutes() {
  return getRouteArchive().filter(record => record.route.source === 'hall');
}
