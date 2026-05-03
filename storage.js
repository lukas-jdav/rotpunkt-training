function migrateLegacyStorage() {
  try {
    const metaRaw = localStorage.getItem(APP_CONFIG.storageKeys.meta);
    const meta = metaRaw ? JSON.parse(metaRaw) : null;
    if (meta && meta.version === APP_CONFIG.storageVersion) return;

    const legacyRoutesRaw = localStorage.getItem(APP_CONFIG.legacyKeys.routes);
    const legacyProfileRaw = localStorage.getItem(APP_CONFIG.legacyKeys.profile);

    if (legacyRoutesRaw && !localStorage.getItem(APP_CONFIG.storageKeys.routes)) {
      localStorage.setItem(APP_CONFIG.storageKeys.routes, legacyRoutesRaw);
    }
    if (legacyProfileRaw && !localStorage.getItem(APP_CONFIG.storageKeys.profile)) {
      localStorage.setItem(APP_CONFIG.storageKeys.profile, legacyProfileRaw);
    }

    localStorage.setItem(APP_CONFIG.storageKeys.meta, JSON.stringify({
      version: APP_CONFIG.storageVersion,
      migratedAt: new Date().toISOString()
    }));
  } catch (error) {
    console.warn('Storage migration failed:', error);
  }
}

function sanitizeTablePrefs(raw) {
  const def = APP_CONFIG.defaultProfile.tablePrefs;
  const validKeys = APP_CONFIG.tableColumns.map(c => c.key);
  const validSortKeys = [
    ...APP_CONFIG.tableColumns.filter(c => c.sortable).map(c => c.key),
    ...(APP_CONFIG.routeSortOptions || []).map(option => option.value)
  ];

  const columnOrder = Array.isArray(raw && raw.columnOrder)
    ? raw.columnOrder.filter(k => validKeys.includes(k))
    : def.columnOrder;
  const merged = [...columnOrder, ...def.columnOrder.filter(k => !columnOrder.includes(k))];

  const hiddenColumns = Array.isArray(raw && raw.hiddenColumns)
    ? raw.hiddenColumns.filter(k => validKeys.includes(k))
    : def.hiddenColumns;

  const sortBy = validSortKeys.includes(raw && raw.sortBy) ? raw.sortBy : def.sortBy;
  const sortDir = raw && raw.sortDir === 'desc' ? 'desc' : 'asc';

  const rawWidths = raw && typeof raw.columnWidths === 'object' && !Array.isArray(raw.columnWidths)
    ? raw.columnWidths
    : {};
  const columnWidths = Object.fromEntries(
    Object.entries(rawWidths).filter(([k, v]) => validKeys.includes(k) && typeof v === 'number' && v >= 40 && v <= 800)
  );
  const rawColumnGap = Number(raw && raw.columnGap);
  const columnGap = rawColumnGap >= 0 && rawColumnGap <= 40 ? rawColumnGap : def.columnGap;

  return { columnOrder: merged, hiddenColumns, sortBy, sortDir, columnWidths, columnGap };
}

function sanitizeProfile(profile) {
  const startGrade = APP_CONFIG.allowedStartGrades.includes(String(profile.startGrade))
    ? String(profile.startGrade)
    : APP_CONFIG.defaultProfile.startGrade;
  const redpointMaxGrade = APP_CONFIG.allowedRedpointMaxGrades.includes(String(profile.redpointMaxGrade))
    ? String(profile.redpointMaxGrade)
    : APP_CONFIG.defaultProfile.redpointMaxGrade;
  const currentCycle = Number.isInteger(profile.currentCycle) && profile.currentCycle >= 1
    ? profile.currentCycle
    : APP_CONFIG.defaultProfile.currentCycle;
  return {
    startGrade,
    redpointMaxGrade,
    vorstiegOnly: Boolean(profile.vorstiegOnly),
    currentCycle,
    ascentArchive: mergeAscentArchiveRecords(APP_CONFIG.defaultProfile.ascentArchive, profile.ascentArchive),
    tablePrefs: sanitizeTablePrefs(profile.tablePrefs)
  };
}

function loadProfile() {
  try {
    const raw = localStorage.getItem(APP_CONFIG.storageKeys.profile);
    if (!raw) return { ...APP_CONFIG.defaultProfile };
    return sanitizeProfile(JSON.parse(raw));
  } catch (error) {
    return { ...APP_CONFIG.defaultProfile };
  }
}

function loadRouteEntries() {
  try {
    const raw = localStorage.getItem(APP_CONFIG.storageKeys.routes);
    const parsed = raw ? JSON.parse(raw) : [];
    const storedEntries = Array.isArray(parsed) ? parsed.map(normalizeEntry).filter(Boolean) : [];
    return mergeRouteEntries(storedEntries);
  } catch (error) {
    return mergeRouteEntries([]);
  }
}

function persistProfile(allowCloud = true) {
  localStorage.setItem(APP_CONFIG.storageKeys.profile, JSON.stringify(appState.profile));
  if (allowCloud) writeCloudSnapshot().catch(() => {});
}

function persistRoutes(allowCloud = true) {
  const persistedEntries = appState.routeEntries.filter(shouldPersistEntry).map(serializeEntry);
  localStorage.setItem(APP_CONFIG.storageKeys.routes, JSON.stringify(persistedEntries));
  if (allowCloud) writeCloudSnapshot().catch(() => {});
}

function persistAll() {
  persistProfile(false);
  persistRoutes(false);
  writeCloudSnapshot().catch(() => {});
}

async function writeCloudSnapshot() {
  if (!FIREBASE_STATE.db || !appState.currentUser) {
    appState.syncStatus = 'local';
    renderSettingsModal();
    return;
  }

  const persistedEntries = appState.routeEntries.filter(shouldPersistEntry).map(serializeEntry);
  appState.syncStatus = 'syncing';
  renderSettingsModal();

  await FIREBASE_STATE.db
    .collection('users').doc(appState.currentUser.uid)
    .collection('data').doc('routes')
    .set({
      entries: persistedEntries,
      profile: appState.profile,
      storageVersion: APP_CONFIG.storageVersion,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

  appState.syncStatus = 'synced';
  renderSettingsModal();
}
