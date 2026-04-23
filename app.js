function init() {
  migrateLegacyStorage();
  appState.profile = loadProfile();
  appState.routeEntries = loadRouteEntries();
  initFirebase();
  bindEvents();
  resetRouteForm();
  applyTheme(getCurrentTheme());
  renderApp();
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
    if (event.key === 'Escape' && ui.settingsModal.classList.contains('open')) closeSettingsModal();
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

  ui.routeBoard.addEventListener('change', event => {
    const checkbox = event.target.closest('input[data-action="toggle-done"]');
    if (!checkbox) return;
    updateEntryStatus(checkbox.dataset.entryId, checkbox.checked ? 'rotpunkt' : 'open');
  });

  ui.routeBoard.addEventListener('click', event => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
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
      if (!window.confirm('Diese Zusatzroute wirklich löschen?')) return;
      appState.routeEntries = appState.routeEntries.filter(entry => entry.id !== entryId);
      persistAll();
      renderApp();
    }
  });

  ui.routeLogForm.addEventListener('submit', onRouteFormSubmit);
  ui.routeLogForm.addEventListener('reset', () => requestAnimationFrame(resetRouteForm));

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

function updateEntryStatus(entryId, selection) {
  const progressState = getComputedState().progressState;
  const targetEntry = appState.routeEntries.find(entry => entry.id === entryId);
  if (!targetEntry) return;

  if (isEntryLocked(targetEntry, progressState)) {
    renderApp();
    return;
  }

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
  renderApp();
}

function changeAttempts(entryId, delta) {
  const today = getTodayValue();
  appState.routeEntries = appState.routeEntries.map(entry => {
    if (entry.id !== entryId) return entry;
    const log = [...(entry.attemptLog || [])];
    const idx = log.findIndex(s => s.date === today);
    if (idx === -1) {
      if (delta > 0) log.push({ date: today, count: delta });
    } else {
      const next = Math.max(0, log[idx].count + delta);
      if (next === 0) log.splice(idx, 1);
      else log[idx] = { date: today, count: next };
    }
    return { ...entry, attemptLog: log, updatedAt: Date.now() };
  });
  persistRoutes();
  renderApp();
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

function resetRouteForm() {
  ui.routeLogForm.reset();
  document.getElementById('route-date').value = getTodayValue();
  document.getElementById('route-status').value = 'open';
  clearFeedback();
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

  const response = window.prompt('Zum Bestätigen bitte RESET eingeben.');
  if (response !== 'RESET') return;

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
}

init();
