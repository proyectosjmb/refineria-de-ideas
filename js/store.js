/*
  Orquestador de persistencia.
  Permite trabajar en modo local, dual o remoto sin romper la app actual.
*/

import { PERSISTENCE_MODES, STORAGE_KEY } from "./config.js";
import {
  createSerializableAppState,
  loadAppStateFromLocalStorage,
  readLocalStorageItem,
  saveAppStateToLocalStorage,
  writeLocalStorageItem,
} from "./local-store.js";
import { loadDashboardMeta, loadRemoteCollections, syncRemoteCollections } from "./remote-store.js";
import { sessionState } from "./state.js";

const PERSISTENCE_MODE_STORAGE_KEY = `${STORAGE_KEY}-persistence-mode-v1`;
const storeListeners = new Set();
let remoteSyncQueue = Promise.resolve();

function notifyStore(event) {
  storeListeners.forEach((listener) => {
    try {
      listener(event);
    } catch (error) {
      console.warn("Un listener del store fallo.", error);
    }
  });
}

function getManagedCollections(state = {}) {
  return {
    ideas: Array.isArray(state.ideas) ? state.ideas.map((idea) => ({ ...idea })) : [],
    outputs: Array.isArray(state.outputs) ? state.outputs.map((output) => ({ ...output })) : [],
    projects: Array.isArray(state.projects) ? state.projects.map((project) => ({ ...project })) : [],
  };
}

function hasRemoteData(remoteState = {}) {
  return ["ideas", "outputs", "projects"].some(
    (collectionName) => Array.isArray(remoteState[collectionName]) && remoteState[collectionName].length > 0
  );
}

function hasCompletedMigration(meta = {}) {
  return meta?.migration?.ideasOutputsProjects?.status === "completed";
}

function mergeRemoteManagedCollections(baseState, remoteState) {
  return {
    ...baseState,
    ideas: remoteState.ideas || [],
    outputs: remoteState.outputs || [],
    projects: remoteState.projects || [],
  };
}

export function subscribeToStore(listener) {
  storeListeners.add(listener);
  return () => {
    storeListeners.delete(listener);
  };
}

export function getPersistenceMode() {
  const rawMode = readLocalStorageItem(PERSISTENCE_MODE_STORAGE_KEY, "leer el modo de persistencia");
  return PERSISTENCE_MODES[rawMode] ? rawMode : "local";
}

export function setPersistenceMode(mode) {
  const nextMode = PERSISTENCE_MODES[mode] ? mode : "local";
  writeLocalStorageItem(
    PERSISTENCE_MODE_STORAGE_KEY,
    nextMode,
    "guardar el modo de persistencia"
  );
  notifyStore({
    type: "mode",
    status: "success",
    mode: nextMode,
    message: `Modo de persistencia: ${PERSISTENCE_MODES[nextMode].label}.`,
  });
  return nextMode;
}

export async function loadPersistedState({ user = sessionState.authUser, mode = getPersistenceMode() } = {}) {
  const localState = loadAppStateFromLocalStorage();

  if (!user || mode === "local") {
    return localState;
  }

  try {
    notifyStore({
      type: "load",
      status: "syncing",
      mode,
      message: "Leyendo datos remotos para ideas, salidas y proyectos...",
    });

    const [remoteState, dashboardMeta] = await Promise.all([
      loadRemoteCollections(user.uid),
      loadDashboardMeta(user.uid),
    ]);

    if (!hasRemoteData(remoteState) && !hasCompletedMigration(dashboardMeta)) {
      notifyStore({
        type: "load",
        status: "idle",
        mode,
        message: "Aun no hay datos remotos migrados. Se mantiene el snapshot local.",
        meta: dashboardMeta,
      });
      return localState;
    }

    notifyStore({
      type: "load",
      status: "success",
      mode,
      message: "Datos remotos cargados.",
      meta: dashboardMeta,
    });
    return mergeRemoteManagedCollections(localState, remoteState);
  } catch (error) {
    console.warn("No se pudo cargar el estado remoto. Se mantiene el snapshot local.", error);
    notifyStore({
      type: "load",
      status: "error",
      mode,
      message: "No se pudieron leer los datos remotos. Se mantiene el snapshot local.",
      error,
    });
    return localState;
  }
}

export function savePersistedState(
  state,
  { user = sessionState.authUser, mode = getPersistenceMode() } = {}
) {
  const serializableState = createSerializableAppState(state);
  const localSaveWorked = saveAppStateToLocalStorage(serializableState);

  if (!user || mode === "local") {
    return localSaveWorked;
  }

  const managedCollections = getManagedCollections(serializableState);

  remoteSyncQueue = remoteSyncQueue
    .catch(() => {})
    .then(async () => {
      notifyStore({
        type: "save",
        status: "syncing",
        mode,
        message: "Sincronizando ideas, salidas y proyectos en Firestore...",
      });
      await syncRemoteCollections(user.uid, managedCollections);
      notifyStore({
        type: "save",
        status: "success",
        mode,
        message: "Sincronizacion remota lista.",
      });
    })
    .catch((error) => {
      console.warn("No se pudo sincronizar el snapshot con Firestore.", error);
      notifyStore({
        type: "save",
        status: "error",
        mode,
        message: "Hubo un problema al sincronizar Firestore. El respaldo local sigue intacto.",
        error,
      });
    });

  return localSaveWorked;
}
