/*
  Fachada de almacenamiento.
  Mantiene la API actual para la app y delega la persistencia de datos al store.
*/

import {
  loadActiveAppView,
  loadCopilotPreferences,
  loadSectionLayout,
  saveActiveAppView,
  saveCopilotPreferences,
  saveSectionLayout,
} from "./local-store.js";
import { loadPersistedState, savePersistedState } from "./store.js";

export async function loadState(options = {}) {
  return loadPersistedState(options);
}

export function saveState(state, options = {}) {
  return savePersistedState(state, options);
}

export {
  loadActiveAppView,
  loadCopilotPreferences,
  loadSectionLayout,
  saveActiveAppView,
  saveCopilotPreferences,
  saveSectionLayout,
};
