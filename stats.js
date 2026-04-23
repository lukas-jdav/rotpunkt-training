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
  const doneEntries = appState.routeEntries.filter(e => e.status === 'done');

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

  const totalAttempts = appState.routeEntries.reduce(
    (sum, e) => sum + (e.attemptLog || []).reduce((s2, sess) => s2 + sess.count, 0), 0
  );
  const attemptedRoutes = appState.routeEntries.filter(e => (e.attemptLog || []).length > 0).length;
  const avgAttemptsPerRoute = attemptedRoutes > 0 ? (totalAttempts / attemptedRoutes).toFixed(1) : '—';

  return {
    ascentCounts, totalDone, weekRows, maxWeekCount,
    maxGrade, maxGradeCount, avgPerWeek, activeWeeks,
    totalAttempts, attemptedRoutes, avgAttemptsPerRoute,
    attemptWeekRows, maxAttemptWeekCount
  };
}

function renderStats() {
  const panel = ui.statsPanel;
  if (!panel) return;

  const stats = computeStats();
  const total = stats.ascentCounts.rotpunkt + stats.ascentCounts.flash + stats.ascentCounts.toprope;
  const hasAttempts = stats.totalAttempts > 0;

  panel.innerHTML = `
    <div class="section">
      <h2 class="section-title">Trainingsstatistik</h2>
      <div class="stats-grid">

        <div class="card">
          <div class="eyebrow">Aufstiegstypen</div>
          <h3 class="progress-card-title">${total} erledigte Routen gesamt</h3>
          ${total === 0 ? '<p style="color:var(--gray-400);font-size:13px;">Noch keine Routen abgeschlossen.</p>' : `
          <div class="stats-ascent-rows">
            ${renderAscentRow('Rotpunkt', stats.ascentCounts.rotpunkt, total, 'pill-rotpunkt', 'var(--dav-green)')}
            ${renderAscentRow('Flash', stats.ascentCounts.flash, total, 'pill-flash', 'var(--accent)')}
            ${renderAscentRow('Toprope', stats.ascentCounts.toprope, total, 'pill-toprope', 'var(--blue)')}
          </div>`}
        </div>

        <div class="card">
          <div class="eyebrow">Stärkster Grad</div>
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
        </div>

        <div class="card" style="grid-column:1/-1;">
          <div class="eyebrow">Abschlüsse pro Woche</div>
          <h3 class="progress-card-title">Letzte 8 Wochen</h3>
          ${stats.weekRows.every(r => r.count === 0) ? '<p style="color:var(--gray-400);font-size:13px;">Noch keine abgeschlossenen Routen mit Datum vorhanden.</p>' : ''}
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
        </div>

        <div class="card" style="grid-column:1/-1;">
          <div class="eyebrow">Versuche pro Woche</div>
          <h3 class="progress-card-title">Letzte 8 Wochen</h3>
          ${!hasAttempts ? '<p style="color:var(--gray-400);font-size:13px;">Noch keine Versuche eingetragen. Nutze die −/+ Buttons in der Trainingsliste.</p>' : ''}
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
        </div>

      </div>
    </div>
  `;
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
