// ── Parsing ──────────────────────────────────────────────────────────────────

function buildHallRouteId(row, index) {
  const link = String(row.link || '').trim();
  const linkId = link.split('/').filter(Boolean).pop();
  if (linkId) return 'hall-' + linkId;
  return 'hall-' + index + '-' + String(row.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function buildHallRouteNotes(row) {
  const parts = [];
  const notes = String(row.notes || '').trim();
  const routesetter = String(row.routesetter || '').trim();
  if (notes) parts.push(notes);
  if (routesetter && routesetter.toUpperCase() !== 'N/A') parts.push('Schrauber: ' + routesetter);
  return parts.join(' · ');
}

function parseHallRouteData(rawCsv) {
  const trimmed = String(rawCsv || '').trim();
  if (!trimmed) return [];

  const lines = trimmed.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const headerIndex = lines.findIndex(line => line.startsWith('location,difficulty,'));
  if (headerIndex === -1) return [];

  const headers = parseCsvLine(lines[headerIndex]);

  return lines.slice(headerIndex + 1).map((line, index) => {
    const values = parseCsvLine(line);
    const row = headers.reduce((accumulator, header, columnIndex) => {
      accumulator[header] = values[columnIndex] || '';
      return accumulator;
    }, {});

    const grade = normalizeHallGrade(row.difficulty);
    const name = String(row.name || '').trim();
    if (!grade || !name) return null;

    const timestamp = Date.parse(String(row.set_at || '').trim()) || Date.now() + index;

    return normalizeEntry({
      id: buildHallRouteId(row, index),
      createdAt: timestamp,
      updatedAt: timestamp,
      date: '',
      setDate: extractHallDate(row.set_at),
      grade,
      rawDifficulty: String(row.difficulty || '').trim(),
      routeCode: String(row.location || '').trim(),
      name,
      location: [
        String(row.area || '').trim(),
        String(row.sector || '').trim(),
        row.location ? 'Linie ' + String(row.location).trim() : ''
      ].filter(Boolean).join(' · '),
      notes: buildHallRouteNotes(row),
      link: String(row.link || '').trim(),
      primaryColor: normalizeColor(row.color_1),
      secondaryColor: normalizeColor(row.color_2),
      source: 'hall'
    });
  }).filter(Boolean);
}

// ── Normalisierung ────────────────────────────────────────────────────────────

function normalizeEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const grade = String(entry.grade || '').trim();
  const name = String(entry.name || '').trim();
  if (!grade || !name) return null;

  const legacyStyle = typeof entry.style === 'string' ? entry.style : '';
  const nextStatus = typeof entry.status === 'string'
    ? entry.status
    : (legacyStyle === 'projekt' ? 'open' : (legacyStyle ? 'done' : 'open'));

  const nextAscentType = typeof entry.ascentType === 'string'
    ? entry.ascentType
    : (legacyStyle === 'toprope'
      ? 'toprope'
      : (legacyStyle === 'flash'
        ? 'flash'
        : (legacyStyle === 'rotpunkt' ? 'rotpunkt' : '')));

  const normalizedStatus = nextStatus === 'done' ? 'done' : 'open';
  const normalizedAscentType = normalizedStatus === 'done'
    ? (nextAscentType === 'toprope' ? 'toprope' : (nextAscentType === 'flash' ? 'flash' : 'rotpunkt'))
    : '';

  return {
    id: String(entry.id || createEntryId()),
    createdAt: Number(entry.createdAt) || Date.now(),
    updatedAt: Number(entry.updatedAt) || Number(entry.createdAt) || Date.now(),
    date: String(entry.date || ''),
    setDate: String(entry.setDate || ''),
    grade,
    rawDifficulty: String(entry.rawDifficulty || '').trim(),
    routeCode: String(entry.routeCode || '').trim(),
    name,
    location: String(entry.location || '').trim(),
    notes: String(entry.notes || '').trim(),
    link: String(entry.link || '').trim(),
    primaryColor: normalizeColor(entry.primaryColor),
    secondaryColor: normalizeColor(entry.secondaryColor),
    status: normalizedStatus,
    ascentType: normalizedAscentType,
    source: entry.source === 'hall' ? 'hall' : 'custom',
    attempts: Number(entry.attempts) || 0
  };
}

function serializeEntry(entry) {
  return {
    id: entry.id,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    date: entry.date,
    setDate: entry.setDate,
    grade: entry.grade,
    rawDifficulty: entry.rawDifficulty,
    routeCode: entry.routeCode,
    name: entry.name,
    location: entry.location,
    notes: entry.notes,
    link: entry.link,
    primaryColor: entry.primaryColor,
    secondaryColor: entry.secondaryColor,
    status: entry.status,
    ascentType: entry.ascentType,
    source: entry.source,
    attempts: entry.attempts
  };
}

function shouldPersistEntry(entry) {
  if (entry.source === 'custom') return true;
  return entry.status !== 'open' || Boolean(entry.date) || entry.attempts > 0;
}

function createEntryKey(entry) {
  return [
    String(entry.grade || '').trim(),
    String(entry.name || '').trim().toLowerCase(),
    String(entry.location || '').trim().toLowerCase()
  ].join('||');
}

// ── Merge ─────────────────────────────────────────────────────────────────────

function mergeRouteEntries(storedEntries) {
  const hallEntries = HALL_ROUTE_ENTRIES.map(entry => ({ ...entry }));
  const byKey = new Map(hallEntries.map(entry => [createEntryKey(entry), entry]));
  const customEntries = [];

  storedEntries.forEach(entry => {
    const key = createEntryKey(entry);
    if (byKey.has(key)) {
      const hallEntry = byKey.get(key);
      byKey.set(key, {
        ...hallEntry,
        status: entry.status,
        ascentType: entry.ascentType,
        date: entry.status === 'done' ? entry.date : '',
        updatedAt: entry.updatedAt || hallEntry.updatedAt,
        attempts: entry.attempts || 0
      });
    } else {
      customEntries.push({ ...entry, source: 'custom' });
    }
  });

  return [...byKey.values(), ...customEntries];
}

// ── Vorstieg ──────────────────────────────────────────────────────────────────

function getRopeNumber(entry) {
  const code = String(entry.routeCode || '').trim();
  const match = code.match(/^(\d+)/);
  return match ? Number(match[1]) : null;
}

function inRanges(rope, ranges) {
  return ranges.some(([lo, hi]) => rope >= lo && rope <= hi);
}

function isVorstiegMandatory(entry) {
  const rope = getRopeNumber(entry);
  return rope !== null && inRanges(rope, APP_CONFIG.vorstiegMandatoryRanges);
}

function isVorstiegOptional(entry) {
  const rope = getRopeNumber(entry);
  return rope !== null && inRanges(rope, APP_CONFIG.vorstiegOptionalRanges);
}

// ── Tracking-Queries ──────────────────────────────────────────────────────────

function isTrackedGrade(grade) {
  const normalizedGrade = String(grade || '').trim();
  if (APP_CONFIG.hiddenGrades.has(normalizedGrade)) return false;
  return Number(normalizedGrade) >= Number(appState.profile.startGrade || APP_CONFIG.defaultProfile.startGrade);
}

function getTrackedEntries() {
  return appState.routeEntries.filter(entry => {
    if (!isTrackedGrade(entry.grade)) return false;
    if (!appState.profile.vorstiegOnly) return true;
    return isVorstiegMandatory(entry) || isVorstiegOptional(entry);
  });
}

function getTrackedEntryCount() {
  return getTrackedEntries().length;
}

// ── Summaries & Progress ──────────────────────────────────────────────────────

function getGradeSummaries() {
  const grouped = getTrackedEntries().reduce((accumulator, entry) => {
    if (!accumulator[entry.grade]) {
      accumulator[entry.grade] = {
        grade: entry.grade,
        total: 0,
        done: 0,
        rotpunkt: 0,
        flash: 0,
        toprope: 0,
        open: 0,
        requiredOpen: 0,
        optionalTotal: 0,
        optionalDone: 0
      };
    }

    const summary = accumulator[entry.grade];
    summary.total += 1;

    if (isVorstiegOptional(entry)) summary.optionalTotal += 1;

    if (entry.status === 'done') {
      summary.done += 1;
      if (entry.ascentType === 'toprope') summary.toprope += 1;
      else if (entry.ascentType === 'flash') summary.flash += 1;
      else summary.rotpunkt += 1;
      if (isVorstiegOptional(entry)) summary.optionalDone += 1;
    } else {
      summary.open += 1;
      if (isVorstiegMandatory(entry)) summary.requiredOpen += 1;
    }

    return accumulator;
  }, {});

  return Object.values(grouped).sort((left, right) => Number(left.grade) - Number(right.grade));
}

function getProgressState(summaries) {
  if (!summaries.length) {
    return {
      current: null,
      next: null,
      canStartNext: false,
      focusText: 'Noch kein Grad aktiv',
      focusNote: 'Die Hallenliste ist geladen. Starte mit den offenen Routen deines Trainingsgrades.',
      unlockText: 'Starte mit den offenen Routen deines Trainingsgrades.',
      progressHint: 'Starte mit dem ersten Grad deiner aktuellen Trainingsphase.'
    };
  }

  const effectiveOpen = summary => appState.profile.vorstiegOnly ? summary.requiredOpen : summary.open;
  const isIncomplete = summary => appState.profile.vorstiegOnly ? summary.requiredOpen > 0 : summary.done < summary.total;

  const firstIncompleteIndex = summaries.findIndex(isIncomplete);

  if (firstIncompleteIndex === -1) {
    return {
      current: null,
      next: null,
      canStartNext: false,
      focusText: 'Alle Grade abgeschlossen',
      focusNote: 'Alle angelegten Grade sind aktuell komplett abgehakt.',
      unlockText: 'Aktuell gibt es keine offenen Routen mehr.',
      progressHint: 'Stark: Alle angelegten Routen sind erledigt.'
    };
  }

  const current = summaries[firstIncompleteIndex];
  const next = summaries[firstIncompleteIndex + 1] || null;
  const openCount = effectiveOpen(current);
  const routeLabel = appState.profile.vorstiegOnly ? 'Vorstieg-Routen' : 'Routen';
  const canStartNext = next !== null && openCount <= 2;

  let unlockText = `${openCount} ${routeLabel} in Grad ${current.grade} offen.`;
  if (next && canStartNext) {
    unlockText = `Nur noch ${openCount} ${routeLabel} in Grad ${current.grade} offen. Grad ${next.grade} darf begonnen werden.`;
  } else if (next && !canStartNext) {
    unlockText = `Noch ${Math.max(openCount - 2, 0)} weitere ${routeLabel} bis Grad ${next.grade} freigeschaltet wird.`;
  }

  return {
    current,
    next,
    canStartNext,
    focusText: 'Grad ' + current.grade,
    focusNote: openCount === 0
      ? `Grad ${current.grade} ist abgeschlossen.`
      : `${openCount} ${routeLabel} in Grad ${current.grade} fehlen noch.`,
    unlockText,
    progressHint: unlockText
  };
}

function getRoadmapState(grade, progressState, summaries) {
  const gradeNumber = Number(grade);
  const currentNumber = progressState.current ? Number(progressState.current.grade) : null;
  const nextNumber = progressState.next ? Number(progressState.next.grade) : null;
  const summariesByGrade = new Map(summaries.map(summary => [summary.grade, summary]));

  if (!progressState.current && summaries.length) return 'done';

  if (currentNumber !== null) {
    if (gradeNumber < currentNumber) return 'done';
    if (gradeNumber === currentNumber) return 'current';
    if (progressState.canStartNext && nextNumber !== null && gradeNumber === nextNumber) return 'unlocked';
    return 'locked';
  }

  if (summariesByGrade.has(String(grade)) && summariesByGrade.get(String(grade)).done === summariesByGrade.get(String(grade)).total) {
    return 'done';
  }

  return 'locked';
}

function getRoadmapStateLabel(state) {
  if (state === 'done') return 'Abgeschlossen';
  if (state === 'current') return 'Aktuell';
  if (state === 'unlocked') return 'Freigegeben';
  return 'Folgt';
}

// ── Computed State (einmaliger Berechnungspunkt für renderApp) ────────────────

function getComputedState() {
  const trackedEntries = getTrackedEntries();
  const summaries = getGradeSummaries();
  const progressState = getProgressState(summaries);
  return { trackedEntries, summaries, progressState };
}

// ── Filter & Sort ─────────────────────────────────────────────────────────────

function getStatusPriority(entry) {
  const selection = selectionFromEntry(entry);
  if (selection === 'open') return 0;
  if (selection === 'toprope') return 1;
  if (selection === 'flash') return 2;
  return 3;
}

function sortEntries(entries) {
  return [...entries].sort((left, right) => {
    const byGrade = Number(left.grade) - Number(right.grade);
    if (byGrade !== 0) return byGrade;
    const byStatus = getStatusPriority(left) - getStatusPriority(right);
    if (byStatus !== 0) return byStatus;
    return left.name.localeCompare(right.name, 'de', { sensitivity: 'base' });
  });
}

function getAvailableGrades(summaries) {
  return summaries.map(summary => summary.grade);
}

function sanitizeSelectedGrades(availableGrades) {
  const availableSet = new Set(availableGrades);
  appState.filters.grades = appState.filters.grades.filter(grade => availableSet.has(grade));
}

function toggleGradeFilter(value) {
  if (value === 'all') {
    appState.filters.grades = [];
    return;
  }

  const selected = new Set(appState.filters.grades);
  if (selected.has(value)) selected.delete(value);
  else selected.add(value);

  appState.filters.grades = Array.from(selected).sort((a, b) => Number(a) - Number(b));
}

function getFilteredEntries() {
  const searchTerm = appState.filters.search;
  const selectedGrades = appState.filters.grades;
  const statusFilter = appState.filters.status;

  return sortEntries(getTrackedEntries()).filter(entry => {
    const matchesSearch = !searchTerm
      || entry.name.toLowerCase().includes(searchTerm)
      || entry.location.toLowerCase().includes(searchTerm)
      || entry.routeCode.toLowerCase().includes(searchTerm)
      || entry.rawDifficulty.toLowerCase().includes(searchTerm)
      || entry.notes.toLowerCase().includes(searchTerm);

    const matchesGrade = selectedGrades.length === 0 || selectedGrades.includes(entry.grade);
    const matchesStatus = statusFilter === 'all' || selectionFromEntry(entry) === statusFilter;

    return matchesSearch && matchesGrade && matchesStatus;
  });
}

// ── Selection Helpers ─────────────────────────────────────────────────────────

function selectionFromEntry(entry) {
  if (entry.status === 'done' && entry.ascentType === 'toprope') return 'toprope';
  if (entry.status === 'done' && entry.ascentType === 'flash') return 'flash';
  if (entry.status === 'done') return 'rotpunkt';
  return 'open';
}

function statusFromSelection(value) {
  if (value === 'toprope') return { status: 'done', ascentType: 'toprope' };
  if (value === 'flash') return { status: 'done', ascentType: 'flash' };
  if (value === 'rotpunkt') return { status: 'done', ascentType: 'rotpunkt' };
  return { status: 'open', ascentType: '' };
}

function getRouteStatusMeta(entry) {
  const selection = selectionFromEntry(entry);
  if (selection === 'toprope') return { label: 'Toprope', pillClass: 'pill-toprope' };
  if (selection === 'flash') return { label: 'Flash', pillClass: 'pill-flash' };
  if (selection === 'rotpunkt') return { label: 'Rotpunkt', pillClass: 'pill-rotpunkt' };
  return { label: 'Noch offen', pillClass: 'pill-projekt' };
}

function getRouteDateLabel(entry) {
  if (entry.status === 'done' && entry.date) return 'Abgehakt am ' + formatDate(entry.date);
  if (entry.setDate) return 'Geschraubt am ' + formatDate(entry.setDate);
  if (entry.date) return 'Eingetragen am ' + formatDate(entry.date);
  return 'Ohne Datum';
}

function sameRoute(left, right) {
  return left.grade === right.grade
    && left.name.trim().toLowerCase() === right.name.trim().toLowerCase()
    && left.location.trim().toLowerCase() === right.location.trim().toLowerCase();
}

// ── Init ──────────────────────────────────────────────────────────────────────

const HALL_ROUTE_CSV = typeof window.TIVOLI_ROUTE_CSV === 'string' ? window.TIVOLI_ROUTE_CSV : '';
const HALL_ROUTE_ENTRIES = parseHallRouteData(HALL_ROUTE_CSV);
