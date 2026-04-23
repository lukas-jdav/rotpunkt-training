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

function sanitizeProfile(profile) {
  const startGrade = APP_CONFIG.allowedStartGrades.includes(String(profile.startGrade))
    ? String(profile.startGrade)
    : APP_CONFIG.defaultProfile.startGrade;
  return {
    startGrade,
    vorstiegOnly: Boolean(profile.vorstiegOnly)
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

function loadGithubSyncSettings() {
  try {
    const raw = localStorage.getItem(APP_CONFIG.storageKeys.githubSync);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      token: typeof parsed.token === 'string' ? parsed.token : ''
    };
  } catch (error) {
    return { token: '' };
  }
}

function persistGithubSyncSettings() {
  localStorage.setItem(APP_CONFIG.storageKeys.githubSync, JSON.stringify({
    token: String(appState.githubSync.token || '')
  }));
}

function loadRouteNotificationSettings() {
  try {
    const raw = localStorage.getItem(APP_CONFIG.storageKeys.routeNotifications);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      browserNotificationsEnabled: Boolean(parsed.browserNotificationsEnabled),
      lastSeenChangeId: typeof parsed.lastSeenChangeId === 'string' ? parsed.lastSeenChangeId : '',
      lastBrowserNotificationId: typeof parsed.lastBrowserNotificationId === 'string' ? parsed.lastBrowserNotificationId : ''
    };
  } catch (error) {
    return {
      browserNotificationsEnabled: false,
      lastSeenChangeId: '',
      lastBrowserNotificationId: ''
    };
  }
}

function persistRouteNotificationSettings() {
  localStorage.setItem(APP_CONFIG.storageKeys.routeNotifications, JSON.stringify({
    browserNotificationsEnabled: Boolean(appState.routeSync.browserNotificationsEnabled),
    lastSeenChangeId: String(appState.routeSync.lastSeenChangeId || ''),
    lastBrowserNotificationId: String(appState.routeSync.lastBrowserNotificationId || '')
  }));
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
