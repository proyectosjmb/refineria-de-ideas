/*
  Helpers de interfaz: feedback, resets y visibilidad de paneles.
  Se mantienen juntos porque comparten DOM y uiState.
*/

import { elements } from "./dom.js";
import { uiState } from "./state.js";
import { getTodayDateValue } from "./utils.js";

const feedbackTimeouts = {
  focus: null,
  todayAction: null,
  mode: null,
  project: null,
  output: null,
  projectEdit: null,
  priority: null,
  focusBlock: null,
  boss: null,
  review: null,
  moneyGoal: null,
  moneyMovement: null,
  dashboardAction: null,
  dashboardActionState: null,
  dashboardGuide: null,
  companionPanel: null,
  ideas: null,
  ideaDetail: null,
};

export function clearFeedbackTimeout(name) {
  if (feedbackTimeouts[name]) {
    clearTimeout(feedbackTimeouts[name]);
  }
}

export function setFeedbackTimeout(name, callback, delay = 1800) {
  clearFeedbackTimeout(name);
  feedbackTimeouts[name] = window.setTimeout(callback, delay);
}

export function setConditionalSelectFieldVisibility(selectField, customWrapper, customField) {
  const shouldShowCustomField = selectField.value === "otro";

  customWrapper.hidden = !shouldShowCustomField;
  customField.required = shouldShowCustomField;

  if (!shouldShowCustomField) {
    customField.value = "";
  }
}

export function setProcessPanelVisibility(isOpen) {
  elements.processPanel.classList.toggle("is-open", isOpen);
  elements.processPanel.setAttribute("aria-hidden", String(!isOpen));
  updateBodyScrollState();
}

export function setIdeaDetailPanelVisibility(isOpen) {
  elements.ideaDetailPanel.classList.toggle("is-open", isOpen);
  elements.ideaDetailPanel.setAttribute("aria-hidden", String(!isOpen));
  updateBodyScrollState();
}

export function setDashboardCollectionDetailPanelVisibility(isOpen) {
  if (!elements.dashboardCollectionDetailPanel) {
    return;
  }

  elements.dashboardCollectionDetailPanel.classList.toggle("is-open", isOpen);
  elements.dashboardCollectionDetailPanel.setAttribute("aria-hidden", String(!isOpen));
  updateBodyScrollState();
}

export function setOutputEditPanelVisibility(isOpen) {
  elements.outputEditPanel.classList.toggle("is-open", isOpen);
  elements.outputEditPanel.setAttribute("aria-hidden", String(!isOpen));
  updateBodyScrollState();
}

export function setProjectEditPanelVisibility(isOpen) {
  elements.projectEditPanel.classList.toggle("is-open", isOpen);
  elements.projectEditPanel.setAttribute("aria-hidden", String(!isOpen));
  updateBodyScrollState();
}

export function setCompanionPanelVisibility(isOpen) {
  if (!elements.companionPanel) {
    return;
  }

  elements.companionPanel.classList.toggle("is-open", isOpen);
  elements.companionPanel.setAttribute("aria-hidden", String(!isOpen));
  updateBodyScrollState();
}

export function updateBodyScrollState() {
  const isAnyPanelOpen =
    uiState.processingIdeaId
    || uiState.viewingIdeaId
    || uiState.dashboardCollectionDetailType
    || uiState.editingOutputId
    || uiState.editingProjectId
    || uiState.activatingProjectOutputId
    || uiState.isCopilotEditorOpen;
  document.body.style.overflow = isAnyPanelOpen ? "hidden" : "";
}

export function setFocusSaveButtonState(isSaved) {
  const defaultLabel = elements.focusSaveButton.dataset.defaultLabel || "Guardar enfoque";

  if (isSaved) {
    elements.focusSaveButton.textContent = "Guardado";
    elements.focusSaveButton.classList.add("is-saved");
    return;
  }

  elements.focusSaveButton.textContent = defaultLabel;
  elements.focusSaveButton.classList.remove("is-saved");
}

export function setTodayActionSaveButtonState(isSaved, feedbackText = "") {
  const defaultLabel = elements.saveTodayActionButton.dataset.defaultLabel || "Guardar acción";

  if (isSaved) {
    elements.saveTodayActionButton.textContent = "Guardada";
    elements.saveTodayActionButton.classList.add("is-saved");
    elements.todayActionFeedback.textContent = feedbackText || "Acción guardada";
    elements.todayActionFeedback.classList.add("is-visible");
    elements.todayActionFeedback.classList.remove("is-error");
    return;
  }

  elements.saveTodayActionButton.textContent = defaultLabel;
  elements.saveTodayActionButton.classList.remove("is-saved");
  elements.todayActionFeedback.textContent = "";
  elements.todayActionFeedback.classList.remove("is-visible", "is-error");
}

export function setModeFeedback(message = "") {
  elements.modeFeedback.textContent = message;
  elements.modeFeedback.classList.toggle("is-visible", Boolean(message));
}

export function setProjectFeedback(message = "", type = "success") {
  elements.projectFeedback.textContent = message;
  elements.projectFeedback.classList.toggle("is-visible", Boolean(message));
  elements.projectFeedback.classList.toggle("is-error", type === "error");
}

export function setPrioritySaveButtonState(isSaved, feedbackText = "", isError = false) {
  const defaultLabel = elements.savePriorityButton.dataset.defaultLabel || "Guardar prioridad";

  if (isSaved) {
    elements.savePriorityButton.textContent = isError ? defaultLabel : "Guardada";
    elements.savePriorityButton.classList.toggle("is-saved", !isError);
    elements.priorityFeedback.textContent = feedbackText;
    elements.priorityFeedback.classList.toggle("is-visible", Boolean(feedbackText));
    elements.priorityFeedback.classList.toggle("is-error", isError);
    return;
  }

  elements.savePriorityButton.textContent = defaultLabel;
  elements.savePriorityButton.classList.remove("is-saved");
  elements.priorityFeedback.textContent = "";
  elements.priorityFeedback.classList.remove("is-visible", "is-error");
}

export function setFocusBlockSaveButtonState(isSaved, feedbackText = "", isError = false) {
  const defaultLabel = elements.saveFocusBlockButton.dataset.defaultLabel || "Guardar bloque";

  if (isSaved) {
    elements.saveFocusBlockButton.textContent = isError ? defaultLabel : "Guardado";
    elements.saveFocusBlockButton.classList.toggle("is-saved", !isError);
    elements.focusBlockFeedback.textContent = feedbackText;
    elements.focusBlockFeedback.classList.toggle("is-visible", Boolean(feedbackText));
    elements.focusBlockFeedback.classList.toggle("is-error", isError);
    return;
  }

  elements.saveFocusBlockButton.textContent = defaultLabel;
  elements.saveFocusBlockButton.classList.remove("is-saved");
  elements.focusBlockFeedback.textContent = "";
  elements.focusBlockFeedback.classList.remove("is-visible", "is-error");
}

export function setBossSaveButtonState(isSaved, feedbackText = "") {
  const defaultLabel = elements.saveBossButton.dataset.defaultLabel || "Guardar jefe actual";

  if (isSaved) {
    elements.saveBossButton.textContent = "Guardado";
    elements.saveBossButton.classList.add("is-saved");
    elements.bossFeedback.textContent = feedbackText || "Jefe actual guardado";
    elements.bossFeedback.classList.add("is-visible");
    elements.bossFeedback.classList.remove("is-error");
    return;
  }

  elements.saveBossButton.textContent = defaultLabel;
  elements.saveBossButton.classList.remove("is-saved");
  elements.bossFeedback.textContent = "";
  elements.bossFeedback.classList.remove("is-visible", "is-error");
}

export function setReviewSaveButtonState(isSaved, feedbackText = "") {
  const defaultLabel = elements.saveReviewButton.dataset.defaultLabel || "Guardar revisión";

  if (isSaved) {
    elements.saveReviewButton.textContent = "Guardada";
    elements.saveReviewButton.classList.add("is-saved");
    elements.reviewFeedback.textContent = feedbackText || "Revisión guardada";
    elements.reviewFeedback.classList.add("is-visible");
    elements.reviewFeedback.classList.remove("is-error");
    return;
  }

  elements.saveReviewButton.textContent = defaultLabel;
  elements.saveReviewButton.classList.remove("is-saved");
  elements.reviewFeedback.textContent = "";
  elements.reviewFeedback.classList.remove("is-visible", "is-error");
}

export function setMoneyGoalSaveButtonState(isSaved, feedbackText = "") {
  const defaultLabel = elements.saveMoneyGoalButton.dataset.defaultLabel || "Guardar meta";

  if (isSaved) {
    elements.saveMoneyGoalButton.textContent = "Guardada";
    elements.saveMoneyGoalButton.classList.add("is-saved");
    elements.moneyGoalFeedback.textContent = feedbackText || "Meta guardada";
    elements.moneyGoalFeedback.classList.add("is-visible");
    elements.moneyGoalFeedback.classList.remove("is-error");
    return;
  }

  elements.saveMoneyGoalButton.textContent = defaultLabel;
  elements.saveMoneyGoalButton.classList.remove("is-saved");
  elements.moneyGoalFeedback.textContent = "";
  elements.moneyGoalFeedback.classList.remove("is-visible", "is-error");
}

export function setMoneyMovementSaveButtonState(isSaved, feedbackText = "", isError = false) {
  const createLabel = elements.saveMoneyMovementButton.dataset.defaultLabel || "Guardar movimiento";
  const defaultLabel = uiState.editingMoneyMovementId ? "Actualizar movimiento" : createLabel;

  if (isSaved) {
    elements.saveMoneyMovementButton.textContent = isError ? defaultLabel : "Guardado";
    elements.saveMoneyMovementButton.classList.toggle("is-saved", !isError);
    elements.moneyMovementFeedback.textContent = feedbackText;
    elements.moneyMovementFeedback.classList.toggle("is-visible", Boolean(feedbackText));
    elements.moneyMovementFeedback.classList.toggle("is-error", isError);
    return;
  }

  elements.saveMoneyMovementButton.textContent = defaultLabel;
  elements.saveMoneyMovementButton.classList.remove("is-saved");
  elements.moneyMovementFeedback.textContent = "";
  elements.moneyMovementFeedback.classList.remove("is-visible", "is-error");
}

export function setOutputSaveButtonState(isSaved, feedbackText = "", isError = false) {
  const defaultLabel = elements.saveOutputEditButton.dataset.defaultLabel || "Guardar cambios";

  if (isSaved) {
    elements.saveOutputEditButton.textContent = isError ? defaultLabel : "Guardado";
    elements.saveOutputEditButton.classList.toggle("is-saved", !isError);
    elements.outputEditFeedback.textContent = feedbackText || "Cambios guardados";
    elements.outputEditFeedback.classList.add("is-visible");
    elements.outputEditFeedback.classList.toggle("is-error", isError);
    return;
  }

  elements.saveOutputEditButton.textContent = defaultLabel;
  elements.saveOutputEditButton.classList.remove("is-saved");
  elements.outputEditFeedback.textContent = "";
  elements.outputEditFeedback.classList.remove("is-visible", "is-error");
}

export function setProjectEditSaveButtonState(isSaved, feedbackText = "", isError = false) {
  const defaultLabel = elements.saveProjectEditButton.dataset.defaultLabel || "Guardar cambios";

  if (isSaved) {
    elements.saveProjectEditButton.textContent = isError ? defaultLabel : "Guardado";
    elements.saveProjectEditButton.classList.toggle("is-saved", !isError);
    elements.projectEditFeedback.textContent = feedbackText;
    elements.projectEditFeedback.classList.toggle("is-visible", Boolean(feedbackText));
    elements.projectEditFeedback.classList.toggle("is-error", isError);
    return;
  }

  elements.saveProjectEditButton.textContent = defaultLabel;
  elements.saveProjectEditButton.classList.remove("is-saved");
  elements.projectEditFeedback.textContent = "";
  elements.projectEditFeedback.classList.remove("is-visible", "is-error");
}

export function resetProcessForm() {
  elements.processForm.reset();
  setConditionalSelectFieldVisibility(
    elements.problemField,
    elements.problemCustomFieldWrapper,
    elements.problemCustomField
  );
  setConditionalSelectFieldVisibility(
    elements.purposeField,
    elements.purposeCustomFieldWrapper,
    elements.purposeCustomField
  );
  setConditionalSelectFieldVisibility(
    elements.areaField,
    elements.areaCustomFieldWrapper,
    elements.areaCustomField
  );
  setConditionalSelectFieldVisibility(
    elements.timingField,
    elements.timingCustomFieldWrapper,
    elements.timingCustomField
  );
}

export function resetOutputEditForm() {
  elements.outputEditForm.reset();
  setConditionalSelectFieldVisibility(
    elements.editOutputProblemField,
    elements.editOutputProblemCustomFieldWrapper,
    elements.editOutputProblemCustomField
  );
  setConditionalSelectFieldVisibility(
    elements.editOutputPurposeField,
    elements.editOutputPurposeCustomFieldWrapper,
    elements.editOutputPurposeCustomField
  );
  setConditionalSelectFieldVisibility(
    elements.editOutputAreaField,
    elements.editOutputAreaCustomFieldWrapper,
    elements.editOutputAreaCustomField
  );
  setConditionalSelectFieldVisibility(
    elements.editOutputTimingField,
    elements.editOutputTimingCustomFieldWrapper,
    elements.editOutputTimingCustomField
  );
  elements.editOutputTypeField.disabled = false;
  if (elements.editOutputTypeLockNote) {
    elements.editOutputTypeLockNote.hidden = true;
  }
  setOutputSaveButtonState(false);
}

export function resetPriorityForm() {
  elements.priorityForm.reset();
  uiState.editingPriorityId = null;
  elements.cancelPriorityEditButton.hidden = true;
  setPrioritySaveButtonState(false);
}

export function resetFocusBlockForm() {
  elements.focusBlockForm.reset();
  uiState.editingFocusBlockId = null;
  elements.focusBlockStatusField.value = "pendiente";
  elements.cancelFocusBlockEditButton.hidden = true;
  setFocusBlockSaveButtonState(false);
}

export function resetMoneyMovementForm() {
  elements.moneyMovementForm.reset();
  uiState.editingMoneyMovementId = null;
  elements.moneyMovementTypeField.value = "ingreso";
  elements.moneyMovementDateField.value = getTodayDateValue();
  elements.cancelMoneyMovementEditButton.hidden = true;
  setMoneyMovementSaveButtonState(false);
}

export function resetProjectEditForm() {
  elements.projectEditForm.reset();
  setConditionalSelectFieldVisibility(
    elements.editProjectAreaField,
    elements.editProjectAreaCustomFieldWrapper,
    elements.editProjectAreaCustomField
  );
  setProjectEditSaveButtonState(false);
}
