// ── Parsing ──────────────────────────────────────────────────────────────────

function buildHallRouteId(row, index) {
  const link = String(row.link || '').trim();
  const linkId = link.split('/').filter(Boolean).pop();
  if (linkId) return 'hall-' + linkId;
  return 'hall-' + index + '-' + String(row.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function buildHallRouteNotes(row) {
  return String(row.notes || '').trim();
}

function normalizeRoutesetter(value) {
  const routesetter = String(value || '').trim();
  return routesetter && routesetter.toUpperCase() !== 'N/A' ? routesetter : '';
}

function normalizeAttemptSession(session) {
  return {
    date: String(session.date || ''),
    count: Math.max(0, Number(session.count) || 0),
    notes: String(session.notes || '')
  };
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
      routesetter: normalizeRoutesetter(row.routesetter),
      link: String(row.link || '').trim(),
      webLink: String(row.web_link || '').trim(),
      mobileLink: String(row.mobile_link || '').trim(),
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
    routesetter: normalizeRoutesetter(entry.routesetter),
    link: String(entry.link || '').trim(),
    webLink: String(entry.webLink || '').trim(),
    mobileLink: String(entry.mobileLink || '').trim(),
    primaryColor: normalizeColor(entry.primaryColor),
    secondaryColor: normalizeColor(entry.secondaryColor),
    status: normalizedStatus,
    ascentType: normalizedAscentType,
    source: entry.source === 'hall' ? 'hall' : 'custom',
    archived: Boolean(entry.archived) || false,
    attemptLog: Array.isArray(entry.attemptLog)
      ? entry.attemptLog.map(normalizeAttemptSession).filter(s => s.count > 0)
      : Number(entry.attempts) > 0 ? [{ date: '', count: Number(entry.attempts), notes: '' }] : [],
    cycleHistory: Array.isArray(entry.cycleHistory)
      ? entry.cycleHistory.filter(h => h && typeof h.cycle === 'number').map(h => ({
          cycle: h.cycle,
          status: h.status === 'done' ? 'done' : 'open',
          ascentType: String(h.ascentType || ''),
          date: String(h.date || h.completedDate || ''),
          attempts: Array.isArray(h.attempts) ? h.attempts.map(normalizeAttemptSession).filter(s => s.count > 0) : []
        }))
      : []
  };
}

function createRouteSnapshot(entry) {
  return {
    grade: String(entry.grade || ''),
    rawDifficulty: String(entry.rawDifficulty || ''),
    routeCode: String(entry.routeCode || ''),
    name: String(entry.name || ''),
    location: String(entry.location || ''),
    notes: String(entry.notes || ''),
    routesetter: String(entry.routesetter || ''),
    source: entry.source === 'hall' ? 'hall' : 'custom'
  };
}

function normalizeAscentArchiveRecord(record) {
  if (!record || typeof record !== 'object') return null;
  const route = record.route && typeof record.route === 'object'
    ? record.route
    : record;
  const name = String(route.name || record.name || '').trim();
  const grade = String(route.grade || record.grade || '').trim();
  if (!name || !grade) return null;

  const status = record.status === 'done' ? 'done' : 'open';
  const ascentType = status === 'done'
    ? (record.ascentType === 'toprope' ? 'toprope' : (record.ascentType === 'flash' ? 'flash' : 'rotpunkt'))
    : '';
  const attempts = Array.isArray(record.attempts)
    ? record.attempts.map(normalizeAttemptSession).filter(s => s.count > 0)
    : [];
  const routeSnapshot = createRouteSnapshot({
    grade,
    rawDifficulty: route.rawDifficulty || record.rawDifficulty,
    routeCode: route.routeCode || record.routeCode,
    name,
    location: route.location || record.location,
    notes: route.notes || record.notes,
    routesetter: route.routesetter || record.routesetter,
    source: route.source || record.source
  });

  return {
    id: String(record.id || ''),
    entryId: String(record.entryId || ''),
    cycle: Math.max(1, Number(record.cycle) || 1),
    status,
    ascentType,
    date: String(record.date || ''),
    attempts,
    route: routeSnapshot,
    archivedAt: String(record.archivedAt || '')
  };
}

function createAscentArchiveKey(record) {
  const normalized = normalizeAscentArchiveRecord(record);
  if (!normalized) return '';
  return [
    normalized.entryId || normalized.route.name.toLowerCase(),
    normalized.cycle,
    normalized.status,
    normalized.ascentType,
    normalized.date,
    normalized.route.grade,
    normalized.route.name.toLowerCase()
  ].join('||');
}

function createAscentArchiveId(record) {
  return 'archive-' + createAscentArchiveKey(record).replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 120);
}

function createAscentArchiveRecord(entry, cycleNum, history) {
  const source = history || entry;
  const record = normalizeAscentArchiveRecord({
    entryId: entry.id,
    cycle: cycleNum,
    status: source.status,
    ascentType: source.ascentType || '',
    date: source.date || '',
    attempts: source.attempts || entry.attemptLog || [],
    route: createRouteSnapshot(entry),
    archivedAt: new Date().toISOString()
  });
  if (!record) return null;
  return { ...record, id: record.id || createAscentArchiveId(record) };
}

function mergeAscentArchiveRecords(existingRecords, newRecords) {
  const byKey = new Map();
  [...(existingRecords || []), ...(newRecords || [])].forEach(rawRecord => {
    const record = normalizeAscentArchiveRecord(rawRecord);
    if (!record) return;
    const withId = { ...record, id: record.id || createAscentArchiveId(record) };
    byKey.set(createAscentArchiveKey(withId), withId);
  });
  return [...byKey.values()];
}

function syncProfileAscentArchiveFromEntries() {
  const records = [];
  (appState.routeEntries || []).forEach(entry => {
    (entry.cycleHistory || []).forEach(history => {
      const record = createAscentArchiveRecord(entry, history.cycle || appState.profile.currentCycle || 1, history);
      if (record) records.push(record);
    });
  });

  if (records.length === 0) return false;
  const previousLength = (appState.profile.ascentArchive || []).length;
  appState.profile.ascentArchive = mergeAscentArchiveRecords(appState.profile.ascentArchive, records);
  return appState.profile.ascentArchive.length !== previousLength;
}

function getPastMesoCycleSummaries() {
  const currentCycle = appState.profile.currentCycle || 1;
  const summaries = new Map();

  const ensureSummary = cycle => {
    if (!summaries.has(cycle)) {
      summaries.set(cycle, {
        cycle,
        ascents: 0,
        attempts: 0,
        routeKeys: new Set(),
        recordKeys: new Set()
      });
    }
    return summaries.get(cycle);
  };

  const addRecord = record => {
    const cycle = Math.max(1, Number(record.cycle) || 1);
    if (cycle >= currentCycle) return;
    const summary = ensureSummary(cycle);
    const route = record.route || record;
    const recordKey = [
      record.entryId || route.name || '',
      cycle,
      record.status || '',
      record.ascentType || '',
      record.date || '',
      route.grade || '',
      route.name || ''
    ].join('||').toLowerCase();
    if (summary.recordKeys.has(recordKey)) return;
    summary.recordKeys.add(recordKey);
    if (record.status === 'done') summary.ascents += 1;
    summary.attempts += (record.attempts || []).reduce((sum, attempt) => sum + attempt.count, 0);
    summary.routeKeys.add(String(record.entryId || route.name || '') + '|' + String(route.grade || ''));
  };

  (appState.profile.ascentArchive || [])
    .map(normalizeAscentArchiveRecord)
    .filter(Boolean)
    .forEach(addRecord);

  (appState.routeEntries || []).forEach(entry => {
    (entry.cycleHistory || []).forEach(history => {
      addRecord({
        entryId: entry.id,
        cycle: history.cycle,
        status: history.status,
        ascentType: history.ascentType,
        date: history.date || '',
        attempts: history.attempts || [],
        route: entry
      });
    });
  });

  return [...summaries.values()]
    .map(summary => ({
      cycle: summary.cycle,
      ascents: summary.ascents,
      attempts: summary.attempts,
      routes: summary.routeKeys.size
    }))
    .sort((left, right) => right.cycle - left.cycle);
}

function deletePastMesoCycle(cycleNum) {
  const cycle = Math.max(1, Number(cycleNum) || 0);
  const currentCycle = appState.profile.currentCycle || 1;
  if (!cycle || cycle >= currentCycle) return { ascents: 0, routes: 0 };
  const previousSummary = getPastMesoCycleSummaries().find(summary => summary.cycle === cycle)
    || { ascents: 0, routes: 0 };

  appState.profile.ascentArchive = (appState.profile.ascentArchive || []).filter(rawRecord => {
    const record = normalizeAscentArchiveRecord(rawRecord);
    if (!record || record.cycle !== cycle) return true;
    return false;
  });

  appState.routeEntries = appState.routeEntries.map(entry => {
    const originalLength = (entry.cycleHistory || []).length;
    const cycleHistory = (entry.cycleHistory || []).filter(history => {
      if (Number(history.cycle) !== cycle) return true;
      return false;
    });
    if (cycleHistory.length === originalLength) return entry;
    return { ...entry, cycleHistory, updatedAt: Date.now() };
  });

  persistAll();
  renderApp();
  return { ascents: previousSummary.ascents, routes: previousSummary.routes };
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
    routesetter: entry.routesetter,
    link: entry.link,
    webLink: entry.webLink,
    mobileLink: entry.mobileLink,
    primaryColor: entry.primaryColor,
    secondaryColor: entry.secondaryColor,
    status: entry.status,
    ascentType: entry.ascentType,
    source: entry.source,
    archived: entry.archived,
    attemptLog: entry.attemptLog,
    cycleHistory: entry.cycleHistory
  };
}

function shouldPersistEntry(entry) {
  if (entry.source === 'custom') return true;
  return entry.status !== 'open' || Boolean(entry.date) || (entry.attemptLog || []).length > 0 || (entry.cycleHistory || []).length > 0;
}

function startNewMesoCycle() {
  const cycleNum = appState.profile.currentCycle || 1;
  const archiveRecords = [];
  appState.routeEntries = appState.routeEntries.map(entry => {
    const hasActivity = entry.status === 'done' || (entry.attemptLog || []).length > 0;
    if (!hasActivity) return entry;
    const archiveRecord = createAscentArchiveRecord(entry, cycleNum);
    if (archiveRecord) archiveRecords.push(archiveRecord);
    return {
      ...entry,
      status: 'open',
      ascentType: '',
      date: '',
      attemptLog: [],
      updatedAt: Date.now(),
      cycleHistory: [
        ...(entry.cycleHistory || []),
        { cycle: cycleNum, status: entry.status, ascentType: entry.ascentType || '', date: entry.date || '', attempts: entry.attemptLog || [] }
      ]
    };
  });
  appState.profile.ascentArchive = mergeAscentArchiveRecords(appState.profile.ascentArchive, archiveRecords);
  appState.profile.currentCycle = cycleNum + 1;
  persistAll();
  initGradeFilter();
  renderApp();
}

function createEntryKey(entry) {
  if (entry.id) return entry.id;
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
        attemptLog: entry.attemptLog || [],
        cycleHistory: entry.cycleHistory || [],
        archived: false
      });
    } else {
      const autoArchive = entry.source === 'hall' && entry.status === 'done';
      customEntries.push({ ...entry, source: 'custom', archived: entry.archived || autoArchive });
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

function getGradeBaseNumber(grade) {
  const match = String(grade || '').trim().match(/^(\d+)/);
  return match ? Number(match[1]) : null;
}

function getRoadmapGrades() {
  const start = Number(appState.profile.startGrade || APP_CONFIG.defaultProfile.startGrade);
  const redpointMax = getGradeBaseNumber(appState.profile.redpointMaxGrade || APP_CONFIG.defaultProfile.redpointMaxGrade);
  const end = Math.max(start, (redpointMax || Number(APP_CONFIG.defaultProfile.redpointMaxGrade)) + 1);
  const grades = [];
  for (let grade = start; grade <= end; grade += 1) {
    grades.push(String(grade));
  }
  return grades;
}

function isRouteNew(entry) {
  if (!entry.setDate) return false;
  const diffDays = (Date.now() - new Date(entry.setDate + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24);
  return diffDays <= 28;
}

function getTrackedEntries() {
  return appState.routeEntries.filter(entry => {
    if (entry.archived) return false;
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

function getTotalAttempts(entry) {
  return (entry.attemptLog || []).reduce((sum, s) => sum + s.count, 0);
}

function sortEntries(entries, sortBy, sortDir) {
  const dir = sortDir === 'desc' ? -1 : 1;

  if (!sortBy) {
    return [...entries].sort((left, right) => {
      const ld = left.setDate || '￿';
      const rd = right.setDate || '￿';
      if (ld !== rd) return ld < rd ? -1 : 1;
      const byGrade = Number(left.grade) - Number(right.grade);
      if (byGrade !== 0) return byGrade;
      return left.name.localeCompare(right.name, 'de', { sensitivity: 'base' });
    });
  }

  return [...entries].sort((left, right) => {
    let diff = 0;
    switch (sortBy) {
      case 'grad':
        diff = Number(left.grade) - Number(right.grade);
        break;
      case 'setDate': {
        const ld = left.setDate || '';
        const rd = right.setDate || '';
        diff = ld < rd ? -1 : ld > rd ? 1 : 0;
        break;
      }
      case 'route': {
        diff = (left.name || '').localeCompare(right.name || '', 'de', { sensitivity: 'base' });
        break;
      }
      case 'bereich':
        diff = (left.location || '').localeCompare(right.location || '', 'de', { sensitivity: 'base' });
        break;
      case 'infos': {
        const lr = getRopeNumber(left) ?? Infinity;
        const rr = getRopeNumber(right) ?? Infinity;
        diff = lr - rr;
        break;
      }
      case 'status':
        diff = getStatusPriority(left) - getStatusPriority(right);
        break;
    }
    if (diff === 0) {
      const byGrade = Number(left.grade) - Number(right.grade);
      if (byGrade !== 0) return byGrade;
      return left.name.localeCompare(right.name, 'de', { sensitivity: 'base' });
    }
    return diff * dir;
  });
}

function getAvailableGrades(summaries) {
  return summaries.map(summary => summary.grade);
}

function sanitizeSelectedGrades(availableGrades) {
  const availableSet = new Set(availableGrades);
  appState.filters.grades = appState.filters.grades.filter(grade => availableSet.has(grade));
}

function getFocusFilterGrades(progressState = getComputedState().progressState) {
  const grades = [];
  if (progressState.current) grades.push(progressState.current.grade);
  if (progressState.canStartNext && progressState.next) grades.push(progressState.next.grade);
  return grades;
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

  const { sortBy, sortDir } = appState.profile.tablePrefs || {};
  return sortEntries(getTrackedEntries(), sortBy, sortDir).filter(entry => {
    const matchesSearch = !searchTerm
      || entry.name.toLowerCase().includes(searchTerm)
      || entry.location.toLowerCase().includes(searchTerm)
      || entry.routeCode.toLowerCase().includes(searchTerm)
      || entry.rawDifficulty.toLowerCase().includes(searchTerm)
      || entry.notes.toLowerCase().includes(searchTerm)
      || entry.routesetter.toLowerCase().includes(searchTerm);

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
