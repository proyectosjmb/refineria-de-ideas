/*
  Handlers de finanzas: meta y movimientos.
*/

import { elements } from "./dom.js";
import { renderApp, renderDashboard } from "./render-core.js";
import { renderMoneyGoal } from "./render-finance.js";
import {
  appState,
  getMoneyMovementById,
  uiState,
} from "./state.js";
import { saveState } from "./storage.js";
import { createId, getTodayDateValue, parseMoneyAmount } from "./utils.js";
import {
  resetMoneyMovementForm,
  setFeedbackTimeout,
  setMoneyGoalSaveButtonState,
  setMoneyMovementSaveButtonState,
} from "./ui-helpers.js";

export function handleMoneyGoalSubmit(event) {
  event.preventDefault();

  const formData = new FormData(elements.moneyGoalForm);
  const targetAmount = parseMoneyAmount(formData.get("targetAmount"));

  appState.moneyGoal = {
    name: String(formData.get("name") || "").trim(),
    targetAmount,
    note: String(formData.get("note") || "").trim(),
    updatedAt: new Date().toISOString(),
  };

  saveState(appState);
  renderMoneyGoal();
  renderDashboard();
  setMoneyGoalSaveButtonState(true, "Meta guardada");
  setFeedbackTimeout("moneyGoal", () => {
    setMoneyGoalSaveButtonState(false);
  });
}

export function handleMoneyMovementSubmit(event) {
  event.preventDefault();

  const formData = new FormData(elements.moneyMovementForm);
  const movementAmount = parseMoneyAmount(formData.get("amount"));
  const movementConcept = String(formData.get("concept") || "").trim();
  const movementDate = String(formData.get("date") || "").trim();
  const currentMovement = getMoneyMovementById(uiState.editingMoneyMovementId);

  if (!movementConcept) {
    elements.moneyMovementConceptField.focus();
    return;
  }

  if (movementAmount <= 0) {
    setMoneyMovementSaveButtonState(true, "La cantidad debe ser mayor a cero.", true);
    elements.moneyMovementAmountField.focus();
    return;
  }

  if (!movementDate) {
    elements.moneyMovementDateField.focus();
    return;
  }

  if (currentMovement) {
    currentMovement.type = String(formData.get("type") || "ingreso").trim();
    currentMovement.concept = movementConcept;
    currentMovement.amount = movementAmount;
    currentMovement.date = movementDate;
    currentMovement.note = String(formData.get("note") || "").trim();
    currentMovement.updatedAt = new Date().toISOString();
  } else {
    appState.moneyMovements.push({
      id: createId("money-movement"),
      type: String(formData.get("type") || "ingreso").trim(),
      concept: movementConcept,
      amount: movementAmount,
      date: movementDate,
      note: String(formData.get("note") || "").trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  saveState(appState);
  renderApp();
  resetMoneyMovementForm();
  setMoneyMovementSaveButtonState(true, currentMovement ? "Movimiento actualizado" : "Movimiento guardado");
  setFeedbackTimeout("moneyMovement", () => {
    setMoneyMovementSaveButtonState(false);
  });
}

export function startMoneyMovementEdit(movementId) {
  const movement = getMoneyMovementById(movementId);

  if (!movement) {
    return;
  }

  uiState.editingMoneyMovementId = movementId;
  elements.moneyMovementTypeField.value = movement.type || "ingreso";
  elements.moneyMovementConceptField.value = movement.concept || "";
  elements.moneyMovementAmountField.value = String(parseMoneyAmount(movement.amount));
  elements.moneyMovementDateField.value = movement.date || getTodayDateValue();
  elements.moneyMovementNoteField.value = movement.note || "";
  elements.cancelMoneyMovementEditButton.hidden = false;
  elements.saveMoneyMovementButton.textContent = "Actualizar movimiento";
  elements.moneyMovementConceptField.focus();
}

export function cancelMoneyMovementEdit() {
  resetMoneyMovementForm();
}

export function handleMoneyMovementsListClick(event) {
  const actionButton = event.target.closest("[data-money-movement-action]");

  if (!actionButton) {
    return;
  }

  const movementId = actionButton.dataset.moneyMovementId;
  const action = actionButton.dataset.moneyMovementAction;
  const movement = getMoneyMovementById(movementId);

  if (!movement) {
    return;
  }

  if (action === "edit") {
    startMoneyMovementEdit(movementId);
    return;
  }

  if (action === "delete") {
    appState.moneyMovements = appState.moneyMovements.filter(
      (currentMovement) => currentMovement.id !== movementId
    );

    if (uiState.editingMoneyMovementId === movementId) {
      resetMoneyMovementForm();
    }

    saveState(appState);
    renderApp();
    setMoneyMovementSaveButtonState(true, "Movimiento eliminado");
    setFeedbackTimeout("moneyMovement", () => {
      setMoneyMovementSaveButtonState(false);
    });
  }
}

export function bindFinanceEvents() {
  elements.moneyGoalForm.addEventListener("submit", handleMoneyGoalSubmit);
  elements.moneyMovementForm.addEventListener("submit", handleMoneyMovementSubmit);
  elements.cancelMoneyMovementEditButton.addEventListener("click", cancelMoneyMovementEdit);
  elements.moneyMovementsList.addEventListener("click", handleMoneyMovementsListClick);
}
