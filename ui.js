// ── Theme ─────────────────────────────────────────────────────────────────────

function getCurrentTheme() {
  const attrTheme = document.documentElement.getAttribute('data-theme');
  return attrTheme === 'dark' ? 'dark' : 'light';
}

function applyTheme(theme) {
  const nextTheme = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', nextTheme);
  updateThemeButton();
}

function saveTheme(theme) {
  localStorage.setItem(APP_CONFIG.storageKeys.theme, theme);
}

function updateThemeButton() {
  const isDark = getCurrentTheme() === 'dark';
  ui.themeToggle.innerHTML = `
    <span class="theme-switch-icon">${isDark ? SUN_ICON : MOON_ICON}</span>
    <span class="theme-switch-label">${isDark ? 'Hell' : 'Dunkel'}</span>
  `;
  ui.themeToggle.title = isDark ? 'Zum hellen Modus wechseln' : 'Zum dunklen Modus wechseln';
}

// ── Auth UI ───────────────────────────────────────────────────────────────────

function renderAuthUI() {
  if (!appState.currentUser) {
    ui.authUi.innerHTML = `
      <button class="auth-signin-btn" type="button" data-auth-action="signin">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Mit Google anmelden
      </button>
    `;
    renderSettingsModal();
    return;
  }

  const initial = (appState.currentUser.displayName || appState.currentUser.email || '?')[0].toUpperCase();
  const avatar = appState.currentUser.photoURL
    ? `<img src="${escapeHtml(appState.currentUser.photoURL)}" alt="">`
    : escapeHtml(initial);

  ui.authUi.innerHTML = `
    <div class="auth-user">
      <span class="auth-sync ${appState.syncStatus === 'error' ? 'error' : ''}">${escapeHtml(getSyncStatusText())}</span>
      <div class="auth-avatar">${avatar}</div>
      <span class="auth-name">${escapeHtml(appState.currentUser.displayName || appState.currentUser.email || '')}</span>
      <button class="auth-signout-btn" type="button" data-auth-action="signout">Abmelden</button>
    </div>
  `;

  renderSettingsModal();
}

function getSyncStatusText() {
  if (appState.syncStatus === 'syncing') return 'Wird gespeichert …';
  if (appState.syncStatus === 'synced') return 'Mit Cloud synchronisiert';
  if (appState.syncStatus === 'error') return 'Sync-Fehler';
  return 'Nur lokal gespeichert';
}

// ── Settings Modal ────────────────────────────────────────────────────────────

function renderSettingsModal() {
  ui.settingsStartGrade.value = appState.profile.startGrade;
  ui.settingsVorstiegOnly.checked = appState.profile.vorstiegOnly;
  ui.settingsTheme.value = getCurrentTheme();
  ui.settingsLoginStatus.textContent = appState.currentUser
    ? (appState.currentUser.displayName || appState.currentUser.email || 'Angemeldet')
    : 'Nicht angemeldet';
  ui.settingsSyncStatus.textContent = getSyncStatusText();
  ui.settingsStorageStatus.textContent = getTrackedEntryCount() + ' Routen im aktiven Speicher';
  ui.settingsGithubToken.value = appState.githubSync.token;
  ui.settingsGithubStatus.textContent = getGithubSyncStatusText();
  ui.settingsGithubTrigger.disabled = !appState.githubSync.token || appState.githubSync.status === 'running';
}

function getGithubSyncStatusText() {
  if (appState.githubSync.status === 'running') return 'Workflow wird ausgelöst …';
  if (appState.githubSync.status === 'success') return appState.githubSync.message || 'Workflow gestartet';
  if (appState.githubSync.status === 'error') return appState.githubSync.message || 'GitHub-Aufruf fehlgeschlagen';
  return appState.githubSync.message || 'Noch nicht eingerichtet';
}

// ── Metrics (Status-Tab) ──────────────────────────────────────────────────────

function renderMetrics(computed) {
  const { trackedEntries, progressState } = computed;

  const completedRoutes = trackedEntries.filter(entry => entry.status === 'done').length;
  const openRoutes = trackedEntries.length - completedRoutes;
  const progressPercent = trackedEntries.length ? Math.round((completedRoutes / trackedEntries.length) * 100) : 0;

  ui.focusGradeValue.textContent = progressState.focusText;
  ui.focusGradeNote.textContent = progressState.focusNote;
  ui.metricOpenRoutes.textContent = String(openRoutes);
  ui.metricDoneRoutes.textContent = String(completedRoutes);
  ui.metricNextGrade.textContent = progressState.next ? progressState.next.grade : '–';
  ui.unlockMessage.textContent = progressState.unlockText;
  ui.unlockPill.textContent = progressState.canStartNext && progressState.next
    ? 'Grad ' + progressState.next.grade + ' bereits freigegeben'
    : (progressState.current ? 'Aktuell in Bearbeitung' : 'Alles erledigt');

  ui.overallProgressLabel.textContent = trackedEntries.length
    ? completedRoutes + ' von ' + trackedEntries.length + ' Routen abgeschlossen'
    : 'Noch keine Routen im Board';

  ui.overallProgressHint.textContent = progressState.progressHint;
  ui.overallProgressFill.style.width = progressPercent + '%';
  ui.roadmapMeta.textContent = appState.profile.vorstiegOnly
    ? 'Roadmap mit Vorstieg-Fokus. Optionale Linien werden separat markiert.'
    : 'Roadmap für die Grade 5 bis 8 mit aktuellem Fokus und den nächsten Schritten.';
}

// ── Roadmap ───────────────────────────────────────────────────────────────────

function renderRoadmap(summaries, progressState) {
  const summariesByGrade = new Map(summaries.map(summary => [summary.grade, summary]));

  ui.roadmapGrid.innerHTML = '';

  APP_CONFIG.roadmapGrades.forEach(grade => {
    const card = document.createElement('div');
    const state = getRoadmapState(grade, progressState, summaries);
    const summary = summariesByGrade.get(grade) || { total: 0, done: 0 };
    const completion = summary.total ? Math.round((summary.done / summary.total) * 100) : 0;

    card.className = 'roadmap-card ' + state;
    card.innerHTML = `
      <div class="roadmap-grade">${grade}</div>
      <div class="roadmap-state">${getRoadmapStateLabel(state)}</div>
      <div class="roadmap-bar"><span style="width:${completion}%"></span></div>
      <p>${summary.total ? `${summary.done} von ${summary.total} erledigt` : 'Noch keine Route im aktuellen Filterbereich'}</p>
    `;
    ui.roadmapGrid.appendChild(card);
  });
}

// ── Grade Filter Chips ────────────────────────────────────────────────────────

function renderGradeFilterChips(summaries) {
  const availableGrades = getAvailableGrades(summaries);
  sanitizeSelectedGrades(availableGrades);

  ui.routeGradeChips.innerHTML = '';

  const allButton = document.createElement('button');
  allButton.type = 'button';
  allButton.className = 'grade-filter-btn all' + (appState.filters.grades.length === 0 ? ' active' : '');
  allButton.dataset.gradeFilter = 'all';
  allButton.textContent = 'Alle';
  ui.routeGradeChips.appendChild(allButton);

  availableGrades.forEach(grade => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'grade-filter-btn' + (appState.filters.grades.includes(grade) ? ' active' : '');
    button.dataset.gradeFilter = grade;
    button.textContent = 'Grad ' + grade;
    ui.routeGradeChips.appendChild(button);
  });
}

// ── Route Board ───────────────────────────────────────────────────────────────

function isEntryLocked(entry, progressState) {
  if (!progressState.current) return false;
  return Number(entry.grade) > Number(progressState.current.grade)
    && !(progressState.canStartNext && progressState.next && Number(entry.grade) === Number(progressState.next.grade));
}

function renderRouteBoard(progressState) {
  const trackedEntries = getTrackedEntries();
  const allFiltered = getFilteredEntries();

  const useOptionalSplit = appState.profile.vorstiegOnly;
  const filteredEntries = useOptionalSplit
    ? allFiltered.filter(e => !isVorstiegOptional(e))
    : allFiltered;
  const optionalEntries = useOptionalSplit
    ? allFiltered.filter(e => isVorstiegOptional(e))
    : [];

  ui.routeBoard.innerHTML = '';

  if (!trackedEntries.length) {
    const empty = document.createElement('div');
    empty.className = 'tracker-empty';
    empty.textContent = 'Aktuell sind keine berücksichtigten Routen im Board.';
    ui.routeBoard.appendChild(empty);
    return;
  }

  if (!filteredEntries.length) {
    const empty = document.createElement('div');
    empty.className = 'tracker-empty';
    empty.textContent = 'Keine Route passt aktuell zu deinem Filter.';
    ui.routeBoard.appendChild(empty);
    return;
  }

  const shell = document.createElement('section');
  shell.className = 'route-table-shell';

  const tableHead = document.createElement('div');
  tableHead.className = 'route-table-head';

  const title = document.createElement('div');
  title.className = 'route-table-title';
  title.textContent = 'Direkte Trainingsliste';

  const meta = document.createElement('div');
  meta.className = 'route-table-meta';
  meta.textContent = filteredEntries.length + ' von ' + trackedEntries.length + ' Routen sichtbar';

  tableHead.appendChild(title);
  tableHead.appendChild(meta);
  shell.appendChild(tableHead);

  const tableWrap = document.createElement('div');
  tableWrap.className = 'route-table-wrap';

  const table = document.createElement('table');
  table.className = 'route-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Grad</th>
        <th>Aktionen</th>
        <th>Infos</th>
        <th>Route</th>
        <th>Bereich</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector('tbody');

  filteredEntries.forEach(entry => {
    const row = document.createElement('tr');
    row.className = 'route-row-' + selectionFromEntry(entry);
    appendEntryRow(row, entry, progressState);
    tbody.appendChild(row);
  });

  if (optionalEntries.length > 0) {
    const separator = document.createElement('tr');
    separator.className = 'route-section-separator';
    separator.innerHTML = '<td colspan="5" class="route-section-label">Optionale Routen · Seil 51–56</td>';
    tbody.appendChild(separator);

    optionalEntries.forEach(entry => {
      const row = document.createElement('tr');
      row.className = 'route-row-' + selectionFromEntry(entry);
      appendEntryRow(row, entry, progressState);
      tbody.appendChild(row);
    });
  }

  tableWrap.appendChild(table);
  shell.appendChild(tableWrap);
  ui.routeBoard.appendChild(shell);
}

function appendEntryRow(row, entry, progressState) {
  const locked = isEntryLocked(entry, progressState);
  const infoCellHtml = buildInfoCellHtml(entry);
  const totalAttempts = (entry.attemptLog || []).reduce((sum, s) => sum + s.count, 0);
  const todayAttempts = (entry.attemptLog || []).find(s => s.date === getTodayValue())?.count || 0;

  row.innerHTML = `
    <td><span class="route-grade-badge">${escapeHtml(entry.grade)}</span></td>
    <td></td>
    <td>${infoCellHtml}</td>
    <td>
      <div class="route-name-main">
        ${escapeHtml(entry.name)}
        ${appState.profile.vorstiegOnly && isVorstiegOptional(entry) ? '<span class="route-optional-badge">Optional</span>' : ''}
      </div>
      <div class="route-name-sub">${escapeHtml(getRouteDateLabel(entry))}</div>
      ${totalAttempts > 0 ? `<div class="route-attempt-info">${totalAttempts} ${totalAttempts === 1 ? 'Versuch' : 'Versuche'} gesamt${todayAttempts > 0 ? ' · heute ' + todayAttempts : ''}</div>` : ''}
      ${entry.notes ? `<div class="route-notes-text">${escapeHtml(entry.notes)}</div>` : ''}
    </td>
    <td><div class="route-location-text">${escapeHtml(entry.location || '—')}</div></td>
  `;

  const actionsCell = row.children[1];
  const actions = document.createElement('div');
  actions.className = 'route-status-actions';

  [
    { value: 'open', label: 'Offen' },
    { value: 'toprope', label: 'Toprope' },
    { value: 'flash', label: 'Flash' },
    { value: 'rotpunkt', label: 'Rotpunkt' }
  ].forEach(option => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'status-btn status-' + option.value + (selectionFromEntry(entry) === option.value ? ' active' : '');
    button.disabled = locked;
    button.dataset.action = 'set-status';
    button.dataset.entryId = entry.id;
    button.dataset.status = option.value;
    button.textContent = option.label;
    actions.appendChild(button);
  });

  if (entry.source === 'custom') {
    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'status-btn delete-btn';
    deleteButton.dataset.action = 'delete-entry';
    deleteButton.dataset.entryId = entry.id;
    deleteButton.textContent = 'Löschen';
    actions.appendChild(deleteButton);
  }

  const todayLabel = todayAttempts === 0 ? 'Heute: 0' : 'Heute: ' + todayAttempts;
  const counter = document.createElement('div');
  counter.className = 'attempt-counter';
  counter.innerHTML = `
    <button type="button" class="attempt-btn" data-action="change-attempts" data-entry-id="${escapeHtml(entry.id)}" data-delta="-1"${todayAttempts === 0 ? ' disabled' : ''}>−</button>
    <span class="attempt-count">${escapeHtml(todayLabel)}</span>
    <button type="button" class="attempt-btn" data-action="change-attempts" data-entry-id="${escapeHtml(entry.id)}" data-delta="1">+</button>
  `;
  actionsCell.appendChild(actions);
  actionsCell.appendChild(counter);
  if (locked) {
    const lockNote = document.createElement('div');
    lockNote.className = 'route-lock-note';
    lockNote.textContent = 'Gesperrt oberhalb des aktuellen Grades';
    actionsCell.appendChild(lockNote);
  }
}

function buildInfoCellHtml(entry) {
  const bits = [];

  if (isRouteNew(entry)) bits.push(`<span class="badge-new">Neu</span>`);
  if (entry.rawDifficulty) bits.push(`<span class="route-mini-badge">VL ${escapeHtml(entry.rawDifficulty)}</span>`);
  if (entry.routeCode) bits.push(`<span class="route-mini-badge">Linie ${escapeHtml(entry.routeCode)}</span>`);

  if (entry.primaryColor || entry.secondaryColor) {
    const colors = [entry.primaryColor, entry.secondaryColor]
      .filter(Boolean)
      .map(color => `<span class="route-color-dot" style="background-color:${escapeHtml(color)}"></span>`)
      .join('');
    bits.push(`<span class="route-colors">${colors}</span>`);
  }

  if (entry.link) {
    bits.push(`<a class="route-meta-link" href="${escapeHtml(entry.link)}" target="_blank" rel="noreferrer">Vertical-Life</a>`);
  }

  return `<div class="route-info-stack">${bits.join('')}</div>`;
}

// ── renderApp (Koordinator) ───────────────────────────────────────────────────

function renderApp() {
  const computed = getComputedState();
  renderMetrics(computed);
  renderRoadmap(computed.summaries, computed.progressState);
  renderGradeFilterChips(computed.summaries);
  renderRouteBoard(computed.progressState);
  renderStats();
  renderAuthUI();
  renderSettingsModal();
}
