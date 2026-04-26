const APP_CONFIG = {
  storageVersion: 5,
  storageKeys: {
    routes: 'jdavRotpunkt.routes',
    profile: 'jdavRotpunkt.profile',
    meta: 'jdavRotpunkt.meta',
    theme: 'jdavRotpunkt.theme',
    githubSync: 'jdavRotpunkt.githubSync',
    routeNotifications: 'jdavRotpunkt.routeNotifications'
  },
  legacyKeys: {
    routes: 'jdavRotpunktRouteLog.v3.flash.defaultOpen',
    profile: 'jdavRotpunktRouteLog.v3.flash.defaultOpen.profile'
  },
  defaultProfile: {
    startGrade: '5',
    vorstiegOnly: false,
    tablePrefs: {
      columnOrder: ['grad', 'aktionen', 'infos', 'route', 'bereich'],
      hiddenColumns: [],
      sortBy: null,
      sortDir: 'asc'
    }
  },
  tableColumns: [
    { key: 'grad',     label: 'Grad',         sortable: true,  hideable: false },
    { key: 'aktionen', label: 'Aktionen',      sortable: false, hideable: false },
    { key: 'infos',    label: 'Infos',         sortable: true,  hideable: true  },
    { key: 'route',    label: 'Route',         sortable: true,  hideable: false },
    { key: 'bereich',  label: 'Bereich',       sortable: true,  hideable: true  },
    { key: 'versuche', label: 'Versuche',      sortable: true,  hideable: true, defaultHidden: true },
    { key: 'gesetzt',  label: 'Gesetzt am',    sortable: true,  hideable: true, defaultHidden: true },
    { key: 'zuletzt',  label: 'Zuletzt aktiv', sortable: true,  hideable: true, defaultHidden: true }
  ],
  allowedStartGrades: ['4', '5', '6'],
  roadmapGrades: ['5', '6', '7', '8'],
  hiddenGrades: new Set(['3']),
  vorstiegMandatoryRanges: [[18, 34], [47, 50]],
  vorstiegOptionalRanges: [[51, 56]],
  firebaseConfig: {
    apiKey: 'AIzaSyCyXeMjZy81orV5S2_wbxVsArmhgeoFe8M',
    authDomain: 'jdav-rotpunkt-training.firebaseapp.com',
    projectId: 'jdav-rotpunkt-training',
    storageBucket: 'jdav-rotpunkt-training.firebasestorage.app',
    messagingSenderId: '447221192678',
    appId: '1:447221192678:web:05a71d1f72d199b0902827'
  },
  githubSync: {
    owner: 'lukas-jdav',
    repo: 'rotpunkt-training',
    workflowId: 'sync-tivoli-routes.yml',
    ref: 'main'
  },
  routeNotifications: {
    summaryJsonPath: 'data/latest-route-sync.json',
    pollIntervalMs: 15 * 60 * 1000
  }
};

const APP_VERSION = 'v2.5.3';
const APP_BUILD_DATE = '2026-04-23';

const SUN_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="4" fill="currentColor"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const MOON_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" fill="currentColor"/></svg>';
