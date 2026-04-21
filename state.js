const appState = {
  routeEntries: [],
  currentUser: null,
  profile: { ...APP_CONFIG.defaultProfile },
  filters: {
    search: '',
    grades: [],
    status: 'open'
  },
  syncStatus: 'local',
  authReady: false
};

const FIREBASE_STATE = {
  db: null,
  auth: null
};

const ui = {
  tabs: document.querySelectorAll('[data-tab-target]'),
  panels: document.querySelectorAll('.tab-panel'),
  themeToggle: document.getElementById('theme-toggle'),
  settingsToggle: document.getElementById('settings-toggle'),
  settingsModal: document.getElementById('settings-modal'),
  settingsClose: document.getElementById('settings-close'),
  authUi: document.getElementById('auth-ui'),
  routeBoard: document.getElementById('route-board'),
  routeLogForm: document.getElementById('route-log-form'),
  formFeedback: document.getElementById('form-feedback'),
  routeSearch: document.getElementById('route-search'),
  routeGradeChips: document.getElementById('route-grade-chips'),
  routeStatusFilter: document.getElementById('route-status-filter'),
  focusGradeValue: document.getElementById('focus-grade-value'),
  focusGradeNote: document.getElementById('focus-grade-note'),
  metricOpenRoutes: document.getElementById('metric-open-routes'),
  metricDoneRoutes: document.getElementById('metric-done-routes'),
  metricNextGrade: document.getElementById('metric-next-grade'),
  unlockMessage: document.getElementById('unlock-message'),
  unlockPill: document.getElementById('unlock-pill'),
  overallProgressLabel: document.getElementById('overall-progress-label'),
  overallProgressHint: document.getElementById('overall-progress-hint'),
  overallProgressFill: document.getElementById('overall-progress-fill'),
  roadmapGrid: document.getElementById('roadmap-grid'),
  roadmapMeta: document.getElementById('roadmap-meta'),
  settingsStartGrade: document.getElementById('settings-start-grade'),
  settingsVorstiegOnly: document.getElementById('settings-vorstieg-only'),
  settingsTheme: document.getElementById('settings-theme'),
  settingsLoginStatus: document.getElementById('settings-login-status'),
  settingsSyncStatus: document.getElementById('settings-sync-status'),
  settingsStorageStatus: document.getElementById('settings-storage-status'),
  settingsResetProgress: document.getElementById('settings-reset-progress'),
  statsPanel: document.getElementById('status-stats-panel')
};
