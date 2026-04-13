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
import {
  loadDashboardMeta,
  loadRemoteCollections,
  loadRemoteOperationalState,
  syncRemoteCollections,
  syncRemoteOperationalState,
} from "./remote-store.js";
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

function getManagedOperationalState(state = {}) {
  return {
    focus: {
      mission: String(state.focus?.mission || "").trim(),
      weekFocus: String(state.focus?.weekFocus || "").trim(),
    },
    todayAction: String(state.todayAction || "").trim(),
    currentMode: String(state.currentMode || "operacion").trim() || "operacion",
    boss: {
      title: String(state.boss?.title || "").trim(),
      note: String(state.boss?.note || "").trim(),
    },
    priorities: Array.isArray(state.priorities)
      ? state.priorities.map((priority) => ({ ...priority }))
      : [],
    focusBlocks: Array.isArray(state.focusBlocks)
      ? state.focusBlocks.map((focusBlock) => ({ ...focusBlock }))
      : [],
    reviews: state.reviews
      ? {
        daily: { ...(state.reviews.daily || {}) },
        weekly: { ...(state.reviews.weekly || {}) },
        monthly: { ...(state.reviews.monthly || {}) },
      }
      : null,
    moneyGoal: state.moneyGoal ? { ...state.moneyGoal } : null,
  };
}

function hasRemoteCollectionData(remoteState = {}) {
  return ["ideas", "outputs", "projects"].some(
    (collectionName) => Array.isArray(remoteState[collectionName]) && remoteState[collectionName].length > 0
  );
}

function hasRemoteOperationalData(remoteState = {}) {
  const remoteMeta = remoteState.meta || {};

  return Boolean(
    remoteMeta.focusExists
    || remoteMeta.operationExists
    || remoteMeta.reviewsExists
    || remoteMeta.moneyExists
    || remoteMeta.prioritiesCount
    || remoteMeta.focusBlocksCount
  );
}

function hasCompletedBaseMigration(meta = {}) {
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

function hasRemoteOperationAuthority(meta = {}) {
  return Boolean(meta?.migration?.operationLayer?.status === "completed" || meta?.operationSnapshot);
}

function mergeRemoteOperationalState(baseState, remoteState, options = {}) {
  const hasRemoteAuthority = Boolean(options.hasRemoteAuthority);
  const emptyFocus = { mission: "", weekFocus: "" };
  const emptyReviews = {
    daily: { answerOne: "", answerTwo: "", answerThree: "", updatedAt: "" },
    weekly: { answerOne: "", answerTwo: "", answerThree: "", updatedAt: "" },
    monthly: { answerOne: "", answerTwo: "", answerThree: "", updatedAt: "" },
  };
  const emptyMoneyGoal = {
    name: "",
    targetAmount: 0,
    note: "",
    updatedAt: "",
  };

  return {
    ...baseState,
    focus: remoteState.meta?.focusExists || hasRemoteAuthority
      ? (remoteState.focus || emptyFocus)
      : baseState.focus,
    todayAction: remoteState.meta?.operationExists || hasRemoteAuthority
      ? remoteState.todayAction
      : baseState.todayAction,
    currentMode: remoteState.meta?.operationExists || hasRemoteAuthority
      ? remoteState.currentMode
      : baseState.currentMode,
    boss: remoteState.meta?.operationExists || hasRemoteAuthority
      ? remoteState.boss
      : baseState.boss,
    priorities: remoteState.meta?.prioritiesCount || hasRemoteAuthority
      ? remoteState.priorities
      : baseState.priorities,
    focusBlocks: remoteState.meta?.focusBlocksCount || hasRemoteAuthority
      ? remoteState.focusBlocks
      : baseState.focusBlocks,
    reviews: remoteState.meta?.reviewsExists || hasRemoteAuthority
      ? (remoteState.reviews || emptyReviews)
      : baseState.reviews,
    moneyGoal: remoteState.meta?.moneyExists || hasRemoteAuthority
      ? (remoteState.moneyGoal || emptyMoneyGoal)
      : baseState.moneyGoal,
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
      message: "Leyendo datos remotos para la base y la capa operativa...",
    });

    const [remoteCollections, remoteOperationalState, dashboardMeta] = await Promise.all([
      loadRemoteCollections(user.uid),
      loadRemoteOperationalState(user.uid),
      loadDashboardMeta(user.uid),
    ]);

    const hasRemoteBaseState =
      hasRemoteCollectionData(remoteCollections) || hasCompletedBaseMigration(dashboardMeta);
    const hasRemoteOperationState =
      hasRemoteOperationalData(remoteOperationalState) || hasRemoteOperationAuthority(dashboardMeta);

    if (!hasRemoteBaseState && !hasRemoteOperationState) {
      notifyStore({
        type: "load",
        status: "idle",
        mode,
        message: "Aun no hay datos remotos migrados. Se mantiene el snapshot local.",
        meta: dashboardMeta,
      });
      return localState;
    }

    let nextState = localState;

    if (hasRemoteBaseState) {
      nextState = mergeRemoteManagedCollections(nextState, remoteCollections);
    }

    if (hasRemoteOperationState) {
      nextState = mergeRemoteOperationalState(nextState, remoteOperationalState, {
        hasRemoteAuthority: hasRemoteOperationAuthority(dashboardMeta),
      });
    }

    notifyStore({
      type: "load",
      status: "success",
      mode,
      message: "Base y capa operativa cargadas desde Firestore.",
      meta: dashboardMeta,
    });
    return nextState;
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
  const managedOperationalState = getManagedOperationalState(serializableState);

  remoteSyncQueue = remoteSyncQueue
    .catch(() => {})
    .then(async () => {
      notifyStore({
        type: "save",
        status: "syncing",
        mode,
        message: "Sincronizando base y capa operativa en Firestore...",
      });
      await Promise.all([
        syncRemoteCollections(user.uid, managedCollections),
        syncRemoteOperationalState(user.uid, managedOperationalState),
      ]);
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
