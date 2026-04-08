/*
  Entry point del navegador.
  Hidrata el estado, conecta eventos y pinta la app modular.
*/

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

replaceAppState(loadState());
initializeCollapsibleSections();
initializeWorkspaceViews();

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
