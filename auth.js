function initFirebase() {
  try {
    if (!window.firebase || APP_CONFIG.firebaseConfig.apiKey === 'DEINE_API_KEY') {
      appState.authReady = false;
      return;
    }
    if (!firebase.apps.length) firebase.initializeApp(APP_CONFIG.firebaseConfig);
    FIREBASE_STATE.auth = firebase.auth();
    FIREBASE_STATE.db = firebase.firestore();
    appState.authReady = true;

    FIREBASE_STATE.auth.getRedirectResult()
      .then(result => {
        if (result && result.user) {
          appState.currentUser = result.user;
          renderAuthUI();
        }
      })
      .catch(error => {
        if (error && error.code) {
          console.error('Redirect-Result-Fehler:', error.code, error.message);
          alert(getReadableAuthError(error));
        }
      });

    FIREBASE_STATE.auth.onAuthStateChanged(async user => {
      appState.currentUser = user;
      renderAuthUI();
      if (!user) {
        appState.syncStatus = 'local';
        appState.routeEntries = loadRouteEntries();
        appState.profile = loadProfile();
        renderApp();
        return;
      }

      appState.syncStatus = 'syncing';
      renderSettingsModal();
      try {
        const doc = await FIREBASE_STATE.db
          .collection('users').doc(user.uid)
          .collection('data').doc('routes')
          .get();

        if (doc.exists) {
          const data = doc.data() || {};
          const cloudEntries = Array.isArray(data.entries) ? data.entries.map(normalizeEntry).filter(Boolean) : [];
          appState.routeEntries = mergeRouteEntries(cloudEntries);
          if (data.profile && typeof data.profile === 'object') {
            appState.profile = sanitizeProfile({ ...APP_CONFIG.defaultProfile, ...data.profile });
            persistProfile(false);
          }
        } else {
          await writeCloudSnapshot();
        }

        appState.syncStatus = 'synced';
      } catch (error) {
        console.error('Cloud sync failed:', error);
        appState.syncStatus = 'error';
      }

      persistRoutes(false);
      renderApp();
    });
  } catch (error) {
    console.warn('Firebase init error:', error);
    appState.authReady = false;
  }
}

async function signInWithGoogle() {
  if (!FIREBASE_STATE.auth) {
    alert('Google-Login ist momentan nicht verfügbar. Bitte Seite neu laden.');
    return;
  }

  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  try {
    await FIREBASE_STATE.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
  } catch (error) {
    console.warn('Persistence konnte nicht gesetzt werden:', error);
  }

  const preferRedirect = window.matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');

  if (preferRedirect) {
    try {
      await FIREBASE_STATE.auth.signInWithRedirect(provider);
      return;
    } catch (error) {
      console.error('Redirect-Login:', error);
      alert(getReadableAuthError(error));
      return;
    }
  }

  try {
    await FIREBASE_STATE.auth.signInWithPopup(provider);
  } catch (error) {
    console.error('Popup-Login:', error);
    const fallbackCodes = new Set(['auth/popup-blocked', 'auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/web-storage-unsupported']);
    if (fallbackCodes.has(error && error.code)) {
      try {
        await FIREBASE_STATE.auth.signInWithRedirect(provider);
        return;
      } catch (redirectError) {
        console.error('Redirect-Fallback:', redirectError);
        alert(getReadableAuthError(redirectError));
        return;
      }
    }
    alert(getReadableAuthError(error));
  }
}

function signOut() {
  if (!FIREBASE_STATE.auth) return;
  FIREBASE_STATE.auth.signOut();
}

function getReadableAuthError(error) {
  const code = error && error.code ? String(error.code) : '';
  if (code === 'auth/popup-blocked') return 'Der Popup-Login wurde blockiert. Es wird automatisch auf Redirect umgestellt.';
  if (code === 'auth/popup-closed-by-user') return 'Das Login-Fenster wurde geschlossen, bevor die Anmeldung abgeschlossen war.';
  if (code === 'auth/cancelled-popup-request') return 'Es läuft bereits ein anderer Login-Versuch. Bitte versuche es erneut.';
  if (code === 'auth/unauthorized-domain') return 'Domain nicht autorisiert. In der Firebase Console unter Authentication → Settings → Authorized domains muss "lukas-jdav.github.io" eingetragen sein.';
  if (code === 'auth/web-storage-unsupported') return 'Der Browser unterstützt den nötigen Web-Speicher für den Login nicht vollständig.';
  if (code === 'auth/network-request-failed') return 'Die Anmeldung ist an einem Netzwerkproblem gescheitert.';
  if (code === 'auth/operation-not-allowed') return 'Google-Login ist in Firebase nicht aktiviert. Authentication → Sign-in method → Google aktivieren.';
  const msg = error && (error.message || error.code) ? String(error.message || error.code) : '';
  return (code ? `[${code}] ` : '') + (msg || 'Unbekannter Fehler beim Google-Login.');
}
