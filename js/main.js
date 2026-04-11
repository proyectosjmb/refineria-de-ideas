/*
  Entry point del navegador.
  Hidrata el estado, conecta eventos y pinta la app modular.
*/

import { bindAuthEvents, initializeAuthState } from "./handlers-auth.js";
import {
  bindCoreEvents,
  initializeCollapsibleSections,
  initializeWorkspaceViews,
} from "./handlers-core.js";
import { bindFinanceEvents } from "./handlers-finance.js";
import { bindIdeasEvents } from "./handlers-ideas.js";
import { bindOperacionEvents } from "./handlers-operacion.js";
import {
  renderApp,
  renderFocus,
  renderTodayAction,
} from "./render-core.js";
import { replaceAppState } from "./state.js";
import { loadState } from "./storage.js";
import {
  resetMoneyMovementForm,
  setBossSaveButtonState,
  setFocusBlockSaveButtonState,
  setFocusSaveButtonState,
  setModeFeedback,
  setMoneyGoalSaveButtonState,
  setMoneyMovementSaveButtonState,
  setOutputSaveButtonState,
  setPrioritySaveButtonState,
  setProjectEditSaveButtonState,
  setProjectFeedback,
  setReviewSaveButtonState,
  setTodayActionSaveButtonState,
} from "./ui-helpers.js";

async function bootstrapApp() {
  replaceAppState(await loadState());
  initializeCollapsibleSections();
  initializeWorkspaceViews();

  bindAuthEvents();
  bindCoreEvents();
  bindFinanceEvents();
  bindIdeasEvents();
  bindOperacionEvents();

  resetMoneyMovementForm();
  setFocusSaveButtonState(false);
  setTodayActionSaveButtonState(false);
  setMoneyGoalSaveButtonState(false);
  setMoneyMovementSaveButtonState(false);
  setProjectEditSaveButtonState(false);
  setPrioritySaveButtonState(false);
  setFocusBlockSaveButtonState(false);
  setBossSaveButtonState(false);
  setReviewSaveButtonState(false);
  setOutputSaveButtonState(false);
  setModeFeedback("");
  setProjectFeedback("");

  renderFocus();
  renderTodayAction();
  renderApp();
  await initializeAuthState();
}

bootstrapApp().catch((error) => {
  console.error("No se pudo iniciar la app.", error);
});
