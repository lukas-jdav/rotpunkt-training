let _dragSrcCol = null;

function init() {
  migrateLegacyStorage();
  appState.profile = loadProfile();
  appState.routeEntries = loadRouteEntries();
  initGradeFilter();
  initFirebase();
  bindEvents();
  resetRouteForm();
  applyTheme(getCurrentTheme());
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
    if (cb) {
      const col = cb.dataset.col;
      const prefs = appState.profile.tablePrefs;
      if (cb.checked) {
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

  ui.statsPanel.addEventListener('click', event => {
    const btn = event.target.closest('button[data-ascent-action]');
    if (!btn) return;
    const action = btn.dataset.ascentAction;
    const value = btn.dataset.value;
    if (action === 'grade-all') {
      _ascentFilters.grades.clear();
    } else if (action === 'grade-toggle') {
      if (_ascentFilters.grades.has(value)) _ascentFilters.grades.delete(value);
      else _ascentFilters.grades.add(value);
    } else if (action === 'type-all') {
      _ascentFilters.ascentTypes.clear();
    } else if (action === 'type-toggle') {
      if (_ascentFilters.ascentTypes.has(value)) _ascentFilters.ascentTypes.delete(value);
      else _ascentFilters.ascentTypes.add(value);
    } else {
      return;
    }
    renderStats();
  });

  ui.statsPanel.addEventListener('change', event => {
    const dateSel = event.target.closest('select[data-ascent-action="date-range"]');
    if (dateSel) {
      _ascentFilters.dateRange = dateSel.value;
      renderStats();
      return;
    }
    const openCb = event.target.closest('input[data-ascent-action="toggle-open"]');
    if (openCb) {
      _ascentFilters.showOpenInCurrent = openCb.checked;
      renderStats();
    }
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

  ui.settingsCloudSave.addEventListener('click', async () => {
    if (!appState.currentUser) return;
    await writeCloudSnapshot().catch(console.error);
    showToast('In Konto gespeichert ✓');
  });

  ui.settingsResetProgress.addEventListener('click', resetProgressSafely);
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
