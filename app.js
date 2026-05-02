let routeSyncPollHandle = null;
let _dragSrcCol = null;

function init() {
  migrateLegacyStorage();
  appState.profile = loadProfile();
  appState.githubSync = {
    ...appState.githubSync,
    ...loadGithubSyncSettings()
  };
  appState.routeSync = {
    ...appState.routeSync,
    ...loadRouteNotificationSettings(),
    permission: getBrowserNotificationPermission()
  };
  appState.routeEntries = loadRouteEntries();
  initGradeFilter();
  initFirebase();
  bindEvents();
  resetRouteForm();
  applyTheme(getCurrentTheme());
  handleRouteSyncSummary(window.TIVOLI_ROUTE_SYNC || null, { requiresReload: false, source: 'initial' });
  startRouteSyncPolling();
  renderApp();
}

function initGradeFilter() {
  const { progressState } = getComputedState();
  const grades = [];
  if (progressState.current) grades.push(progressState.current.grade);
  if (progressState.canStartNext && progressState.next) grades.push(progressState.next.grade);
  appState.filters.grades = grades;
}

function bindEvents() {
  ui.tabs.forEach(button => {
    button.addEventListener('click', () => switchTab(button.dataset.tabTarget));
  });

  ui.themeToggle.addEventListener('click', () => {
    const nextTheme = getCurrentTheme() === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
    saveTheme(nextTheme);
    renderSettingsModal();
  });

  ui.settingsToggle.addEventListener('click', openSettingsModal);
  ui.settingsClose.addEventListener('click', closeSettingsModal);
  ui.settingsModal.addEventListener('click', event => {
    if (event.target === ui.settingsModal) closeSettingsModal();
  });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (ui.confirmModal.classList.contains('open')) {
      ui.confirmCancel.click();
    } else if (ui.settingsModal.classList.contains('open')) {
      closeSettingsModal();
    }
  });

  ui.authUi.addEventListener('click', async event => {
    const button = event.target.closest('[data-auth-action]');
    if (!button) return;
    if (button.dataset.authAction === 'signin') await signInWithGoogle();
    if (button.dataset.authAction === 'signout') signOut();
  });

  ui.routeSearch.addEventListener('input', event => {
    appState.filters.search = event.target.value.trim().toLowerCase();
    renderRouteBoard(getComputedState().progressState);
  });

  ui.routeStatusFilter.addEventListener('change', event => {
    appState.filters.status = event.target.value;
    renderRouteBoard(getComputedState().progressState);
  });

  ui.routeGradeChips.addEventListener('click', event => {
    const button = event.target.closest('[data-grade-filter]');
    if (!button) return;
    const value = button.dataset.gradeFilter;
    toggleGradeFilter(value);
    const computed = getComputedState();
    renderRouteBoard(computed.progressState);
    renderGradeFilterChips(computed.summaries);
  });

  ui.filterPresets.addEventListener('click', event => {
    const button = event.target.closest('[data-preset]');
    if (!button) return;
    applyFilterPreset(button.dataset.preset);
  });

  ui.routeBoard.addEventListener('blur', event => {
    const textarea = event.target.closest('textarea[data-action="save-note"]');
    if (!textarea) return;
    saveAttemptNote(textarea.dataset.entryId, textarea.value);
  }, true);

  ui.routeBoard.addEventListener('change', event => {
    const checkbox = event.target.closest('input[data-action="toggle-done"]');
    if (!checkbox) return;
    updateEntryStatus(checkbox.dataset.entryId, checkbox.checked ? 'rotpunkt' : 'open');
  });

  ui.routeBoard.addEventListener('click', event => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    if (button.dataset.action === 'toggle-col-panel') {
      appState._colPanelOpen = !appState._colPanelOpen;
      renderRouteBoard(getComputedState().progressState);
      return;
    }

    if (button.dataset.action === 'sort-column') {
      const col = button.dataset.col;
      const prefs = appState.profile.tablePrefs;
      if (prefs.sortBy === col) {
        if (prefs.sortDir === 'asc') prefs.sortDir = 'desc';
        else { prefs.sortBy = null; prefs.sortDir = 'asc'; }
      } else {
        prefs.sortBy = col;
        prefs.sortDir = 'asc';
      }
      persistProfile();
      renderRouteBoard(getComputedState().progressState);
      return;
    }

    const entryId = button.dataset.entryId;
    if (!entryId) return;

    if (button.dataset.action === 'set-status') {
      updateEntryStatus(entryId, button.dataset.status);
      return;
    }

    if (button.dataset.action === 'change-attempts') {
      changeAttempts(entryId, Number(button.dataset.delta));
      return;
    }

    if (button.dataset.action === 'delete-entry') {
      showConfirmDialog('Route löschen', 'Diese Zusatzroute wirklich löschen? Das kann nicht rückgängig gemacht werden.', 'Löschen').then(confirmed => {
        if (!confirmed) return;
        appState.routeEntries = appState.routeEntries.filter(entry => entry.id !== entryId);
        persistAll();
        renderApp();
        showToast('Route gelöscht');
      });
      return;
    }
  });

  ui.routeBoard.addEventListener('change', event => {
    const cb = event.target.closest('input[data-action="toggle-column"]');
    if (!cb) return;
    const col = cb.dataset.col;
    const prefs = appState.profile.tablePrefs;
    if (cb.checked) {
      prefs.hiddenColumns = prefs.hiddenColumns.filter(k => k !== col);
    } else {
      if (!prefs.hiddenColumns.includes(col)) prefs.hiddenColumns.push(col);
    }
    persistProfile();
    renderRouteBoard(getComputedState().progressState);
  });

  ui.routeBoard.addEventListener('dragstart', event => {
    const th = event.target.closest('th[data-col]');
    if (!th) return;
    _dragSrcCol = th.dataset.col;
    th.classList.add('col-dragging');
    event.dataTransfer.effectAllowed = 'move';
  });

  ui.routeBoard.addEventListener('dragover', event => {
    const th = event.target.closest('th[data-col]');
    if (!th || th.dataset.col === _dragSrcCol) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    th.classList.add('col-drag-over');
  });

  ui.routeBoard.addEventListener('dragleave', event => {
    const th = event.target.closest('th[data-col]');
    if (th) th.classList.remove('col-drag-over');
  });

  ui.routeBoard.addEventListener('dragend', event => {
    event.target.closest('th[data-col]')?.classList.remove('col-dragging');
    ui.routeBoard.querySelectorAll('.col-drag-over').forEach(el => el.classList.remove('col-drag-over'));
  });

  ui.routeBoard.addEventListener('drop', event => {
    const th = event.target.closest('th[data-col]');
    if (!th || !_dragSrcCol || th.dataset.col === _dragSrcCol) return;
    event.preventDefault();
    th.classList.remove('col-drag-over');

    const prefs = appState.profile.tablePrefs;
    const order = [...prefs.columnOrder];
    const fromIdx = order.indexOf(_dragSrcCol);
    const toIdx = order.indexOf(th.dataset.col);
    if (fromIdx === -1 || toIdx === -1) return;

    order.splice(fromIdx, 1);
    order.splice(toIdx, 0, _dragSrcCol);
    prefs.columnOrder = order;
    _dragSrcCol = null;

    persistProfile();
    renderRouteBoard(getComputedState().progressState);
  });

  document.addEventListener('click', event => {
    if (!appState._colPanelOpen) return;
    if (event.target.closest('[data-action="toggle-col-panel"]')) return;
    if (event.target.closest('.col-mgr-panel')) return;
    appState._colPanelOpen = false;
    renderRouteBoard(getComputedState().progressState);
  });

  ui.routeLogForm.addEventListener('submit', onRouteFormSubmit);
  ui.routeLogForm.addEventListener('reset', () => requestAnimationFrame(resetRouteForm));
  ui.routeLogForm.addEventListener('input', updateRouteSubmitState);
  ui.routeLogForm.addEventListener('change', updateRouteSubmitState);

  ui.settingsColWidths.addEventListener('change', event => {
    const toggle = event.target.closest('input[data-col-toggle]');
    if (toggle) {
      const col = toggle.dataset.colToggle;
      const prefs = appState.profile.tablePrefs;
      if (toggle.checked) {
        prefs.hiddenColumns = prefs.hiddenColumns.filter(k => k !== col);
      } else {
        if (!prefs.hiddenColumns.includes(col)) prefs.hiddenColumns.push(col);
      }
      persistProfile();
      renderRouteBoard(getComputedState().progressState);
      return;
    }
    const widthInput = event.target.closest('input[data-col-width]');
    if (widthInput) {
      const col = widthInput.dataset.colWidth;
      const val = parseInt(widthInput.value, 10);
      if (!appState.profile.tablePrefs.columnWidths) appState.profile.tablePrefs.columnWidths = {};
      if (val >= 40 && val <= 800) {
        appState.profile.tablePrefs.columnWidths[col] = val;
      } else {
        delete appState.profile.tablePrefs.columnWidths[col];
      }
      persistProfile();
      renderRouteBoard(getComputedState().progressState);
    }
  });

  ui.settingsStartGrade.addEventListener('change', event => {
    appState.profile.startGrade = event.target.value;
    persistProfile();
    renderApp();
  });

  ui.settingsVorstiegOnly.addEventListener('change', event => {
    appState.profile.vorstiegOnly = event.target.checked;
    persistProfile();
    renderApp();
  });

  ui.settingsTheme.addEventListener('change', event => {
    applyTheme(event.target.value);
    saveTheme(event.target.value);
    renderSettingsModal();
  });

  ui.settingsGithubSave.addEventListener('click', saveGithubSyncToken);
  ui.settingsGithubClear.addEventListener('click', clearGithubSyncToken);
  ui.settingsGithubTrigger.addEventListener('click', triggerGithubRouteSync);
  ui.settingsGithubOpen.addEventListener('click', openGithubWorkflowPage);
  ui.settingsRouteSyncEnable.addEventListener('click', enableBrowserNotifications);
  ui.settingsRouteSyncCheck.addEventListener('click', () => checkForRouteSyncUpdates({ manual: true }));

  ui.routeSyncNotice.addEventListener('click', event => {
    const button = event.target.closest('button[data-route-sync-action]');
    if (!button) return;

    if (button.dataset.routeSyncAction === 'dismiss') {
      markRouteSyncSummarySeen();
      renderApp();
      return;
    }

    if (button.dataset.routeSyncAction === 'reload') {
      window.location.reload();
      return;
    }

    if (button.dataset.routeSyncAction === 'enable-browser') {
      enableBrowserNotifications();
    }
  });

  ui.settingsResetProgress.addEventListener('click', resetProgressSafely);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkForRouteSyncUpdates();
    }
  });
}

function switchTab(tabId) {
  ui.tabs.forEach(button => {
    button.classList.toggle('active', button.dataset.tabTarget === tabId);
  });
  ui.panels.forEach(panel => {
    panel.classList.toggle('active', panel.id === 'tab-' + tabId);
  });
}

function openSettingsModal() {
  renderSettingsModal();
  ui.settingsModal.classList.add('open');
  ui.settingsModal.setAttribute('aria-hidden', 'false');
}

function closeSettingsModal() {
  ui.settingsModal.classList.remove('open');
  ui.settingsModal.setAttribute('aria-hidden', 'true');
}

function saveGithubSyncToken() {
  appState.githubSync.token = String(ui.settingsGithubToken.value || '').trim();
  persistGithubSyncSettings();
  appState.githubSync.status = appState.githubSync.token ? 'success' : 'idle';
  appState.githubSync.message = appState.githubSync.token
    ? 'Token saved in this browser'
    : 'Token cleared';
  renderSettingsModal();
}

function clearGithubSyncToken() {
  appState.githubSync.token = '';
  persistGithubSyncSettings();
  appState.githubSync.status = 'idle';
  appState.githubSync.message = 'Token cleared';
  renderSettingsModal();
}

async function triggerGithubRouteSync() {
  const token = String(ui.settingsGithubToken.value || appState.githubSync.token || '').trim();
  if (!token) {
    appState.githubSync.status = 'error';
    appState.githubSync.message = 'Please save a GitHub token first';
    renderSettingsModal();
    return;
  }

  appState.githubSync.token = token;
  persistGithubSyncSettings();
  appState.githubSync.status = 'running';
  appState.githubSync.message = 'Dispatching workflow …';
  renderSettingsModal();

  const { owner, repo, workflowId, ref } = APP_CONFIG.githubSync;

  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ref })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `HTTP ${response.status}`);
    }

    appState.githubSync.status = 'success';
    appState.githubSync.message = 'GitHub workflow started';
    renderSettingsModal();
  } catch (error) {
    appState.githubSync.status = 'error';
    appState.githubSync.message = 'Dispatch failed. Check token and permissions.';
    console.error('GitHub workflow dispatch failed:', error);
    renderSettingsModal();
  }
}

function openGithubWorkflowPage() {
  const { owner, repo, workflowId } = APP_CONFIG.githubSync;
  window.open(`https://github.com/${owner}/${repo}/actions/workflows/${workflowId}`, '_blank', 'noopener');
}

function getBrowserNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

function startRouteSyncPolling() {
  if (!canPollRouteSyncSummary()) return;
  if (routeSyncPollHandle) window.clearInterval(routeSyncPollHandle);
  routeSyncPollHandle = window.setInterval(() => {
    checkForRouteSyncUpdates();
  }, APP_CONFIG.routeNotifications.pollIntervalMs);
}

function canPollRouteSyncSummary() {
  return window.location.protocol === 'http:' || window.location.protocol === 'https:';
}

async function checkForRouteSyncUpdates({ manual = false } = {}) {
  if (!canPollRouteSyncSummary()) {
    if (manual) {
      appState.routeSync.status = 'error';
      appState.routeSync.message = 'Live update checks need the app to run over HTTP or HTTPS.';
      renderSettingsModal();
    }
    return;
  }

  appState.routeSync.status = 'checking';
  if (manual) appState.routeSync.message = 'Checking GitHub route updates …';
  renderSettingsModal();

  try {
    const response = await fetch(`${APP_CONFIG.routeNotifications.summaryJsonPath}?ts=${Date.now()}`, {
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const summary = await response.json();
    handleRouteSyncSummary(summary, {
      requiresReload: hasNewRouteSyncSummary(summary),
      source: manual ? 'manual' : 'poll'
    });

    appState.routeSync.status = 'idle';
    appState.routeSync.message = manual
      ? (hasPendingRouteSyncNotice() ? 'A newer route update is available.' : 'No newer route update found.')
      : '';
    renderApp();
  } catch (error) {
    appState.routeSync.status = 'error';
    appState.routeSync.message = manual
      ? 'Route update check failed.'
      : 'Background route update check failed.';
    console.error('Route sync check failed:', error);
    renderSettingsModal();
  }
}

function handleRouteSyncSummary(summary, { requiresReload = false, source = 'initial' } = {}) {
  if (!summary || typeof summary !== 'object') return;

  const previousChangeId = appState.routeSync.summary?.changeId || '';
  const nextChangeId = String(summary.changeId || '');
  const summaryChanged = nextChangeId && nextChangeId !== previousChangeId;

  appState.routeSync.summary = summary;
  appState.routeSync.requiresReload = Boolean(appState.routeSync.requiresReload || requiresReload);
  appState.routeSync.permission = getBrowserNotificationPermission();
  if (source === 'initial' && !appState.routeSync.message) {
    appState.routeSync.message = '';
  }

  if (summaryChanged || source === 'initial') {
    maybeTriggerRouteSyncNotification();
  }
}

function hasNewRouteSyncSummary(summary) {
  const currentId = String(appState.routeSync.summary?.changeId || '');
  const nextId = String(summary?.changeId || '');
  return Boolean(nextId && nextId !== currentId);
}

function hasPendingRouteSyncNotice() {
  const summary = appState.routeSync.summary;
  if (!summary || !summary.hasChanges || !summary.changeId) return false;
  return summary.changeId !== appState.routeSync.lastSeenChangeId;
}

function markRouteSyncSummarySeen() {
  const changeId = String(appState.routeSync.summary?.changeId || '');
  if (!changeId) return;
  appState.routeSync.lastSeenChangeId = changeId;
  appState.routeSync.requiresReload = false;
  persistRouteNotificationSettings();
}

async function enableBrowserNotifications() {
  if (!('Notification' in window)) {
    appState.routeSync.permission = 'unsupported';
    appState.routeSync.message = 'Browser notifications are not supported here.';
    renderSettingsModal();
    return;
  }

  try {
    const permission = await Notification.requestPermission();
    appState.routeSync.permission = permission;
    appState.routeSync.browserNotificationsEnabled = permission === 'granted';
    appState.routeSync.message = permission === 'granted'
      ? 'Browser notifications enabled.'
      : 'Browser notifications were not allowed.';
    persistRouteNotificationSettings();
    maybeTriggerRouteSyncNotification();
  } catch (error) {
    appState.routeSync.permission = getBrowserNotificationPermission();
    appState.routeSync.message = 'Could not enable browser notifications.';
    console.error('Notification permission request failed:', error);
  }

  renderSettingsModal();
}

function maybeTriggerRouteSyncNotification() {
  const summary = appState.routeSync.summary;
  if (!summary || !summary.hasChanges || !summary.changeId) return;
  if (!appState.routeSync.browserNotificationsEnabled || appState.routeSync.permission !== 'granted') return;
  if (appState.routeSync.lastBrowserNotificationId === summary.changeId) return;

  const counts = [];
  if (summary.summary?.added) counts.push(`${summary.summary.added} new`);
  if (summary.summary?.updated) counts.push(`${summary.summary.updated} updated`);
  if (summary.summary?.removed) counts.push(`${summary.summary.removed} archived`);

  try {
    const notification = new Notification('Tivoli routes changed', {
      body: counts.length ? counts.join(' · ') : 'New route changes are available.',
      tag: `route-sync-${summary.changeId}`
    });

    notification.onclick = () => {
      window.focus();
      window.location.reload();
    };

    appState.routeSync.lastBrowserNotificationId = summary.changeId;
    persistRouteNotificationSettings();
  } catch (error) {
    console.error('Browser notification failed:', error);
  }
}

function applyFilterPreset(preset) {
  appState.filters.search = '';
  ui.routeSearch.value = '';

  if (preset === 'focus') {
    const start = Number(appState.profile.startGrade);
    appState.filters.grades = [String(start), String(start + 1)].filter(g => !Number.isNaN(Number(g)));
    appState.filters.status = 'open';
    ui.routeStatusFilter.value = 'open';
  } else if (preset === 'projects') {
    appState.filters.grades = [];
    appState.filters.status = 'open';
    ui.routeStatusFilter.value = 'open';
  } else {
    appState.filters.grades = [];
    appState.filters.status = 'all';
    ui.routeStatusFilter.value = 'all';
  }

  const computed = getComputedState();
  renderRouteBoard(computed.progressState);
  renderGradeFilterChips(computed.summaries);
}

function updateEntryStatus(entryId, selection) {
  const progressState = getComputedState().progressState;
  const targetEntry = appState.routeEntries.find(entry => entry.id === entryId);
  if (!targetEntry) return;

  if (isEntryLocked(targetEntry, progressState)) return;

  const nextStatus = statusFromSelection(selection);
  appState.routeEntries = appState.routeEntries.map(entry => {
    if (entry.id !== entryId) return entry;
    return {
      ...entry,
      status: nextStatus.status,
      ascentType: nextStatus.ascentType,
      updatedAt: Date.now(),
      date: nextStatus.status === 'done'
        ? (entry.date || getTodayValue())
        : (entry.source === 'hall' ? '' : entry.date)
    };
  });

  persistRoutes();

  // Zeile visuell aktualisieren ohne die ganze Tabelle neu zu rendern
  const id = CSS.escape(entryId);
  document.querySelectorAll(`.status-btn[data-action="set-status"][data-entry-id="${id}"]`)
    .forEach(btn => btn.classList.toggle('active', btn.dataset.status === selection));
  const row = document.querySelector(`.status-btn[data-entry-id="${id}"]`)?.closest('tr');
  if (row) {
    row.classList.remove('route-row-open', 'route-row-toprope', 'route-row-flash', 'route-row-rotpunkt');
    row.classList.add('route-row-' + selection);
  }

  const toastMessages = {
    rotpunkt: 'Rotpunkt eingetragen ✓',
    flash: 'Flash eingetragen ✓',
    open: 'Status zurückgesetzt'
  };
  showToast(toastMessages[nextStatus.status] || 'Gespeichert ✓');
}

function saveAttemptNote(entryId, note) {
  const today = getTodayValue();
  const trimmed = note.trim();
  appState.routeEntries = appState.routeEntries.map(entry => {
    if (entry.id !== entryId) return entry;
    const log = entry.attemptLog.map(s => s.date === today ? { ...s, notes: trimmed } : s);
    return { ...entry, attemptLog: log, updatedAt: Date.now() };
  });
  persistRoutes();
}

function changeAttempts(entryId, delta) {
  const today = getTodayValue();
  let newTotal = 0;
  appState.routeEntries = appState.routeEntries.map(entry => {
    if (entry.id !== entryId) return entry;
    const log = [...(entry.attemptLog || [])];
    const idx = log.findIndex(s => s.date === today);
    if (idx === -1) {
      if (delta > 0) { log.push({ date: today, count: delta }); newTotal = delta; }
    } else {
      const next = Math.max(0, log[idx].count + delta);
      if (next === 0) log.splice(idx, 1);
      else log[idx] = { date: today, count: next };
      newTotal = next;
    }
    return { ...entry, attemptLog: log, updatedAt: Date.now() };
  });
  persistRoutes();
  renderApp();
  if (delta > 0) showToast(`Versuch ${newTotal} heute`);
}

function onRouteFormSubmit(event) {
  event.preventDefault();
  const formData = new FormData(ui.routeLogForm);
  const selection = String(formData.get('status') || 'open');
  const statusInfo = statusFromSelection(selection);

  const entry = normalizeEntry({
    id: createEntryId(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    date: String(formData.get('date') || ''),
    setDate: '',
    grade: String(formData.get('grade') || '').trim(),
    rawDifficulty: '',
    routeCode: '',
    name: String(formData.get('name') || '').trim(),
    location: String(formData.get('location') || '').trim(),
    notes: String(formData.get('notes') || '').trim(),
    link: '',
    primaryColor: '',
    secondaryColor: '',
    source: 'custom',
    status: statusInfo.status,
    ascentType: statusInfo.ascentType
  });

  if (!entry || !entry.date || !entry.grade || !entry.name) {
    showFeedback('Bitte fülle mindestens Datum, Grad und Routenname aus.', 'error');
    return;
  }

  if (appState.routeEntries.some(existingEntry => sameRoute(existingEntry, entry))) {
    showFeedback('Diese Route ist schon im Dashboard angelegt. Nutze unten die Abhak- und Statusfunktionen.', 'error');
    return;
  }

  appState.routeEntries.push(entry);
  persistRoutes();
  renderApp();
  showFeedback('Zusatzroute gespeichert.', 'success');
  ui.routeLogForm.reset();
  document.getElementById('route-date').value = getTodayValue();
  document.getElementById('route-status').value = selection;
  document.getElementById('route-name').focus();
}

function updateRouteSubmitState() {
  const date = document.getElementById('route-date').value.trim();
  const grade = document.getElementById('route-grade').value.trim();
  const name = document.getElementById('route-name').value.trim();
  ui.routeSubmit.disabled = !(date && grade && name);
}

function resetRouteForm() {
  // form.reset() darf hier nicht aufgerufen werden: es würde den reset-Event
  // erneut auslösen → requestAnimationFrame(resetRouteForm) → Endlosschleife.
  // Der native Reset des Browsers übernimmt das Leeren aller Felder;
  // resetRouteForm setzt nur die abweichenden Startwerte nach.
  document.getElementById('route-date').value = getTodayValue();
  document.getElementById('route-status').value = 'open';
  clearFeedback();
  updateRouteSubmitState();
}

function showFeedback(message, type) {
  ui.formFeedback.textContent = message;
  ui.formFeedback.className = 'form-feedback show ' + (type === 'error' ? 'feedback-error' : 'feedback-success');
}

function clearFeedback() {
  ui.formFeedback.textContent = '';
  ui.formFeedback.className = 'form-feedback';
}

function resetProgressSafely() {
  const trackedEntries = getTrackedEntries();
  if (!trackedEntries.length) return;

  showConfirmDialog(
    'Fortschritt zurücksetzen',
    `Wirklich alle ${trackedEntries.length} Einträge auf „offen" zurücksetzen? Das kann nicht rückgängig gemacht werden.`,
    'Zurücksetzen'
  ).then(confirmed => {
    if (!confirmed) return;
    appState.routeEntries = appState.routeEntries.map(entry => ({
      ...entry,
      status: 'open',
      ascentType: '',
      date: '',
      updatedAt: Date.now()
    }));
    persistRoutes();
    renderApp();
    closeSettingsModal();
    showToast('Fortschritt zurückgesetzt');
  });
}

init();
