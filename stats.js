function getISOWeekKey(dateString) {
  const date = new Date(dateString + 'T00:00:00');
  if (Number.isNaN(date.getTime())) return null;

  // ISO week: week starts Monday, week 1 contains first Thursday of the year
  const dayOfWeek = (date.getDay() + 6) % 7; // 0=Mon, 6=Sun
  const thursday = new Date(date);
  thursday.setDate(date.getDate() - dayOfWeek + 3);
  const yearStart = new Date(thursday.getFullYear(), 0, 1);
  const weekNumber = Math.ceil(((thursday - yearStart) / 86400000 + 1) / 7);
  return thursday.getFullYear() + '-W' + String(weekNumber).padStart(2, '0');
}

function getISOWeekLabel(weekKey) {
  const match = weekKey.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return weekKey;
  const year = Number(match[1]);
  const week = Number(match[2]);

  // Find Monday of that ISO week
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dayOfWeek = (simple.getDay() + 6) % 7;
  const monday = new Date(simple);
  monday.setDate(simple.getDate() - dayOfWeek);

  const formatted = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short' }).format(monday);
  return 'KW ' + week + ' · ' + formatted;
}

function computeStats() {
  const doneEntries = getAscentOverviewRows({ includeOpenRows: false }).filter(e => e.status === 'done');

  const ascentCounts = { rotpunkt: 0, flash: 0, toprope: 0 };
  doneEntries.forEach(e => {
    const type = e.ascentType === 'toprope' ? 'toprope' : (e.ascentType === 'flash' ? 'flash' : 'rotpunkt');
    ascentCounts[type] += 1;
  });

  const totalDone = doneEntries.length;

  // Build sorted list of last 8 weeks (always show, even if 0)
  const today = new Date();
  const recentWeeks = [];
  for (let offset = 7; offset >= 0; offset--) {
    const d = new Date(today);
    d.setDate(today.getDate() - offset * 7);
    const key = getISOWeekKey(d.toISOString().slice(0, 10));
    if (key && !recentWeeks.includes(key)) recentWeeks.push(key);
  }

  // Abgeschlossene Routen pro Woche
  const completedByWeek = {};
  doneEntries.forEach(e => {
    if (!e.date) return;
    const key = getISOWeekKey(e.date);
    if (!key) return;
    completedByWeek[key] = (completedByWeek[key] || 0) + 1;
  });

  const weekRows = recentWeeks.map(key => ({
    key,
    label: getISOWeekLabel(key),
    count: completedByWeek[key] || 0
  }));
  const maxWeekCount = Math.max(...weekRows.map(r => r.count), 1);

  // Versuche pro Woche (aus attemptLog aller Einträge)
  const attemptsByWeek = {};
  appState.routeEntries.forEach(entry => {
    (entry.attemptLog || []).forEach(session => {
      if (!session.date) return;
      const key = getISOWeekKey(session.date);
      if (!key) return;
      attemptsByWeek[key] = (attemptsByWeek[key] || 0) + session.count;
    });
  });
  (appState.profile.ascentArchive || []).forEach(rawRecord => {
    const record = normalizeAscentArchiveRecord(rawRecord);
    if (!record) return;
    (record.attempts || []).forEach(session => {
      if (!session.date) return;
      const key = getISOWeekKey(session.date);
      if (!key) return;
      attemptsByWeek[key] = (attemptsByWeek[key] || 0) + session.count;
    });
  });

  const attemptWeekRows = recentWeeks.map(key => ({
    key,
    label: getISOWeekLabel(key),
    count: attemptsByWeek[key] || 0
  }));
  const maxAttemptWeekCount = Math.max(...attemptWeekRows.map(r => r.count), 1);

  // Strongest grade
  let maxGrade = null;
  let maxGradeCount = 0;
  doneEntries.forEach(e => {
    const g = Number(e.grade);
    if (!Number.isFinite(g)) return;
    if (maxGrade === null || g > maxGrade) {
      maxGrade = g;
      maxGradeCount = 1;
    } else if (g === maxGrade) {
      maxGradeCount += 1;
    }
  });

  const activeWeeks = Object.keys(completedByWeek).length;
  const avgPerWeek = activeWeeks > 0 ? (totalDone / activeWeeks).toFixed(1) : '—';

  // Trend: current week vs average of prior 4 weeks
  const currentWeekKey = getISOWeekKey(today.toISOString().slice(0, 10));
  const currentWeekCount = completedByWeek[currentWeekKey] || 0;
  const prior4 = recentWeeks.slice(-5, -1); // 4 weeks before current
  const prior4Avg = prior4.length > 0
    ? prior4.reduce((s, k) => s + (completedByWeek[k] || 0), 0) / prior4.length
    : null;
  const trendDelta = prior4Avg !== null ? currentWeekCount - prior4Avg : null;
  const trendDir = trendDelta === null ? null : trendDelta > 0.4 ? 'up' : trendDelta < -0.4 ? 'down' : 'flat';

  // By location (wall/area success rate)
  const locationMap = {};
  appState.routeEntries.filter(e => !e.archived).forEach(e => {
    const loc = e.location || '';
    if (!loc) return;
    if (!locationMap[loc]) locationMap[loc] = { total: 0, done: 0 };
    locationMap[loc].total += 1;
    if (e.status === 'done') locationMap[loc].done += 1;
  });
  const byLocation = Object.entries(locationMap)
    .map(([loc, v]) => ({ loc, ...v, rate: v.total > 0 ? v.done / v.total : 0 }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  const archivedAttemptRecords = (appState.profile.ascentArchive || [])
    .map(normalizeAscentArchiveRecord)
    .filter(record => record && (record.attempts || []).length > 0);
  const totalAttempts = appState.routeEntries.reduce(
    (sum, e) => sum + (e.attemptLog || []).reduce((s2, sess) => s2 + sess.count, 0), 0
  ) + archivedAttemptRecords.reduce(
    (sum, record) => sum + record.attempts.reduce((s2, sess) => s2 + sess.count, 0), 0
  );
  const attemptedRoutes = appState.routeEntries.filter(e => (e.attemptLog || []).length > 0).length + archivedAttemptRecords.length;
  const avgAttemptsPerRoute = attemptedRoutes > 0 ? (totalAttempts / attemptedRoutes).toFixed(1) : '—';

  return {
    ascentCounts, totalDone, weekRows, maxWeekCount,
    maxGrade, maxGradeCount, avgPerWeek, activeWeeks,
    totalAttempts, attemptedRoutes, avgAttemptsPerRoute,
    attemptWeekRows, maxAttemptWeekCount,
    currentWeekCount, trendDelta, trendDir,
    byLocation
  };
}

const _ascentFilters = {
  grades: new Set(),
  ascentTypes: new Set(),
  dateRange: 'all',
  showOpenRoutes: false,
  ropeFilter: 'all',
  sortBy: 'date',
  sortDir: 'desc'
};

function getAscentAvailableGrades() {
  const set = new Set();
  getAscentOverviewRows({ includeOpenRows: true }).forEach(e => {
    if (e.grade) set.add(String(e.grade));
  });
  appState.routeEntries.forEach(entry => {
    if (!entry.archived && entry.grade && entry.status === 'open') {
      set.add(String(entry.grade));
    }
  });
  return [...set].sort((a, b) => Number(a) - Number(b));
}

function getLatestAttemptDate(attempts) {
  return (attempts || [])
    .map(attempt => String(attempt.date || ''))
    .filter(Boolean)
    .sort()
    .pop() || '';
}

function getAscentRowKey(row) {
  return [
    row.entryId || row.id || row.name,
    row.cycle || '',
    row.status || '',
    row.ascentType || '',
    row.date || '',
    row.grade || '',
    row.name || ''
  ].join('||').toLowerCase();
}

function getAscentOverviewRows(options = {}) {
  const includeOpenRows = options.includeOpenRows !== false;
  const rows = [];
  const seenRows = new Set();

  const addRow = row => {
    const key = getAscentRowKey(row);
    if (seenRows.has(key)) return;
    seenRows.add(key);
    rows.push(row);
  };

  (appState.profile.ascentArchive || []).forEach(rawRecord => {
    const record = normalizeAscentArchiveRecord(rawRecord);
    if (!record || record.status !== 'done') return;
    const archivedEntry = { routeCode: record.route.routeCode, grade: record.route.grade };
    addRow({
      id: record.id || 'archive-' + rows.length,
      entryId: record.entryId,
      status: 'done',
      ascentType: record.ascentType || 'rotpunkt',
      date: record.date || getLatestAttemptDate(record.attempts),
      grade: record.route.grade,
      name: record.route.name,
      location: record.route.location,
      cycle: record.cycle || null,
      vorstiegEligible: isVorstiegMandatory(archivedEntry) || isVorstiegOptional(archivedEntry)
    });
  });

  appState.routeEntries.forEach(entry => {
    const vorstiegEligible = isVorstiegMandatory(entry) || isVorstiegOptional(entry);

    (entry.cycleHistory || []).forEach((history, index) => {
      if (!history || history.status !== 'done') return;
      addRow({
        id: entry.id + '-history-' + index,
        entryId: entry.id,
        status: 'done',
        ascentType: history.ascentType || 'rotpunkt',
        date: String(history.date || history.completedDate || getLatestAttemptDate(history.attempts) || ''),
        grade: entry.grade,
        name: entry.name,
        location: entry.location,
        cycle: history.cycle || null,
        vorstiegEligible
      });
    });

    if (entry.status === 'done') {
      addRow({
        id: entry.id + '-current',
        entryId: entry.id,
        status: 'done',
        ascentType: entry.ascentType || 'rotpunkt',
        date: entry.date || '',
        grade: entry.grade,
        name: entry.name,
        location: entry.location,
        cycle: appState.profile.currentCycle || null,
        vorstiegEligible
      });
    }

    if (
      includeOpenRows &&
      !entry.archived &&
      entry.status === 'open'
    ) {
      addRow({
        id: entry.id + '-open',
        entryId: entry.id,
        status: 'open',
        ascentType: '',
        date: '',
        grade: entry.grade,
        name: entry.name,
        location: entry.location,
        cycle: null,
        vorstiegEligible
      });
    }
  });

  return rows;
}

function getFilteredAscents() {
  const f = _ascentFilters;
  const matchesGrade = e => f.grades.size === 0 || f.grades.has(String(e.grade));
  const matchesAscentType = e => {
    if (f.ascentTypes.size === 0) return true;
    if (e.status === 'open') return f.ascentTypes.has('open');
    return f.ascentTypes.has(e.ascentType || 'rotpunkt');
  };
  const matchesDate = e => {
    if (f.dateRange === 'all') return true;
    if (!e.date) return false;
    const days = (Date.now() - new Date(e.date + 'T00:00:00').getTime()) / 86400000;
    if (f.dateRange === '30d') return days <= 30;
    if (f.dateRange === '6m') return days <= 180;
    if (f.dateRange === 'year') return days <= 365;
    return true;
  };
  const matchesRope = e => {
    if (f.ropeFilter === 'all') return true;
    if (f.ropeFilter === 'vorstieg') return e.vorstiegEligible === true;
    if (f.ropeFilter === 'toprope') return e.vorstiegEligible === false;
    return true;
  };

  const entries = getAscentOverviewRows({ includeOpenRows: f.showOpenRoutes });
  const dir = _ascentFilters.sortDir === 'asc' ? 1 : -1;
  return entries
    .filter(e => matchesGrade(e) && matchesAscentType(e) && matchesRope(e) && (e.status === 'open' || matchesDate(e)))
    .sort((a, b) => {
      switch (_ascentFilters.sortBy) {
        case 'grade':
          return (Number(a.grade) - Number(b.grade)) * dir;
        case 'route':
          return (a.name || '').localeCompare(b.name || '', 'de') * dir;
        case 'cycle':
          return ((a.cycle || 0) - (b.cycle || 0)) * dir;
        case 'type': {
          const order = { rotpunkt: 0, flash: 1, toprope: 2, open: 3 };
          const at = a.status === 'open' ? 'open' : (a.ascentType || 'rotpunkt');
          const bt = b.status === 'open' ? 'open' : (b.ascentType || 'rotpunkt');
          return ((order[at] ?? 3) - (order[bt] ?? 3)) * dir;
        }
        default: {
          const dateCmp = (a.date || '').localeCompare(b.date || '');
          return (dateCmp !== 0 ? dateCmp : ((a.cycle || 0) - (b.cycle || 0))) * dir;
        }
      }
    });
}

function renderAscentBadge(entry) {
  if (entry.status === 'open') {
    return '<span class="tracker-pill pill-projekt">Offen</span>';
  }
  const type = entry.ascentType || 'rotpunkt';
  const labels = { rotpunkt: 'Rotpunkt', flash: 'Flash', toprope: 'Toprope' };
  return `<span class="tracker-pill pill-${type}">${labels[type] || 'Rotpunkt'}</span>`;
}

function renderStatsDetails({ eyebrow, title, body, wide = false, open = true }) {
  return `
    <details class="card stats-details ${wide ? 'stats-details-wide' : ''}" ${open ? 'open' : ''}>
      <summary class="stats-details-summary">
        <span class="stats-details-heading">
          <span class="eyebrow">${escapeHtml(eyebrow)}</span>
          <span class="progress-card-title">${title}</span>
        </span>
        <span class="stats-details-indicator" aria-hidden="true">▾</span>
      </summary>
      <div class="stats-details-body">
        ${body}
      </div>
    </details>
  `;
}

function renderAscentOverview(progressState) {
  const grades = getAscentAvailableGrades();
  const f = _ascentFilters;
  const entries = getFilteredAscents();
  const ascentCount = entries.filter(entry => entry.status === 'done').length;
  const openCount = entries.length - ascentCount;
  const overviewTitle = `${ascentCount} Begehung${ascentCount !== 1 ? 'en' : ''}${openCount > 0 ? ` · ${openCount} offen` : ''}`;

  const typeOptions = [
    { value: 'rotpunkt', label: 'Rotpunkt' },
    { value: 'flash', label: 'Flash' },
    { value: 'toprope', label: 'Toprope' },
    { value: 'open', label: 'Offen' }
  ];

  return `
    <details class="card stats-details stats-details-wide" open>
      <summary class="stats-details-summary">
        <span class="stats-details-heading">
          <span class="eyebrow">Begehungsübersicht</span>
          <span class="progress-card-title">${overviewTitle}</span>
        </span>
        <span class="stats-details-indicator" aria-hidden="true">▾</span>
      </summary>
      <div class="stats-details-body">

      <div class="ascent-filter-row">
        <div class="ascent-filter-label">Grad</div>
        <div class="ascent-filter-chips">
          <button type="button" class="grade-filter-btn ${f.grades.size === 0 ? 'active all' : ''}" data-ascent-action="grade-all">Alle</button>
          ${grades.map(g => `
            <button type="button" class="grade-filter-btn ${f.grades.has(g) ? 'active' : ''}" data-ascent-action="grade-toggle" data-value="${escapeHtml(g)}">${escapeHtml(g)}</button>
          `).join('')}
        </div>
      </div>

      <div class="ascent-filter-row">
        <div class="ascent-filter-label">Begehungsstil</div>
        <div class="ascent-filter-chips">
          <button type="button" class="filter-preset-btn ${f.ascentTypes.size === 0 ? 'active' : ''}" data-ascent-action="type-all">Alle</button>
          ${typeOptions.map(opt => `
            <button type="button" class="filter-preset-btn ${f.ascentTypes.has(opt.value) ? 'active' : ''}" data-ascent-action="type-toggle" data-value="${opt.value}">${opt.label}</button>
          `).join('')}
        </div>
      </div>

      <div class="ascent-filter-row">
        <div class="ascent-filter-label">Zeitraum</div>
        <select class="ascent-date-select" data-ascent-action="date-range">
          <option value="all" ${f.dateRange === 'all' ? 'selected' : ''}>Gesamter Zeitraum</option>
          <option value="30d" ${f.dateRange === '30d' ? 'selected' : ''}>Letzte 30 Tage</option>
          <option value="6m" ${f.dateRange === '6m' ? 'selected' : ''}>Letzte 6 Monate</option>
          <option value="year" ${f.dateRange === 'year' ? 'selected' : ''}>Letztes Jahr</option>
        </select>
      </div>

      <div class="ascent-filter-row">
        <div class="ascent-filter-label">Sortierung</div>
        <div class="ascent-filter-chips">
          ${[
            { value: 'date', label: 'Datum' },
            { value: 'grade', label: 'Grad' },
            { value: 'route', label: 'Route' },
            { value: 'cycle', label: 'Mesozyklus' },
            { value: 'type', label: 'Begehungsstil' }
          ].map(opt => {
            const active = f.sortBy === opt.value;
            const arrow = active ? (f.sortDir === 'asc' ? ' ↑' : ' ↓') : '';
            return `<button type="button" class="filter-preset-btn ${active ? 'active' : ''}" data-ascent-action="sort-by" data-value="${opt.value}">${opt.label}${arrow}</button>`;
          }).join('')}
        </div>
      </div>

      <label class="toggle-row" style="margin-top:10px;">
        <input type="checkbox" data-ascent-action="toggle-open" ${f.showOpenRoutes ? 'checked' : ''}>
        <div>
          <strong>Offene Routen zusätzlich anzeigen</strong>
          <span>Dadurch siehst du neben allen Begehungen auch noch nicht abgeschlossene Routen aus allen Graden.</span>
        </div>
      </label>

      <div style="overflow-x:auto;margin-top:14px;">
        <table class="archive-table">
          <thead><tr><th>Datum der Begehung</th><th>Grad</th><th>Route</th><th>Begehung</th></tr></thead>
          <tbody>
            ${entries.length === 0
              ? '<tr><td colspan="4" style="color:var(--gray-400);font-size:13px;text-align:center;padding:18px;">Keine Routen passen zu den Filtern.</td></tr>'
              : entries.map(e => `
                <tr>
                  <td>
                    <div>${escapeHtml(e.date ? formatDate(e.date) : '—')}</div>
                    ${e.cycle ? `<div style="font-size:11px;color:var(--gray-400);">Mesozyklus ${escapeHtml(String(e.cycle))}</div>` : ''}
                  </td>
                  <td><span class="route-grade-badge">${escapeHtml(e.grade || '?')}</span></td>
                  <td>
                    <div class="route-name-main">${escapeHtml(e.name)}</div>
                    ${getRouteLocationDisplay(e) ? `<div style="font-size:11px;color:var(--gray-400);">${escapeHtml(getRouteLocationDisplay(e))}</div>` : ''}
                  </td>
                  <td>${renderAscentBadge(e)}</td>
                </tr>
              `).join('')}
          </tbody>
        </table>
      </div>
      </div>
    </details>
  `;
}

function renderStats() {
  const panel = ui.statsPanel;
  if (!panel) return;

  const stats = computeStats();
  const progressState = getComputedState().progressState;
  const total = stats.ascentCounts.rotpunkt + stats.ascentCounts.flash + stats.ascentCounts.toprope;
  const hasAttempts = stats.totalAttempts > 0;
  const ascentTypesBody = total === 0
    ? '<p style="color:var(--gray-400);font-size:13px;">Noch keine Routen abgeschlossen.</p>'
    : `
      <div class="stats-ascent-rows">
        ${renderAscentRow('Rotpunkt', stats.ascentCounts.rotpunkt, total, 'pill-rotpunkt', 'var(--dav-green)')}
        ${renderAscentRow('Flash', stats.ascentCounts.flash, total, 'pill-flash', 'var(--accent)')}
        ${renderAscentRow('Toprope', stats.ascentCounts.toprope, total, 'pill-toprope', 'var(--blue)')}
      </div>
    `;
  const summaryBody = `
    ${stats.maxGrade !== null ? `
      <div style="display:flex;align-items:center;gap:12px;margin:10px 0 6px;">
        <span class="route-grade-badge" style="font-size:22px;min-width:52px;padding:10px 14px;">${stats.maxGrade}</span>
        <div>
          <div style="font-weight:700;">${stats.maxGradeCount} Route${stats.maxGradeCount !== 1 ? 'n' : ''} abgeschlossen</div>
          <div style="color:var(--gray-400);font-size:13px;">Höchster Grad mit Abschluss</div>
        </div>
      </div>
    ` : '<p style="color:var(--gray-400);font-size:13px;">Noch kein Grad abgeschlossen.</p>'}
    <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--gray-100);">
      <div class="eyebrow">Abschlüsse</div>
      <div class="stats-summary-row">
        <span>Abgeschlossen gesamt</span>
        <strong>${stats.totalDone}</strong>
      </div>
      <div class="stats-summary-row">
        <span>Aktive Trainingswochen</span>
        <strong>${stats.activeWeeks}</strong>
      </div>
      <div class="stats-summary-row">
        <span>Ø Abschlüsse pro Woche</span>
        <strong>${stats.avgPerWeek}</strong>
      </div>
    </div>
    <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--gray-100);">
      <div class="eyebrow">Versuche</div>
      <div class="stats-summary-row">
        <span>Versuche gesamt</span>
        <strong>${stats.totalAttempts}</strong>
      </div>
      <div class="stats-summary-row">
        <span>Angegangene Routen</span>
        <strong>${stats.attemptedRoutes}</strong>
      </div>
      <div class="stats-summary-row">
        <span>Ø Versuche pro Route</span>
        <strong>${stats.avgAttemptsPerRoute}</strong>
      </div>
    </div>
  `;
  const completedWeeksBody = `
    <div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;">
      ${stats.trendDir ? `<span class="trend-badge trend-${stats.trendDir}">${stats.trendDir === 'up' ? '↑' : stats.trendDir === 'down' ? '↓' : '→'} ${stats.trendDir === 'flat' ? 'Schnitt' : (Math.abs(stats.trendDelta).toFixed(1) + (stats.trendDir === 'up' ? ' über Schnitt' : ' unter Schnitt'))}</span>` : ''}
    </div>
    ${stats.weekRows.every(r => r.count === 0) ? '<p style="color:var(--gray-400);font-size:13px;margin-top:8px;">Noch keine abgeschlossenen Routen mit Datum vorhanden.</p>' : ''}
    <div class="stats-week-list">
      ${stats.weekRows.map(row => `
        <div class="stats-week-row">
          <div class="stats-week-label">${escapeHtml(row.label)}</div>
          <div class="stats-week-bar-wrap">
            <div class="stats-week-bar" style="width:${Math.round((row.count / stats.maxWeekCount) * 100)}%"></div>
          </div>
          <div class="stats-week-count">${row.count}</div>
        </div>
      `).join('')}
    </div>
  `;
  const attemptsWeeksBody = `
    ${!hasAttempts ? '<p style="color:var(--gray-400);font-size:13px;">Noch keine Versuche eingetragen. Nutze die −/+ Buttons in der Routenliste.</p>' : ''}
    <div class="stats-week-list">
      ${stats.attemptWeekRows.map(row => `
        <div class="stats-week-row">
          <div class="stats-week-label">${escapeHtml(row.label)}</div>
          <div class="stats-week-bar-wrap">
            <div class="stats-week-bar stats-week-bar--attempts" style="width:${Math.round((row.count / stats.maxAttemptWeekCount) * 100)}%"></div>
          </div>
          <div class="stats-week-count">${row.count}</div>
        </div>
      `).join('')}
    </div>
  `;

  panel.innerHTML = `
    <div class="section">
      <h2 class="section-title">Trainingsstatistik</h2>
      <div class="stats-grid">

        ${renderStatsDetails({ eyebrow: 'Aufstiegstypen', title: `${total} erledigte Routen gesamt`, body: ascentTypesBody })}

        ${renderStatsDetails({ eyebrow: 'Stärkster Grad', title: stats.maxGrade !== null ? `Grad ${stats.maxGrade}` : 'Noch kein Grad', body: summaryBody })}

        ${renderStatsDetails({ eyebrow: 'Abschlüsse pro Woche', title: 'Letzte 8 Wochen', body: completedWeeksBody, wide: true })}

        ${renderStatsDetails({ eyebrow: 'Versuche pro Woche', title: 'Letzte 8 Wochen', body: attemptsWeeksBody, wide: true })}

        ${renderAscentOverview(progressState)}

      </div>
    </div>
  `;

  const archivedEntries = appState.routeEntries
    .filter(e => e.archived && e.status === 'done')
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  if (archivedEntries.length > 0) {
    const archiveSection = document.createElement('div');
    archiveSection.className = 'section archive-section';
    archiveSection.innerHTML = `
      <details class="archive-details">
        <summary class="archive-summary">
          <span>Mein Kletter-Archiv</span>
          <span class="archive-count">${archivedEntries.length} Route${archivedEntries.length !== 1 ? 'n' : ''} aus abgebauten Seilen</span>
        </summary>
        <div class="archive-note">Abgeschlossene Routen, die nicht mehr in der Halle hängen.</div>
        <table class="archive-table">
          <thead><tr><th>Datum</th><th>Grad</th><th>Route</th><th>Begehung</th></tr></thead>
          <tbody>
            ${archivedEntries.map(e => `
              <tr>
                <td>${escapeHtml(e.date ? formatDate(e.date) : '—')}</td>
                <td><span class="route-grade-badge">${escapeHtml(e.grade)}</span></td>
                <td>
                  <div class="route-name-main">${escapeHtml(e.name)}</div>
                  ${getRouteLocationDisplay(e) ? `<div style="font-size:11px;color:var(--gray-400);">${escapeHtml(getRouteLocationDisplay(e))}</div>` : ''}
                </td>
                <td><span class="tracker-pill pill-${e.ascentType === 'flash' ? 'flash' : e.ascentType === 'toprope' ? 'toprope' : 'rotpunkt'}">${e.ascentType === 'flash' ? 'Flash' : e.ascentType === 'toprope' ? 'Toprope' : 'Rotpunkt'}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </details>
    `;
    panel.appendChild(archiveSection);
  }
}

function renderAscentRow(label, count, total, pillClass, barColor) {
  const percent = total > 0 ? Math.round((count / total) * 100) : 0;
  return `
    <div class="stats-ascent-row">
      <span class="tracker-pill ${escapeHtml(pillClass)}" style="min-width:80px;justify-content:center;">${escapeHtml(label)}</span>
      <div class="stats-ascent-bar-wrap">
        <div class="stats-ascent-bar" style="width:${percent}%;background:${barColor};"></div>
      </div>
      <span class="stats-ascent-count">${count} (${percent}%)</span>
    </div>
  `;
}
