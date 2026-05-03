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
  ui.settingsRedpointMaxGrade.value = appState.profile.redpointMaxGrade || APP_CONFIG.defaultProfile.redpointMaxGrade;
  ui.settingsVorstiegOnly.checked = appState.profile.vorstiegOnly;
  ui.settingsTheme.value = getCurrentTheme();
  ui.settingsLoginStatus.textContent = appState.currentUser
    ? (appState.currentUser.displayName || appState.currentUser.email || 'Angemeldet')
    : 'Nicht angemeldet';
  ui.settingsSyncStatus.textContent = getSyncStatusText();
  ui.settingsStorageStatus.textContent = getTrackedEntryCount() + ' Routen im aktiven Speicher';
  ui.settingsCloudSave.disabled = !appState.currentUser || appState.syncStatus === 'syncing';
  ui.settingsCycleLabel.textContent = String(appState.profile.currentCycle || 1);
  if (ui.settingsCycleArchive) {
    const cycleSummaries = getPastMesoCycleSummaries();
    ui.settingsCycleArchive.innerHTML = cycleSummaries.length
      ? `
        <div class="cycle-archive-title">Vergangene Mesozyklen</div>
        ${cycleSummaries.map(summary => `
          <div class="cycle-archive-row">
            <div>
              <strong>Mesozyklus ${escapeHtml(String(summary.cycle))}</strong>
              <span>${summary.ascents} Begehung${summary.ascents !== 1 ? 'en' : ''} · ${summary.routes} Route${summary.routes !== 1 ? 'n' : ''} · ${summary.attempts} Versuch${summary.attempts !== 1 ? 'e' : ''}</span>
            </div>
            <button type="button" class="danger-btn small-danger-btn" data-action="delete-cycle" data-cycle="${escapeHtml(String(summary.cycle))}">Löschen</button>
          </div>
        `).join('')}
      `
      : '<div class="cycle-archive-empty">Noch keine vergangenen Mesozyklen gespeichert.</div>';
  }
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
  const roadmapGrades = getRoadmapGrades();
  if (ui.roadmapTitle) {
    ui.roadmapTitle.textContent = 'Roadmap ' + roadmapGrades[0] + '–' + roadmapGrades[roadmapGrades.length - 1];
  }
  ui.roadmapMeta.textContent = appState.profile.vorstiegOnly
    ? 'Roadmap mit Vorstieg-Fokus. Optionale Linien werden separat markiert.'
    : 'Roadmap bis maximal einen Hauptgrad über deinem Rotpunkt-Maximum.';
}

// ── Roadmap ───────────────────────────────────────────────────────────────────

function renderRoadmap(summaries, progressState) {
  const summariesByGrade = new Map(summaries.map(summary => [summary.grade, summary]));

  ui.roadmapGrid.innerHTML = '';

  getRoadmapGrades().forEach(grade => {
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

function getActivePreset() {
  const { search, grades, status } = appState.filters;
  if (search) return null;
  const focusGrades = getFocusFilterGrades().sort();
  const currentGrades = [...grades].sort();
  if (focusGrades.length > 0 && status === 'open' && JSON.stringify(currentGrades) === JSON.stringify(focusGrades)) return 'focus';
  if (status === 'open' && grades.length === 0) return 'projects';
  if (status === 'all' && grades.length === 0) return 'all';
  return null;
}

function renderFilterPresets() {
  const active = getActivePreset();
  ui.filterPresets.querySelectorAll('[data-preset]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.preset === active);
  });
}

function renderGradeFilterChips(summaries) {
  const availableGrades = getAvailableGrades(summaries);
  sanitizeSelectedGrades(availableGrades);

  renderFilterPresets();

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

function getRouteLocationDisplay(entry) {
  if (!entry || !entry.location) return '';
  if (/Empore/i.test(entry.location)) return 'Empore';
  if (/Erdgeschoß/i.test(entry.location)) return 'Erdgeschoß';
  return '';
}

function getRouteSetMetaDisplay(entry) {
  if (!entry) return '';
  const routesetter = String(entry.routesetter || '').trim();
  const setDate = entry.setDate ? formatDate(entry.setDate) : '';
  if (routesetter && setDate) return `Set by: ${routesetter} on ${setDate}`;
  if (routesetter) return `Set by: ${routesetter}`;
  if (setDate) return `Set on ${setDate}`;
  return '';
}

function isEntryLocked(entry, progressState) {
  if (!progressState.current) return false;
  return Number(entry.grade) > Number(progressState.current.grade)
    && !(progressState.canStartNext && progressState.next && Number(entry.grade) === Number(progressState.next.grade));
}

function getActiveColumns() {
  const prefs = appState.profile.tablePrefs;
  const hidden = new Set(prefs.hiddenColumns);
  return prefs.columnOrder
    .filter(key => !hidden.has(key))
    .map(key => APP_CONFIG.tableColumns.find(c => c.key === key))
    .filter(Boolean);
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
  if (ui.routeFilterMeta) ui.routeFilterMeta.innerHTML = '';

  if (!trackedEntries.length) {
    const empty = document.createElement('div');
    empty.className = 'tracker-empty';
    empty.textContent = 'Aktuell sind keine berücksichtigten Routen im Board.';
    ui.routeBoard.appendChild(empty);
    return;
  }

  const activeColumns = getActiveColumns();
  const prefs = appState.profile.tablePrefs;

  const shell = document.createElement('section');
  shell.className = 'route-table-shell';

  const meta = document.createElement('div');
  meta.className = 'route-table-meta';
  meta.textContent = filteredEntries.length + ' von ' + trackedEntries.length + ' Routen sichtbar';

  const colMgrBtn = document.createElement('button');
  colMgrBtn.type = 'button';
  colMgrBtn.className = 'col-mgr-btn';
  colMgrBtn.dataset.action = 'toggle-col-panel';
  colMgrBtn.title = 'Spalten anpassen';
  colMgrBtn.textContent = '⚙';

  if (ui.routeFilterMeta) {
    ui.routeFilterMeta.innerHTML = '';
    ui.routeFilterMeta.appendChild(meta);
    ui.routeFilterMeta.appendChild(colMgrBtn);
  }

  const gradeRow = document.createElement('div');
  gradeRow.className = 'ascent-filter-row route-grade-row';

  const gradeLabel = document.createElement('div');
  gradeLabel.className = 'ascent-filter-label';
  gradeLabel.textContent = 'Grad';
  gradeRow.appendChild(gradeLabel);
  gradeRow.appendChild(ui.routeGradeChips);
  shell.appendChild(gradeRow);

  const sortRow = document.createElement('div');
  sortRow.className = 'ascent-filter-row route-sort-row';

  const sortLabel = document.createElement('div');
  sortLabel.className = 'ascent-filter-label';
  sortLabel.textContent = 'Sortierung';
  sortRow.appendChild(sortLabel);

  const sortChips = document.createElement('div');
  sortChips.className = 'ascent-filter-chips';
  const activeSortBy = prefs.sortBy || 'setDate';
  const activeSortDir = prefs.sortBy ? prefs.sortDir : 'asc';
  (APP_CONFIG.routeSortOptions || []).forEach(option => {
    const active = activeSortBy === option.value;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'filter-preset-btn' + (active ? ' active' : '');
    button.dataset.action = 'sort-column';
    button.dataset.col = option.value;
    button.textContent = option.label + (active ? (activeSortDir === 'asc' ? ' ↑' : ' ↓') : '');
    sortChips.appendChild(button);
  });
  sortRow.appendChild(sortChips);
  shell.appendChild(sortRow);

  if (!filteredEntries.length) {
    const empty = document.createElement('div');
    empty.className = 'tracker-empty';
    empty.textContent = 'Keine Route passt aktuell zu deinem Filter.';
    shell.appendChild(empty);
    ui.routeBoard.appendChild(shell);
    return;
  }

  // ── Column manager panel ──────────────────────────────────────────────────
  const colPanel = document.createElement('div');
  colPanel.className = 'col-mgr-panel' + (appState._colPanelOpen ? '' : ' hidden');

  const panelTitle = document.createElement('div');
  panelTitle.className = 'col-mgr-panel-title';
  panelTitle.textContent = 'Spalten anpassen';
  colPanel.appendChild(panelTitle);

  const gapRow = document.createElement('div');
  gapRow.className = 'col-settings-row';

  const gapLabel = document.createElement('label');
  gapLabel.className = 'col-settings-label';
  gapLabel.style.cssText = 'flex:1;min-width:0;';
  gapLabel.textContent = 'Spaltenabstand';
  gapLabel.setAttribute('for', 'route-column-gap');

  const gapInput = document.createElement('input');
  gapInput.id = 'route-column-gap';
  gapInput.type = 'number';
  gapInput.className = 'col-settings-input';
  gapInput.min = '0';
  gapInput.max = '40';
  gapInput.placeholder = 'auto';
  gapInput.value = prefs.columnGap === undefined ? '' : String(prefs.columnGap);
  gapInput.dataset.colGap = 'true';
  gapInput.setAttribute('aria-label', 'Spaltenabstand in Pixeln');

  const gapUnit = document.createElement('span');
  gapUnit.className = 'col-settings-unit';
  gapUnit.textContent = 'px';

  gapRow.appendChild(gapLabel);
  gapRow.appendChild(gapInput);
  gapRow.appendChild(gapUnit);
  colPanel.appendChild(gapRow);

  const colWidthsNow = prefs.columnWidths || {};
  APP_CONFIG.tableColumns.forEach(col => {
    const w = colWidthsNow[col.key] || '';
    const row = document.createElement('div');
    row.className = 'col-settings-row';

    const labelEl = document.createElement('label');
    labelEl.style.cssText = 'display:flex;align-items:center;gap:8px;flex:1;min-width:0;cursor:' + (col.hideable ? 'pointer' : 'default') + ';';

    if (col.hideable) {
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !prefs.hiddenColumns.includes(col.key);
      cb.style.cssText = 'accent-color:var(--dav-green);flex-shrink:0;';
      cb.dataset.action = 'toggle-column';
      cb.dataset.col = col.key;
      labelEl.appendChild(cb);
    } else {
      const spacer = document.createElement('span');
      spacer.style.cssText = 'width:16px;display:inline-block;flex-shrink:0;';
      labelEl.appendChild(spacer);
    }

    const labelText = document.createElement('span');
    labelText.className = 'col-settings-label';
    labelText.textContent = col.label;
    labelEl.appendChild(labelText);

    const widthInput = document.createElement('input');
    widthInput.type = 'number';
    widthInput.className = 'col-settings-input';
    widthInput.min = '40';
    widthInput.max = '800';
    widthInput.placeholder = 'auto';
    widthInput.value = String(w);
    widthInput.dataset.colWidth = col.key;
    widthInput.setAttribute('aria-label', col.label + ' Breite in Pixeln');

    const unit = document.createElement('span');
    unit.className = 'col-settings-unit';
    unit.textContent = 'px';

    row.appendChild(labelEl);
    row.appendChild(widthInput);
    row.appendChild(unit);
    colPanel.appendChild(row);
  });
  shell.appendChild(colPanel);

  // ── Table ─────────────────────────────────────────────────────────────────
  const tableWrap = document.createElement('div');
  tableWrap.className = 'route-table-wrap';

  const table = document.createElement('table');
  table.className = 'route-table';
  table.style.setProperty('--route-col-gap', (prefs.columnGap ?? APP_CONFIG.defaultProfile.tablePrefs.columnGap) + 'px');

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');

  const colWidths = prefs.columnWidths || {};
  activeColumns.forEach(col => {
    const th = document.createElement('th');
    th.dataset.col = col.key;
    th.draggable = true;
    if (colWidths[col.key]) th.style.width = colWidths[col.key] + 'px';

    const handle = document.createElement('span');
    handle.className = 'col-drag-handle';
    handle.textContent = '⠿';
    th.appendChild(handle);

    if (col.sortable) {
      const isActive = prefs.sortBy === col.key;
      const arrow = isActive ? (prefs.sortDir === 'desc' ? '↓' : '↑') : '↕';
      const sortBtn = document.createElement('button');
      sortBtn.type = 'button';
      sortBtn.className = 'col-sort-btn' + (isActive ? ' active' : '');
      sortBtn.dataset.action = 'sort-column';
      sortBtn.dataset.col = col.key;
      sortBtn.textContent = col.label + ' ' + arrow;
      th.appendChild(sortBtn);
    } else {
      th.appendChild(document.createTextNode(col.label));
    }

    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');

  filteredEntries.forEach(entry => {
    const row = document.createElement('tr');
    row.className = 'route-row-' + selectionFromEntry(entry);
    appendEntryRow(row, entry, progressState, activeColumns);
    tbody.appendChild(row);
  });

  if (optionalEntries.length > 0) {
    const separator = document.createElement('tr');
    separator.className = 'route-section-separator';
    separator.innerHTML = `<td colspan="${activeColumns.length}" class="route-section-label">Optionale Routen · Seil 51–56</td>`;
    tbody.appendChild(separator);

    optionalEntries.forEach(entry => {
      const row = document.createElement('tr');
      row.className = 'route-row-' + selectionFromEntry(entry);
      appendEntryRow(row, entry, progressState, activeColumns);
      tbody.appendChild(row);
    });
  }

  table.appendChild(tbody);
  tableWrap.appendChild(table);
  shell.appendChild(tableWrap);
  ui.routeBoard.appendChild(shell);

  requestAnimationFrame(() => {
    ui.routeBoard.querySelectorAll('th[data-col]').forEach(th => {
      const input = ui.routeBoard.querySelector('input[data-col-width="' + th.dataset.col + '"]');
      if (input && !input.value) input.placeholder = String(th.offsetWidth);
    });
  });
}

function appendEntryRow(row, entry, progressState, activeColumns) {
  const locked = isEntryLocked(entry, progressState);
  const totalAttempts = getTotalAttempts(entry);
  const todayAttempts = (entry.attemptLog || []).find(s => s.date === getTodayValue())?.count || 0;

  activeColumns.forEach(col => {
    const td = document.createElement('td');

    switch (col.key) {
      case 'grad': {
        const grFrench = entry.rawDifficulty ? toFrenchGrade(entry.rawDifficulty) : null;
        const grFrenchHtml = grFrench ? `<br><span class="grade-french">${escapeHtml(grFrench)}</span>` : '';
        td.className = 'col-grad';
        td.innerHTML = `<span class="route-grade-badge">${escapeHtml(entry.rawDifficulty || entry.grade)}${grFrenchHtml}</span>`;
        break;
      }

      case 'aktionen': {
        const wrapper = document.createElement('div');
        wrapper.className = 'aktionen-inner';

        const actions = document.createElement('div');
        actions.className = 'route-status-actions';
        const vorstiegEligible = isVorstiegMandatory(entry) || isVorstiegOptional(entry);
        const selection = selectionFromEntry(entry);
        const redpointDoneInPriorCycle = (entry.cycleHistory || [])
          .some(h => h.status === 'done' && h.ascentType !== 'toprope');
        const flashUnavailable = selection === 'rotpunkt' || redpointDoneInPriorCycle;
        const statusOptions = vorstiegEligible
          ? [
              { value: 'open',      label: 'Offen' },
              { value: 'toprope',   label: 'Toprope' },
              { value: 'flash',     label: 'Flash', disabled: flashUnavailable },
              { value: 'rotpunkt',  label: 'Rotpunkt' }
            ]
          : [
              { value: 'open',    label: 'Offen' },
              { value: 'toprope', label: 'Toprope' }
            ];
        statusOptions.forEach(option => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'status-btn status-' + option.value
            + (selection === option.value ? ' active' : '')
            + (option.disabled ? ' is-disabled-placeholder' : '');
          btn.disabled = locked || Boolean(option.disabled);
          btn.dataset.action = 'set-status';
          btn.dataset.entryId = entry.id;
          btn.dataset.status = option.value;
          btn.textContent = option.label;
          if (option.disabled) btn.title = 'Flash ist nach einer Rotpunkt-Begehung nicht mehr möglich';
          actions.appendChild(btn);
        });
        if (entry.source === 'custom') {
          const delBtn = document.createElement('button');
          delBtn.type = 'button';
          delBtn.className = 'status-btn delete-btn';
          delBtn.dataset.action = 'delete-entry';
          delBtn.dataset.entryId = entry.id;
          delBtn.textContent = 'Löschen';
          actions.appendChild(delBtn);
        }
        wrapper.appendChild(actions);

        const today = getTodayValue();
        const todayLog = (entry.attemptLog || []).find(s => s.date === today);
        const todayLabel = todayAttempts === 0 ? 'Heute: 0' : 'Heute: ' + todayAttempts;

        const attemptSection = document.createElement('div');
        attemptSection.className = 'attempt-section';

        const counter = document.createElement('div');
        counter.className = 'attempt-counter';
        counter.innerHTML = `
          <button type="button" class="attempt-btn" data-action="change-attempts" data-entry-id="${escapeHtml(entry.id)}" data-delta="-1"${todayAttempts === 0 ? ' disabled' : ''}>−</button>
          <span class="attempt-count">${escapeHtml(todayLabel)}</span>
          <button type="button" class="attempt-btn" data-action="change-attempts" data-entry-id="${escapeHtml(entry.id)}" data-delta="1">+</button>
        `;
        attemptSection.appendChild(counter);

        if (todayAttempts > 0) {
          const noteArea = document.createElement('textarea');
          noteArea.className = 'attempt-note-area';
          noteArea.placeholder = 'Notiz zur Session…';
          noteArea.rows = 2;
          noteArea.dataset.action = 'save-note';
          noteArea.dataset.entryId = entry.id;
          noteArea.value = todayLog?.notes || '';
          attemptSection.appendChild(noteArea);
        }

        const attemptSessions = (entry.attemptLog || []).filter(s => s.count > 0);
        if (attemptSessions.length > 0) {
          const hist = document.createElement('details');
          hist.className = 'attempt-history';
          const rows = attemptSessions
            .slice()
            .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
            .map(s => {
              const isToday = s.date === today;
              return `<div class="attempt-hist-row"><span class="attempt-hist-date">${escapeHtml(s.date ? formatDate(s.date) : '—')}</span><span class="attempt-hist-count">${s.count}×</span><span class="attempt-hist-tag">${isToday ? 'Heute' : ''}</span>${s.notes ? `<span class="attempt-hist-note">${escapeHtml(s.notes)}</span>` : ''}</div>`;
            })
            .join('');
          hist.innerHTML = `<summary class="attempt-hist-summary">Versuchstage anzeigen</summary>${rows}`;
          attemptSection.appendChild(hist);
        }

        wrapper.appendChild(attemptSection);

        const cycleHist = entry.cycleHistory || [];
        if (cycleHist.length > 0) {
          const lastH = cycleHist[cycleHist.length - 1];
          const cycleNote = document.createElement('div');
          cycleNote.className = 'route-cycle-note';
          let label;
          if (lastH.status === 'done') {
            const typeLabel = lastH.ascentType === 'toprope' ? 'Toprope'
              : lastH.ascentType === 'flash' ? 'Flash' : 'Rotpunkt';
            label = `Zyklus ${lastH.cycle}: ${typeLabel}`;
          } else {
            const n = (lastH.attempts || []).reduce((s, a) => s + a.count, 0);
            label = `Zyklus ${lastH.cycle}: versucht${n > 0 ? ' (' + n + '×)' : ''}`;
          }
          if (cycleHist.length > 1) label += ` · +${cycleHist.length - 1} weitere`;
          cycleNote.textContent = label;
          wrapper.appendChild(cycleNote);
        }

        if (locked) {
          const lockNote = document.createElement('div');
          lockNote.className = 'route-lock-note';
          lockNote.textContent = 'Gesperrt oberhalb des aktuellen Grades';
          wrapper.appendChild(lockNote);
        }
        td.appendChild(wrapper);
        break;
      }

      case 'infos':
        td.className = 'col-infos';
        td.innerHTML = buildInfoCellHtml(entry);
        break;

      case 'route': {
        const locationDisplay = getRouteLocationDisplay(entry);
        const setMetaDisplay = getRouteSetMetaDisplay(entry);
        td.innerHTML = `
          <div class="route-name-main">
            ${escapeHtml(entry.name)}
            ${isRouteNew(entry) ? '<span class="badge-new">Neu</span>' : ''}
            ${appState.profile.vorstiegOnly && isVorstiegOptional(entry) ? '<span class="route-optional-badge">Optional</span>' : ''}
          </div>
          ${locationDisplay ? `<div class="route-name-sub">${escapeHtml(locationDisplay)}</div>` : ''}
          ${setMetaDisplay ? `<div class="route-name-sub">${escapeHtml(setMetaDisplay)}</div>` : ''}
          ${entry.notes ? `<div class="route-name-sub">${escapeHtml(entry.notes)}</div>` : ''}
          ${totalAttempts > 0 ? `<div class="route-attempt-info">${totalAttempts} ${totalAttempts === 1 ? 'Versuch' : 'Versuche'} gesamt${todayAttempts > 0 ? ' · heute ' + todayAttempts : ''}</div>` : ''}
        `;
        break;
      }

      case 'bereich':
        td.innerHTML = `<div class="route-location-text">${escapeHtml(entry.location || '—')}</div>`;
        break;

    }

    row.appendChild(td);
  });
}

function buildInfoCellHtml(entry) {
  const badgeItems = [];

  if (entry.routeCode) {
    badgeItems.push(`<span class="route-mini-badge">Seil ${escapeHtml(entry.routeCode)}</span>`);
  }

  [entry.primaryColor, entry.secondaryColor].filter(Boolean).forEach(c => {
    const name = colorName(c);
    badgeItems.push(`<span class="route-mini-badge route-color-chip"><span class="route-color-dot" style="background-color:${escapeHtml(c)}"></span>${name ? escapeHtml(name) : ''}</span>`);
  });

  const routeLink = getRouteExternalLink(entry);
  const linkHtml = routeLink
    ? `<a class="route-meta-link route-meta-link-wide" href="${escapeHtml(routeLink)}" target="_blank" rel="noreferrer noopener">Vertical-Life ↗</a>`
    : '';

  const gridItems = badgeItems.join('') + linkHtml;
  const gridHtml = gridItems ? `<div class="route-info-grid">${gridItems}</div>` : '';

  return `<div class="route-info-stack">${gridHtml}</div>`;
}

function getRouteExternalLink(entry) {
  if (!entry) return '';
  if (shouldUseMobileRouteLink()) {
    return entry.mobileLink || entry.link || entry.webLink || '';
  }
  return entry.webLink || entry.link || entry.mobileLink || '';
}

function shouldUseMobileRouteLink() {
  if (navigator.userAgentData && typeof navigator.userAgentData.mobile === 'boolean') {
    return navigator.userAgentData.mobile;
  }

  const userAgent = navigator.userAgent || '';
  if (/Android|iPhone|iPod|IEMobile|Opera Mini|Mobile/i.test(userAgent)) return true;

  return window.matchMedia('(pointer: coarse)').matches && window.matchMedia('(max-width: 820px)').matches;
}

// ── Toast ─────────────────────────────────────────────────────────────────────

let _toastTimer = null;

function showToast(message) {
  clearTimeout(_toastTimer);
  ui.toast.textContent = message;
  ui.toast.classList.add('toast-visible');
  _toastTimer = setTimeout(() => {
    ui.toast.classList.remove('toast-visible');
  }, 2000);
}

// ── Confirm dialog ────────────────────────────────────────────────────────────

function showConfirmDialog(title, body, confirmLabel) {
  return new Promise(resolve => {
    ui.confirmTitle.textContent = title;
    ui.confirmBody.textContent = body;
    ui.confirmOk.textContent = confirmLabel;
    ui.confirmModal.classList.add('open');
    ui.confirmModal.setAttribute('aria-hidden', 'false');

    function close(result) {
      ui.confirmModal.classList.remove('open');
      ui.confirmModal.setAttribute('aria-hidden', 'true');
      ui.confirmOk.removeEventListener('click', onOk);
      ui.confirmCancel.removeEventListener('click', onCancel);
      ui.confirmModal.removeEventListener('click', onOverlay);
      resolve(result);
    }

    function onOk() { close(true); }
    function onCancel() { close(false); }
    function onOverlay(e) { if (e.target === ui.confirmModal) close(false); }

    ui.confirmOk.addEventListener('click', onOk);
    ui.confirmCancel.addEventListener('click', onCancel);
    ui.confirmModal.addEventListener('click', onOverlay);
  });
}

// ── renderApp (Koordinator) ───────────────────────────────────────────────────

function renderNewRoutes() {
  if (!ui.newRoutesSection) return;

  const newEntries = appState.routeEntries
    .filter(e => !e.archived && isRouteNew(e))
    .sort((a, b) => (b.setDate || '').localeCompare(a.setDate || ''));

  if (newEntries.length === 0) {
    ui.newRoutesSection.innerHTML = '';
    ui.newRoutesSection.className = '';
    return;
  }

  ui.newRoutesSection.className = 'archive-section';
  ui.newRoutesSection.innerHTML = `
    <details class="archive-details">
      <summary class="archive-summary">
        <span>Neue Routen</span>
        <span class="archive-count">${newEntries.length} Route${newEntries.length !== 1 ? 'n' : ''} aus den letzten 28 Tagen</span>
      </summary>
      <div class="archive-note">Routen, die in den letzten 28 Tagen geschraubt wurden.</div>
      <div class="new-routes-table-wrap"><table class="archive-table new-routes-table">
        <thead><tr><th>Datum</th><th>Grad</th><th>Route</th><th>Seil / Farbe</th></tr></thead>
        <tbody>
          ${newEntries.map(e => {
            const colors = [e.primaryColor, e.secondaryColor].filter(Boolean);
            const locationDisplay = getRouteLocationDisplay(e);
            const colorChips = colors.map(c => {
              const name = colorName(c);
              return `<span class="route-mini-badge route-color-chip new-route-chip"><span class="route-color-dot" style="background-color:${escapeHtml(c)}"></span>${name ? escapeHtml(name) : ''}</span>`;
            }).join('');
            const ropeBadge = e.routeCode ? `<span class="route-mini-badge new-route-chip">Seil ${escapeHtml(e.routeCode)}</span>` : '';
            const routesetter = String(e.routesetter || '').trim();
            return `
              <tr>
                <td>
                  <div>${escapeHtml(e.setDate ? formatDate(e.setDate) : '—')}</div>
                  ${routesetter ? `<div style="font-size:11px;color:var(--gray-400);">${escapeHtml(routesetter)}</div>` : ''}
                </td>
                <td><span class="route-grade-badge">${escapeHtml(e.grade || '?')}</span></td>
                <td>
                  <div class="route-name-main">${escapeHtml(e.name)}</div>
                  ${locationDisplay ? `<div style="font-size:11px;color:var(--gray-400);">${escapeHtml(locationDisplay)}</div>` : ''}
                </td>
                <td><div class="new-route-info-line">${ropeBadge}${colorChips}</div></td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table></div>
    </details>
  `;
}

function renderApp() {
  const computed = getComputedState();
  renderMetrics(computed);
  renderRoadmap(computed.summaries, computed.progressState);
  renderGradeFilterChips(computed.summaries);
  renderNewRoutes();
  renderRouteBoard(computed.progressState);
  renderStats();
  renderAuthUI();
  renderSettingsModal();
}
