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
  ui.settingsRouteSyncUpdated.textContent = getRouteSyncUpdatedText();
  ui.settingsRouteSyncSummary.textContent = getRouteSyncSummaryText();
  ui.settingsRouteSyncBrowser.textContent = getRouteSyncBrowserText();
  ui.settingsRouteSyncEnable.disabled = appState.routeSync.permission === 'granted';
  ui.settingsRouteSyncCheck.disabled = appState.routeSync.status === 'checking';
}

function getGithubSyncStatusText() {
  if (appState.githubSync.status === 'running') return 'Dispatching workflow …';
  if (appState.githubSync.status === 'success') return appState.githubSync.message || 'Workflow started';
  if (appState.githubSync.status === 'error') return appState.githubSync.message || 'GitHub request failed';
  return appState.githubSync.message || 'Not configured yet';
}

function getRouteSyncUpdatedText() {
  const generatedAt = appState.routeSync.summary?.generatedAt;
  if (!generatedAt) return 'No sync data yet';
  return formatRouteSyncDateTime(generatedAt);
}

function getRouteSyncSummaryText() {
  if (appState.routeSync.status === 'checking') return 'Checking for route updates …';
  if (appState.routeSync.message && appState.routeSync.status === 'error') return appState.routeSync.message;

  const summary = appState.routeSync.summary;
  if (!summary) return 'No sync data yet';
  if (!summary.hasChanges) return 'No recent route changes';

  const bits = [];
  if (summary.summary?.added) bits.push(`${summary.summary.added} new`);
  if (summary.summary?.updated) bits.push(`${summary.summary.updated} updated`);
  if (summary.summary?.removed) bits.push(`${summary.summary.removed} archived`);
  if (appState.routeSync.requiresReload) bits.push('reload available');
  return bits.join(' · ') || 'Recent route changes available';
}

function getRouteSyncBrowserText() {
  if (appState.routeSync.permission === 'unsupported') return 'Not supported in this browser';
  if (appState.routeSync.permission === 'granted') return 'Enabled';
  if (appState.routeSync.permission === 'denied') return 'Blocked in browser settings';
  return 'Not enabled';
}

function renderRouteSyncNotice() {
  const summary = appState.routeSync.summary;
  const hasVisibleNotice = summary
    && summary.hasChanges
    && summary.changeId
    && (summary.changeId !== appState.routeSync.lastSeenChangeId || appState.routeSync.requiresReload);

  if (!hasVisibleNotice) {
    ui.routeSyncNotice.hidden = true;
    ui.routeSyncNotice.innerHTML = '';
    return;
  }

  const bits = [];
  if (summary.summary?.added) bits.push(`${summary.summary.added} new`);
  if (summary.summary?.updated) bits.push(`${summary.summary.updated} updated`);
  if (summary.summary?.removed) bits.push(`${summary.summary.removed} archived`);

  const highlights = getRouteSyncHighlights(summary);
  const actions = [];
  if (appState.routeSync.requiresReload) {
    actions.push('<button type="button" class="secondary-btn" data-route-sync-action="reload">Reload app</button>');
  }
  if (appState.routeSync.permission !== 'granted' && appState.routeSync.permission !== 'unsupported') {
    actions.push('<button type="button" class="secondary-btn" data-route-sync-action="enable-browser">Enable browser notifications</button>');
  }
  actions.push('<button type="button" class="primary-btn" data-route-sync-action="dismiss">Mark as seen</button>');

  ui.routeSyncNotice.hidden = false;
  ui.routeSyncNotice.innerHTML = `
    <section class="route-sync-card${appState.routeSync.requiresReload ? ' route-sync-card-live' : ''}">
      <div class="route-sync-card-head">
        <div>
          <div class="eyebrow">Route update</div>
          <h2 class="route-sync-title">${appState.routeSync.requiresReload ? 'Neue Tivoli-Routen sind verfügbar' : 'Letzte Tivoli-Routenänderungen'}</h2>
          <p class="route-sync-subtitle">${escapeHtml(bits.join(' · ') || 'Recent route changes')} · ${escapeHtml(formatRouteSyncDateTime(summary.generatedAt))}</p>
        </div>
        ${appState.routeSync.requiresReload ? '<span class="status-pill">Reload empfohlen</span>' : ''}
      </div>
      ${highlights.length ? `<ul class="route-sync-list">${highlights.map(item => `<li>${item}</li>`).join('')}</ul>` : '<p class="route-sync-empty">The latest sync changed route data, but no detailed items were included.</p>'}
      <div class="tracker-actions route-sync-actions">
        ${actions.join('')}
      </div>
    </section>
  `;
}

function getRouteSyncHighlights(summary) {
  const items = [];
  (summary.changes?.added || []).slice(0, 4).forEach(route => {
    items.push(`<strong>New</strong> · ${escapeHtml(formatRouteSyncRoute(route))}`);
  });
  (summary.changes?.updated || []).slice(0, 3).forEach(change => {
    const fields = formatChangedFields(change.changedFields || []);
    items.push(`<strong>Updated</strong> · ${escapeHtml(formatRouteSyncRoute(change.after))}${fields ? ` · ${escapeHtml(fields)}` : ''}`);
  });
  (summary.changes?.removed || []).slice(0, 3).forEach(route => {
    items.push(`<strong>Archived</strong> · ${escapeHtml(formatRouteSyncRoute(route))}`);
  });
  return items.slice(0, 7);
}

function formatRouteSyncRoute(route) {
  const location = String(route?.location || '').trim();
  const name = String(route?.name || '').trim();
  const difficulty = String(route?.difficulty || '').trim();
  return [location, name].filter(Boolean).join(' ') + (difficulty ? ` (${difficulty})` : '');
}

function formatChangedFields(fields) {
  const labels = {
    difficulty: 'grade',
    color_1: 'main color',
    color_2: 'accent color',
    notes: 'notes',
    set_at: 'set date',
    routesetter: 'setter',
    area: 'area',
    sector: 'sector'
  };
  return fields.map(field => labels[field] || field).join(', ');
}

function formatRouteSyncDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || '');
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
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

  const activeColumns = getActiveColumns();
  const prefs = appState.profile.tablePrefs;

  const shell = document.createElement('section');
  shell.className = 'route-table-shell';

  // ── Header bar ────────────────────────────────────────────────────────────
  const tableHead = document.createElement('div');
  tableHead.className = 'route-table-head';

  const title = document.createElement('div');
  title.className = 'route-table-title';
  title.textContent = 'Direkte Trainingsliste';

  const headRight = document.createElement('div');
  headRight.className = 'route-table-head-right';

  const meta = document.createElement('div');
  meta.className = 'route-table-meta';
  meta.textContent = filteredEntries.length + ' von ' + trackedEntries.length + ' Routen sichtbar';

  const colMgrBtn = document.createElement('button');
  colMgrBtn.type = 'button';
  colMgrBtn.className = 'col-mgr-btn';
  colMgrBtn.dataset.action = 'toggle-col-panel';
  colMgrBtn.title = 'Spalten anpassen';
  colMgrBtn.textContent = '⚙';

  headRight.appendChild(meta);
  headRight.appendChild(colMgrBtn);
  tableHead.appendChild(title);
  tableHead.appendChild(headRight);
  shell.appendChild(tableHead);

  // ── Column manager panel ──────────────────────────────────────────────────
  const colPanel = document.createElement('div');
  colPanel.className = 'col-mgr-panel' + (appState._colPanelOpen ? '' : ' hidden');

  APP_CONFIG.tableColumns.filter(c => c.hideable).forEach(col => {
    const isVisible = !prefs.hiddenColumns.includes(col.key);
    const label = document.createElement('label');
    label.className = 'col-mgr-item';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = isVisible;
    cb.dataset.action = 'toggle-column';
    cb.dataset.col = col.key;
    label.appendChild(cb);
    label.appendChild(document.createTextNode(' ' + col.label));
    colPanel.appendChild(label);
  });
  shell.appendChild(colPanel);

  // ── Table ─────────────────────────────────────────────────────────────────
  const tableWrap = document.createElement('div');
  tableWrap.className = 'route-table-wrap';

  const table = document.createElement('table');
  table.className = 'route-table';

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');

  activeColumns.forEach(col => {
    const th = document.createElement('th');
    th.dataset.col = col.key;
    th.draggable = true;

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
}

function appendEntryRow(row, entry, progressState, activeColumns) {
  const locked = isEntryLocked(entry, progressState);
  const totalAttempts = getTotalAttempts(entry);
  const todayAttempts = (entry.attemptLog || []).find(s => s.date === getTodayValue())?.count || 0;

  activeColumns.forEach(col => {
    const td = document.createElement('td');

    switch (col.key) {
      case 'grad':
        td.innerHTML = `<span class="route-grade-badge">${escapeHtml(entry.grade)}</span>`;
        break;

      case 'aktionen': {
        const actions = document.createElement('div');
        actions.className = 'route-status-actions';
        [
          { value: 'open', label: 'Offen' },
          { value: 'toprope', label: 'Toprope' },
          { value: 'flash', label: 'Flash' },
          { value: 'rotpunkt', label: 'Rotpunkt' }
        ].forEach(option => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'status-btn status-' + option.value + (selectionFromEntry(entry) === option.value ? ' active' : '');
          btn.disabled = locked;
          btn.dataset.action = 'set-status';
          btn.dataset.entryId = entry.id;
          btn.dataset.status = option.value;
          btn.textContent = option.label;
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
        const todayLabel = todayAttempts === 0 ? 'Heute: 0' : 'Heute: ' + todayAttempts;
        const counter = document.createElement('div');
        counter.className = 'attempt-counter';
        counter.innerHTML = `
          <button type="button" class="attempt-btn" data-action="change-attempts" data-entry-id="${escapeHtml(entry.id)}" data-delta="-1"${todayAttempts === 0 ? ' disabled' : ''}>−</button>
          <span class="attempt-count">${escapeHtml(todayLabel)}</span>
          <button type="button" class="attempt-btn" data-action="change-attempts" data-entry-id="${escapeHtml(entry.id)}" data-delta="1">+</button>
        `;
        td.appendChild(actions);
        td.appendChild(counter);
        if (locked) {
          const lockNote = document.createElement('div');
          lockNote.className = 'route-lock-note';
          lockNote.textContent = 'Gesperrt oberhalb des aktuellen Grades';
          td.appendChild(lockNote);
        }
        break;
      }

      case 'infos':
        td.innerHTML = buildInfoCellHtml(entry);
        break;

      case 'route':
        td.innerHTML = `
          <div class="route-name-main">
            ${escapeHtml(entry.name)}
            ${appState.profile.vorstiegOnly && isVorstiegOptional(entry) ? '<span class="route-optional-badge">Optional</span>' : ''}
          </div>
          <div class="route-name-sub">${escapeHtml(getRouteDateLabel(entry))}</div>
          ${totalAttempts > 0 ? `<div class="route-attempt-info">${totalAttempts} ${totalAttempts === 1 ? 'Versuch' : 'Versuche'} gesamt${todayAttempts > 0 ? ' · heute ' + todayAttempts : ''}</div>` : ''}
          ${entry.notes ? `<div class="route-notes-text">${escapeHtml(entry.notes)}</div>` : ''}
        `;
        break;

      case 'bereich':
        td.innerHTML = `<div class="route-location-text">${escapeHtml(entry.location || '—')}</div>`;
        break;

      case 'versuche':
        td.className = 'col-numeric';
        td.innerHTML = `<span class="route-attempts-badge">${totalAttempts > 0 ? totalAttempts : '—'}</span>`;
        break;

      case 'gesetzt':
        td.className = 'col-date';
        td.innerHTML = `<span class="route-date-text">${escapeHtml(entry.setDate ? formatDate(entry.setDate) : '—')}</span>`;
        break;

      case 'zuletzt': {
        const last = getLastActiveDate(entry);
        td.className = 'col-date';
        td.innerHTML = `<span class="route-date-text">${escapeHtml(last ? formatDate(last) : '—')}</span>`;
        break;
      }
    }

    row.appendChild(td);
  });
}

function buildInfoCellHtml(entry) {
  const bits = [];

  if (isRouteNew(entry)) bits.push(`<span class="badge-new">Neu</span>`);
  if (entry.rawDifficulty) bits.push(`<span class="route-mini-badge">VL ${escapeHtml(entry.rawDifficulty)}</span>`);
  if (entry.routeCode) bits.push(`<span class="route-mini-badge">Linie ${escapeHtml(entry.routeCode)}</span>`);
  if (entry.setDate) bits.push(`<span class="route-mini-badge">Geschraubt ${escapeHtml(formatDate(entry.setDate))}</span>`);

  if (entry.primaryColor || entry.secondaryColor) {
    const colors = [entry.primaryColor, entry.secondaryColor]
      .filter(Boolean)
      .map(color => `<span class="route-color-dot" style="background-color:${escapeHtml(color)}"></span>`)
      .join('');
    bits.push(`<span class="route-colors">${colors}</span>`);
  }

  if (entry.link) {
    bits.push(`<button class="route-meta-link" type="button" data-action="open-route-link" data-url="${escapeHtml(entry.link)}">Vertical-Life ↗</button>`);
  }

  return `<div class="route-info-stack">${bits.join('')}</div>`;
}

// ── renderApp (Koordinator) ───────────────────────────────────────────────────

function renderApp() {
  const computed = getComputedState();
  renderRouteSyncNotice();
  renderMetrics(computed);
  renderRoadmap(computed.summaries, computed.progressState);
  renderGradeFilterChips(computed.summaries);
  renderRouteBoard(computed.progressState);
  renderStats();
  renderAuthUI();
  renderSettingsModal();
}
