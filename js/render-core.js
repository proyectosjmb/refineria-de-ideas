/*
  Render base del dashboard, formularios simples y orquestacion general.
*/

import {
  COPILOT_OPTIONS,
  DEFAULT_COPILOT_PHRASE,
  MAX_ACTIVE_FOCUS_BLOCKS,
  MAX_ACTIVE_PRIORITIES,
  MAX_ACTIVE_PROJECTS,
  OPERATION_MODES,
  PERSISTENCE_MODES,
  REVIEW_CONFIG,
} from "./config.js";
import { elements } from "./dom.js";
import {
  appState,
  getActiveFocusBlocksCount,
  getActivePrioritiesCount,
  getActiveProjectsCount,
  getFinanceSummary,
  getMoneyGoalProgress,
  sessionState,
  uiState,
} from "./state.js";
import {
  escapeHtml,
  formatCurrency,
  formatDate,
  getModeLabel,
} from "./utils.js";
import {
  renderMoneyGoal,
  renderMoneyMovements,
} from "./render-finance.js";
import {
  renderBoss,
  renderFocusBlocks,
  renderPriorities,
  renderProjects,
} from "./render-operacion.js";
import {
  renderIdeas,
  renderInboxFilters,
  renderOutputs,
} from "./render-ideas.js";
import {
  renderIdeaDetailPanel,
  renderOutputEditPanel,
  renderProcessPanel,
  renderProjectEditPanel,
} from "./panels.js";

function setTextIfPresent(target, value) {
  if (target) {
    target.textContent = value;
  }
}

function getAuthStatusLabel() {
  if (!sessionState.firebaseConfigured) {
    return "Config pendiente";
  }

  if (!sessionState.authReady) {
    return "Conectando";
  }

  return sessionState.authUser ? "Sesion activa" : "Sin sesion";
}

function getMigrationSummary() {
  const migrationMeta = sessionState.migrationMeta?.migration?.ideasOutputsProjects;

  if (!migrationMeta) {
    return "Aun no hay una marca remota de migracion para ideas, salidas y proyectos.";
  }

  const migratedAt = migrationMeta.migratedAt ? formatDate(migrationMeta.migratedAt) : "sin fecha";
  const counts = migrationMeta.counts || {};

  return `Migracion ${migrationMeta.status || "registrada"} | ${migratedAt} | ideas ${counts.ideas || 0} | salidas ${counts.outputs || 0} | proyectos ${counts.projects || 0}`;
}

export function renderAuthPanel() {
  const selectedMode = PERSISTENCE_MODES[sessionState.persistenceMode] || PERSISTENCE_MODES.local;
  const storeMessage = sessionState.storeMessage || "Sin tareas remotas pendientes.";

  setTextIfPresent(elements.authStatusPill, getAuthStatusLabel());
  setTextIfPresent(elements.authStatusText, storeMessage);
  setTextIfPresent(elements.authUserEmail, sessionState.authUser?.email || "Sin sesion");
  setTextIfPresent(elements.authModeHelp, selectedMode.helpText);
  setTextIfPresent(elements.authFeedback, sessionState.authFeedback || "");
  setTextIfPresent(elements.authMigrationMeta, getMigrationSummary());

  if (elements.authFeedback) {
    elements.authFeedback.classList.toggle("is-visible", Boolean(sessionState.authFeedback));
    elements.authFeedback.dataset.feedbackType = sessionState.authFeedbackType || "info";
  }

  if (elements.authStatusPill) {
    elements.authStatusPill.dataset.authState = sessionState.authUser ? "signed-in" : "signed-out";
  }

  if (elements.persistenceModeSelect) {
    elements.persistenceModeSelect.value = sessionState.persistenceMode;
    elements.persistenceModeSelect.disabled = sessionState.authBusy || sessionState.migrationBusy;
  }

  if (elements.authEmailField) {
    elements.authEmailField.disabled = sessionState.authBusy || sessionState.migrationBusy;
  }

  if (elements.authPasswordField) {
    elements.authPasswordField.disabled = sessionState.authBusy || sessionState.migrationBusy;
  }

  if (elements.authLoginButton) {
    elements.authLoginButton.disabled =
      !sessionState.firebaseConfigured || sessionState.authBusy || sessionState.migrationBusy;
  }

  if (elements.authRegisterButton) {
    elements.authRegisterButton.disabled =
      !sessionState.firebaseConfigured || sessionState.authBusy || sessionState.migrationBusy;
  }

  if (elements.authLogoutButton) {
    elements.authLogoutButton.hidden = !sessionState.authUser;
    elements.authLogoutButton.disabled = sessionState.authBusy || sessionState.migrationBusy;
  }

  if (elements.authMigrationButton) {
    elements.authMigrationButton.disabled =
      !sessionState.firebaseConfigured
      || !sessionState.authUser
      || sessionState.authBusy
      || sessionState.migrationBusy;
    elements.authMigrationButton.textContent = sessionState.migrationBusy
      ? "Migrando..."
      : "Migrar ideas, salidas y proyectos";
  }
}

export function renderFocus() {
  elements.focusMissionField.value = appState.focus.mission || "";
  elements.focusWeekField.value = appState.focus.weekFocus || "";
}

function getDaySeed() {
  const today = new Date();
  const startOfYear = new Date(today.getFullYear(), 0, 0);
  const diff = today - startOfYear;
  return Math.floor(diff / 86400000);
}

function getDashboardGuideTheme() {
  if (uiState.dashboardActionState === "completed") {
    return { tone: "mint" };
  }

  if (uiState.dashboardTodayActionPaused && appState.todayAction) {
    return { tone: "sky" };
  }

  if (!appState.todayAction) {
    return { tone: "amber" };
  }

  const themes = [{ tone: "mint" }, { tone: "sky" }, { tone: "amber" }];

  return themes[getDaySeed() % themes.length];
}

function getSelectedCopilot() {
  return COPILOT_OPTIONS.find((copilot) => copilot.id === appState.copilot?.type) || COPILOT_OPTIONS[0];
}

function getCopilotPhrase() {
  return String(appState.copilot?.phrase || "").trim() || DEFAULT_COPILOT_PHRASE;
}

function animateGuideRefreshIfNeeded(guideTheme, copilot) {
  const nextGuideKey = `${guideTheme.tone}:${copilot.type}:${copilot.phrase}`;

  if (uiState.dashboardGuideKey === nextGuideKey) {
    return;
  }

  uiState.dashboardGuideKey = nextGuideKey;

  if (!elements.dashboardGuideCard) {
    return;
  }

  if (!elements.dashboardGuideCard.dataset.hasRendered) {
    elements.dashboardGuideCard.dataset.hasRendered = "true";
    return;
  }

  elements.dashboardGuideCard.classList.remove("is-refreshing");
  void elements.dashboardGuideCard.offsetWidth;
  elements.dashboardGuideCard.classList.add("is-refreshing");
}

export function renderDashboard() {
  const financeSummary = getFinanceSummary();
  const moneyGoalProgress = getMoneyGoalProgress();
  const moneyGoalText = appState.moneyGoal.name
    ? `${appState.moneyGoal.name} - ${formatCurrency(moneyGoalProgress.targetAmount)}`
    : "Sin meta visible";
  const missionText = appState.focus.mission || "Define una misión";
  const weekFocusText = appState.focus.weekFocus || "Define un foco semanal";
  const todayActionText = appState.todayAction || "Define una acción clave";
  const currentModeText = getModeLabel(appState.currentMode);
  const activeProjectsText = `${getActiveProjectsCount()} / ${MAX_ACTIVE_PROJECTS}`;
  const activePrioritiesText = `${getActivePrioritiesCount()} / ${MAX_ACTIVE_PRIORITIES}`;
  const activeFocusBlocksText = `${getActiveFocusBlocksCount()} / ${MAX_ACTIVE_FOCUS_BLOCKS}`;
  const bossText = appState.boss.title || "Sin fricción visible";
  const moneyProgressText = `${moneyGoalProgress.progressPercent.toFixed(0)}%`;
  const pendingMoneyText = formatCurrency(financeSummary.pending);
  const guideTheme = getDashboardGuideTheme();
  const selectedCopilot = getSelectedCopilot();
  const copilotPhrase = getCopilotPhrase();
  const hasTodayAction = Boolean(appState.todayAction);
  const isTodayActionPaused = hasTodayAction && uiState.dashboardTodayActionPaused;
  const isActionCompleted = uiState.dashboardActionState === "completed";
  const actionStatusText = isActionCompleted
    ? "COMPLETADA"
    : !hasTodayAction
      ? "SIN DEFINIR"
      : isTodayActionPaused
        ? "EN PAUSA"
        : "EN MARCHA";
  const actionDisplayText = isActionCompleted && !hasTodayAction
    ? uiState.dashboardLastCompletedText || "Acción completada"
    : todayActionText;
  const actionSupportText = isActionCompleted
    ? "Avance registrado. El sistema ya libero espacio para el siguiente paso."
    : isTodayActionPaused
      ? "Sigue presente, pero con menos empuje hasta que la retomes."
      : "La pieza más importante para mover hoy.";
  const detailContextText = appState.focus.weekFocus || missionText;
  const detailLoadText = `${getActiveProjectsCount()} proyectos / ${getActivePrioritiesCount()} prioridades`;

  animateGuideRefreshIfNeeded(guideTheme, {
    type: selectedCopilot.id,
    phrase: copilotPhrase,
  });

  setTextIfPresent(elements.dashboardMission, missionText);
  setTextIfPresent(elements.dashboardWeekFocus, weekFocusText);
  setTextIfPresent(elements.dashboardTodayAction, actionDisplayText);
  setTextIfPresent(elements.dashboardMode, currentModeText);
  setTextIfPresent(elements.dashboardActiveProjects, activeProjectsText);
  setTextIfPresent(elements.dashboardActivePriorities, activePrioritiesText);
  setTextIfPresent(elements.dashboardFocusBlocks, activeFocusBlocksText);
  setTextIfPresent(elements.dashboardBoss, bossText);
  setTextIfPresent(elements.dashboardMoneyGoal, moneyGoalText);
  setTextIfPresent(elements.dashboardMoneyProgress, moneyProgressText);
  setTextIfPresent(elements.dashboardPendingMoney, pendingMoneyText);
  setTextIfPresent(elements.dashboardMiniMission, missionText);
  setTextIfPresent(elements.dashboardMiniWeekFocus, weekFocusText);
  setTextIfPresent(elements.dashboardMiniTodayAction, todayActionText);
  setTextIfPresent(elements.dashboardMiniMode, currentModeText);
  setTextIfPresent(elements.dashboardMiniActiveProjects, activeProjectsText);
  setTextIfPresent(elements.dashboardMiniActivePriorities, activePrioritiesText);
  setTextIfPresent(elements.dashboardMiniFocusBlocks, activeFocusBlocksText);
  setTextIfPresent(elements.dashboardMiniMoneyProgress, moneyProgressText);
  setTextIfPresent(elements.dashboardGuideRole, selectedCopilot.name);
  setTextIfPresent(elements.dashboardGuidePhrase, copilotPhrase);
  setTextIfPresent(elements.dashboardActionStatus, actionStatusText);
  setTextIfPresent(elements.dashboardActionSupport, actionSupportText);
  setTextIfPresent(elements.dashboardActionFeedback, uiState.dashboardActionFeedback || "");
  setTextIfPresent(elements.dashboardActionContext, detailContextText);
  setTextIfPresent(elements.dashboardActionMode, currentModeText);
  setTextIfPresent(elements.dashboardActionBoss, bossText);
  setTextIfPresent(elements.dashboardActionLoad, detailLoadText);

  if (elements.dashboardPanel) {
    elements.dashboardPanel.dataset.guideTone = guideTheme.tone;
  }

  if (elements.dashboardGuideCard) {
    elements.dashboardGuideCard.dataset.guideTone = guideTheme.tone;
  }

  if (elements.dashboardGuideImage) {
    elements.dashboardGuideImage.src = selectedCopilot.src;
    elements.dashboardGuideImage.alt = selectedCopilot.alt;
  }

  if (elements.dashboardGuidePresence) {
    elements.dashboardGuidePresence.setAttribute("aria-expanded", String(uiState.isCopilotEditorOpen));
  }

  if (elements.dashboardGuideEditButton) {
    elements.dashboardGuideEditButton.setAttribute("aria-expanded", String(uiState.isCopilotEditorOpen));
  }

  if (elements.dashboardGuideEditor) {
    elements.dashboardGuideEditor.hidden = !uiState.isCopilotEditorOpen;
  }

  if (elements.dashboardGuidePhraseInput && document.activeElement !== elements.dashboardGuidePhraseInput) {
    elements.dashboardGuidePhraseInput.value = copilotPhrase;
  }

  if (elements.dashboardGuideTypeSelect) {
    elements.dashboardGuideTypeSelect.innerHTML = COPILOT_OPTIONS.map((copilot) => `
      <option value="${escapeHtml(copilot.id)}"${copilot.id === selectedCopilot.id ? " selected" : ""}>
        ${escapeHtml(copilot.name)}
      </option>
    `).join("");
  }

  if (elements.dashboardActionCard) {
    elements.dashboardActionCard.dataset.guideTone = guideTheme.tone;
    elements.dashboardActionCard.dataset.actionState = isActionCompleted
      ? "completed"
      : isTodayActionPaused
        ? "paused"
        : hasTodayAction
          ? "active"
          : "idle";
    elements.dashboardActionCard.classList.toggle("is-paused", isTodayActionPaused);
    elements.dashboardActionCard.classList.toggle("is-completed", isActionCompleted);
  }

  if (elements.dashboardCompleteActionButton) {
    elements.dashboardCompleteActionButton.disabled = !hasTodayAction || isActionCompleted;
    elements.dashboardCompleteActionButton.textContent = isActionCompleted ? "Completado" : "Completar";
    elements.dashboardCompleteActionButton.classList.toggle("is-confirmed", isActionCompleted);
  }

  if (elements.dashboardPauseActionButton) {
    elements.dashboardPauseActionButton.disabled = !hasTodayAction || isActionCompleted;
    elements.dashboardPauseActionButton.textContent = isTodayActionPaused ? "Reanudar" : "Pausar";
    elements.dashboardPauseActionButton.classList.toggle("is-muted", isTodayActionPaused);
  }

  if (elements.dashboardDetailsActionButton) {
    elements.dashboardDetailsActionButton.textContent = uiState.dashboardActionDetailsOpen ? "Ocultar detalles" : "Ver detalles";
    elements.dashboardDetailsActionButton.setAttribute("aria-expanded", String(uiState.dashboardActionDetailsOpen));
    elements.dashboardDetailsActionButton.classList.toggle("is-open", uiState.dashboardActionDetailsOpen);
  }

  if (elements.dashboardActionDetails) {
    elements.dashboardActionDetails.classList.toggle("is-open", uiState.dashboardActionDetailsOpen);
    elements.dashboardActionDetails.setAttribute("aria-hidden", String(!uiState.dashboardActionDetailsOpen));
  }

  if (elements.dashboardActionFeedback) {
    elements.dashboardActionFeedback.classList.toggle("is-visible", Boolean(uiState.dashboardActionFeedback));
  }
}

export function renderTodayAction() {
  elements.todayActionField.value = appState.todayAction || "";
}

export function renderModes() {
  elements.modeOptions.forEach((button) => {
    const isActive = button.dataset.mode === appState.currentMode;
    button.classList.toggle("is-active", isActive);
  });
}

function clearModeEmphasisState(element) {
  if (!element) {
    return;
  }

  element.classList.remove("mode-featured", "mode-muted", "mode-strategic");
}

function setModeEmphasisState(element, className) {
  if (!element) {
    return;
  }

  clearModeEmphasisState(element);

  if (className) {
    element.classList.add(className);
  }
}

export function renderModeStatus() {
  const currentMode = OPERATION_MODES[appState.currentMode] || OPERATION_MODES.operacion;

  if (!elements.modeStatusCard) {
    return;
  }

  elements.modeStatusCard.dataset.mode = appState.currentMode;
  elements.modeStatusPill.textContent = currentMode.label;
  elements.modeStatusTitle.textContent = currentMode.label;
  elements.modeStatusDescription.textContent = currentMode.description;
  elements.modeStatusMessage.textContent = currentMode.message;
  elements.modeStatusFocus.innerHTML = currentMode.focus
    .map((focusItem) => `<span class="mode-state-chip">${escapeHtml(focusItem)}</span>`)
    .join("");
}

export function applyModeVisualState() {
  document.body.dataset.mode = appState.currentMode;

  const panelStateTargets = [
    elements.focusPanel,
    elements.todayPanel,
    elements.modePanel,
    elements.prioritiesPanel,
    elements.focusBlocksPanel,
    elements.bossPanel,
    elements.projectsPanel,
    elements.dashboardMissionCard,
    elements.dashboardWeekFocusCard,
    elements.dashboardTodayActionCard,
    elements.dashboardModeCard,
    elements.dashboardProjectsCard,
    elements.dashboardPrioritiesCard,
    elements.dashboardFocusBlocksCard,
    elements.dashboardBossCard,
  ];

  panelStateTargets.forEach(clearModeEmphasisState);

  if (appState.currentMode === "supervivencia") {
    setModeEmphasisState(elements.focusPanel, "mode-featured");
    setModeEmphasisState(elements.todayPanel, "mode-featured");
    setModeEmphasisState(elements.bossPanel, "mode-featured");
    setModeEmphasisState(elements.prioritiesPanel, "mode-featured");
    setModeEmphasisState(elements.focusBlocksPanel, "mode-featured");
    setModeEmphasisState(elements.projectsPanel, "mode-muted");
    setModeEmphasisState(elements.dashboardMissionCard, "mode-featured");
    setModeEmphasisState(elements.dashboardTodayActionCard, "mode-featured");
    setModeEmphasisState(elements.dashboardBossCard, "mode-featured");
    setModeEmphasisState(elements.dashboardProjectsCard, "mode-muted");
    return;
  }

  if (appState.currentMode === "avance") {
    setModeEmphasisState(elements.focusPanel, "mode-strategic");
    setModeEmphasisState(elements.todayPanel, "mode-strategic");
    setModeEmphasisState(elements.projectsPanel, "mode-strategic");
    setModeEmphasisState(elements.focusBlocksPanel, "mode-strategic");
    setModeEmphasisState(elements.dashboardWeekFocusCard, "mode-strategic");
    setModeEmphasisState(elements.dashboardTodayActionCard, "mode-strategic");
    setModeEmphasisState(elements.dashboardProjectsCard, "mode-strategic");
    return;
  }

  setModeEmphasisState(elements.modePanel, "mode-featured");
  setModeEmphasisState(elements.dashboardModeCard, "mode-featured");
}

export function renderReviewLatestCard(reviewType) {
  const reviewEntry = appState.reviews[reviewType];
  const containerMap = {
    daily: elements.reviewDailyLatest,
    weekly: elements.reviewWeeklyLatest,
    monthly: elements.reviewMonthlyLatest,
  };
  const container = containerMap[reviewType];

  if (!reviewEntry || !reviewEntry.updatedAt) {
    container.innerHTML = `<p class="latest-empty">Todavía no guardas una revisión de este tipo.</p>`;
    return;
  }

  container.innerHTML = `
    <span class="mini-card-badge"><strong>Actualizada</strong> ${escapeHtml(formatDate(reviewEntry.updatedAt))}</span>
    <p>${escapeHtml(reviewEntry.answerOne)}</p>
    <p>${escapeHtml(reviewEntry.answerTwo)}</p>
    <p>${escapeHtml(reviewEntry.answerThree)}</p>
  `;
}

export function renderReviews() {
  const currentReviewType = uiState.activeReviewTab;
  const currentReviewConfig = REVIEW_CONFIG[currentReviewType];
  const currentReview = appState.reviews[currentReviewType];

  elements.reviewTabs.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.reviewTab === currentReviewType);
  });

  elements.reviewQuestionOne.textContent = currentReviewConfig.questionOne;
  elements.reviewQuestionTwo.textContent = currentReviewConfig.questionTwo;
  elements.reviewQuestionThree.textContent = currentReviewConfig.questionThree;
  elements.reviewAnswerOne.placeholder = currentReviewConfig.placeholderOne;
  elements.reviewAnswerTwo.placeholder = currentReviewConfig.placeholderTwo;
  elements.reviewAnswerThree.placeholder = currentReviewConfig.placeholderThree;
  elements.reviewAnswerOne.value = currentReview.answerOne || "";
  elements.reviewAnswerTwo.value = currentReview.answerTwo || "";
  elements.reviewAnswerThree.value = currentReview.answerThree || "";

  renderReviewLatestCard("daily");
  renderReviewLatestCard("weekly");
  renderReviewLatestCard("monthly");
}

export function renderCounters() {
  elements.ideasCounter.textContent = `${appState.ideas.length} ideas`;
  elements.outputsCounter.textContent = `${appState.outputs.length} salidas`;
}

export function renderApp() {
  renderAuthPanel();
  renderDashboard();
  renderModes();
  renderModeStatus();
  applyModeVisualState();
  renderMoneyGoal();
  renderMoneyMovements();
  renderPriorities();
  renderFocusBlocks();
  renderBoss();
  renderReviews();
  renderProjects();
  renderInboxFilters(uiState.activeIdeaFilter, uiState.ideaSearchText, elements.statusFilterButtons);
  renderIdeas();
  renderOutputs();
  renderCounters();
  renderProcessPanel();
  renderIdeaDetailPanel();
  renderOutputEditPanel();
  renderProjectEditPanel();
}

