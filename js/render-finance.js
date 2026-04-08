/*
  Render especifico de la capa financiera.
*/

import { elements } from "./dom.js";
import {
  appState,
  getFinanceSummary,
  getMoneyGoalProgress,
  getMoneyMovementsSorted,
} from "./state.js";
import {
  escapeHtml,
  formatCurrency,
  formatShortDate,
  normalizeText,
  parseMoneyAmount,
} from "./utils.js";

export function renderMoneyGoal() {
  const financeSummary = getFinanceSummary();
  const moneyGoalProgress = getMoneyGoalProgress();
  const hasSavedGoal =
    Boolean(appState.moneyGoal.name) ||
    Boolean(appState.moneyGoal.note) ||
    Boolean(appState.moneyGoal.updatedAt) ||
    moneyGoalProgress.targetAmount > 0;

  elements.moneyGoalNameField.value = appState.moneyGoal.name || "";
  elements.moneyGoalAmountField.value = hasSavedGoal ? String(appState.moneyGoal.targetAmount) : "";
  elements.moneyGoalNoteField.value = appState.moneyGoal.note || "";

  elements.financeTotalIncome.textContent = formatCurrency(financeSummary.income);
  elements.financeTotalExpense.textContent = formatCurrency(financeSummary.expense);
  elements.financeTotalPending.textContent = formatCurrency(financeSummary.pending);
  elements.financeBalance.textContent = formatCurrency(financeSummary.balance);
  elements.moneyProgressAmount.textContent = `${formatCurrency(moneyGoalProgress.currentIncome)} de ${formatCurrency(moneyGoalProgress.targetAmount)}`;
  elements.moneyProgressPercent.textContent = `${moneyGoalProgress.progressPercent.toFixed(0)}%`;
  elements.moneyProgressFill.style.width = `${moneyGoalProgress.progressPercent}%`;

  if (!appState.moneyGoal.name || moneyGoalProgress.targetAmount <= 0) {
    elements.moneyGoalCaption.textContent = "Define una meta y registra ingresos para ver avance básico.";
    return;
  }

  elements.moneyGoalCaption.textContent =
    `${appState.moneyGoal.name}: llevas ${formatCurrency(moneyGoalProgress.currentIncome)} y tienes ${formatCurrency(moneyGoalProgress.pendingAmount)} en cobros pendientes.`;
}

export function renderMoneyMovements() {
  const moneyMovements = getMoneyMovementsSorted();

  if (moneyMovements.length === 0) {
    elements.moneyMovementsList.innerHTML = `
      <article class="empty-state">
        <h3>Aún no registras movimientos</h3>
        <p>
          Agrega ingresos, gastos o cobros pendientes para ver una lectura financiera simple y útil.
        </p>
      </article>
    `;
    return;
  }

  elements.moneyMovementsList.innerHTML = moneyMovements
    .map((movement) => {
      const typeClass = `money-type-${normalizeText(movement.type).replace(/\s+/g, "-")}`;
      const noteBlock = movement.note
        ? `<p class="mini-card-text">${escapeHtml(movement.note)}</p>`
        : "";

      return `
        <article class="mini-card money-movement-card">
          <div class="money-movement-top">
            <div class="mini-card-body">
              <h3 class="mini-card-title">${escapeHtml(movement.concept)}</h3>
              ${noteBlock}
            </div>
            <strong class="money-movement-amount">${escapeHtml(formatCurrency(parseMoneyAmount(movement.amount)))}</strong>
          </div>

          <div class="mini-card-meta">
            <span class="money-type-badge ${typeClass}">${escapeHtml(movement.type)}</span>
            <span class="mini-card-badge"><strong>Fecha</strong> ${escapeHtml(formatShortDate(movement.date))}</span>
          </div>

          <div class="mini-card-actions">
            <button class="project-action-button" type="button" data-money-movement-action="edit" data-money-movement-id="${movement.id}">
              Editar
            </button>
            <button class="project-action-button project-action-danger" type="button" data-money-movement-action="delete" data-money-movement-id="${movement.id}">
              Eliminar
            </button>
          </div>
        </article>
      `;
    })
    .join("");
}
