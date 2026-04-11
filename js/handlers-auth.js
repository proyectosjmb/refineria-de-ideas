/*
  Handlers de autenticacion y control del modo de persistencia.
*/

import { elements } from "./dom.js";
import {
  getFirebaseSetupMessage,
  isFirebaseConfigured,
  loginWithEmail,
  logoutCurrentUser,
  observeAuthState,
  registerWithEmail,
} from "./firebase.js";
import { migrateLocalCollectionsToRemote } from "./migration.js";
import { loadDashboardMeta } from "./remote-store.js";
import { renderApp } from "./render-core.js";
import { replaceAppState, sessionState, appState } from "./state.js";
import { getPersistenceMode, setPersistenceMode, subscribeToStore } from "./store.js";
import { loadState } from "./storage.js";

let unsubscribeStore = null;

function setAuthFeedback(message = "", type = "info") {
  sessionState.authFeedback = message;
  sessionState.authFeedbackType = type;
}

async function refreshMigrationMeta() {
  if (!sessionState.authUser || !sessionState.firebaseConfigured) {
    sessionState.migrationMeta = null;
    return;
  }

  try {
    sessionState.migrationMeta = await loadDashboardMeta(sessionState.authUser.uid);
  } catch (error) {
    console.warn("No se pudo leer la meta de migracion del usuario.", error);
    sessionState.migrationMeta = null;
  }
}

async function rehydrateAppForSession() {
  const nextState = await loadState({
    user: sessionState.authUser,
    mode: sessionState.persistenceMode,
  });

  replaceAppState(nextState);
}

function getEmailAndPassword() {
  const email = String(elements.authEmailField?.value || "").trim();
  const password = String(elements.authPasswordField?.value || "").trim();

  if (!email) {
    elements.authEmailField?.focus();
    throw new Error("Escribe tu correo.");
  }

  if (!password) {
    elements.authPasswordField?.focus();
    throw new Error("Escribe tu contrasena.");
  }

  return { email, password };
}

function getModeLabel(mode) {
  if (mode === "dual") {
    return "dual";
  }

  if (mode === "remote") {
    return "remoto";
  }

  return "local";
}

export async function initializeAuthState() {
  sessionState.firebaseConfigured = isFirebaseConfigured();
  sessionState.persistenceMode = getPersistenceMode();

  if (unsubscribeStore) {
    unsubscribeStore();
    unsubscribeStore = null;
  }

  unsubscribeStore = subscribeToStore((event) => {
    sessionState.storeStatus = event.status || "idle";
    sessionState.storeMessage = event.message || "";

    if (event.meta) {
      sessionState.migrationMeta = event.meta;
    }

    renderApp();
  });

  observeAuthState(async (user) => {
    sessionState.authReady = true;
    sessionState.authUser = user;
    sessionState.firebaseConfigured = isFirebaseConfigured();

    await refreshMigrationMeta();
    await rehydrateAppForSession();

    if (user?.email) {
      setAuthFeedback(`Sesion iniciada como ${user.email}.`, "success");
    } else if (sessionState.firebaseConfigured) {
      setAuthFeedback("Sin sesion activa. La app sigue usando el snapshot local.", "info");
    } else {
      setAuthFeedback(getFirebaseSetupMessage(), "warning");
    }

    renderApp();
  });
}

export async function handleAuthSubmit(event) {
  event.preventDefault();

  if (!sessionState.firebaseConfigured) {
    setAuthFeedback(getFirebaseSetupMessage(), "warning");
    renderApp();
    return;
  }

  const action = event.submitter?.dataset.authAction || "login";

  try {
    const { email, password } = getEmailAndPassword();
    sessionState.authBusy = true;
    setAuthFeedback(
      action === "register" ? "Creando tu cuenta..." : "Abriendo tu sesion...",
      "info"
    );
    renderApp();

    if (action === "register") {
      await registerWithEmail(email, password);
    } else {
      await loginWithEmail(email, password);
    }

    elements.authPasswordField.value = "";
  } catch (error) {
    setAuthFeedback(error.message || "No fue posible autenticarte.", "error");
  } finally {
    sessionState.authBusy = false;
    renderApp();
  }
}

export async function handleLogoutClick() {
  try {
    sessionState.authBusy = true;
    setAuthFeedback("Cerrando sesion...", "info");
    renderApp();
    await logoutCurrentUser();
  } catch (error) {
    setAuthFeedback(error.message || "No fue posible cerrar sesion.", "error");
  } finally {
    sessionState.authBusy = false;
    renderApp();
  }
}

export async function handlePersistenceModeChange(event) {
  const nextMode = setPersistenceMode(event.target.value);
  sessionState.persistenceMode = nextMode;
  setAuthFeedback(`Modo ${getModeLabel(nextMode)} activado.`, "success");
  renderApp();

  await refreshMigrationMeta();
  await rehydrateAppForSession();

  if (nextMode !== "local" && !sessionState.authUser) {
    setAuthFeedback("Inicia sesion para que dual o remoto usen Firestore.", "warning");
  }

  renderApp();
}

export async function handleMigrationClick() {
  if (!sessionState.authUser) {
    setAuthFeedback("Necesitas una sesion activa para migrar a Firestore.", "warning");
    renderApp();
    return;
  }

  if (!sessionState.firebaseConfigured) {
    setAuthFeedback(getFirebaseSetupMessage(), "warning");
    renderApp();
    return;
  }

  try {
    sessionState.migrationBusy = true;
    setAuthFeedback("Migrando ideas, salidas y proyectos a Firestore...", "info");
    renderApp();

    const migrationResult = await migrateLocalCollectionsToRemote({
      userId: sessionState.authUser.uid,
      localState: appState,
      persistenceMode: sessionState.persistenceMode,
    });

    sessionState.migrationMeta = migrationResult.meta;
    await rehydrateAppForSession();
    setAuthFeedback("Migracion completada. Firestore ya tiene tus ideas, salidas y proyectos.", "success");
  } catch (error) {
    setAuthFeedback(error.message || "La migracion no se pudo completar.", "error");
  } finally {
    sessionState.migrationBusy = false;
    renderApp();
  }
}

export function bindAuthEvents() {
  elements.authForm?.addEventListener("submit", handleAuthSubmit);
  elements.authLogoutButton?.addEventListener("click", handleLogoutClick);
  elements.persistenceModeSelect?.addEventListener("change", handlePersistenceModeChange);
  elements.authMigrationButton?.addEventListener("click", handleMigrationClick);
}
