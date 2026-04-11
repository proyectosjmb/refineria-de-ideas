/*
  Estado compartido de la app.
  appState persiste; uiState solo vive durante la sesion abierta.
*/

import {
  COPILOT_OPTIONS,
  DEFAULT_COPILOT_PHRASE,
  DEFAULT_COPILOT_TYPE,
  MAX_ACTIVE_FOCUS_BLOCKS,
  MAX_ACTIVE_PRIORITIES,
  MAX_ACTIVE_PROJECTS,
} from "./config.js";
import {
  createId,
  parseMoneyAmount,
  normalizeText,
} from "./utils.js";

export function createInitialState() {
  const defaultCopilotType = COPILOT_OPTIONS.some((copilot) => copilot.id === DEFAULT_COPILOT_TYPE)
    ? DEFAULT_COPILOT_TYPE
    : COPILOT_OPTIONS[0]?.id || "cohete";

  return {
    ideas: [],
    outputs: [],
    focus: {
      mission: "",
      weekFocus: "",
    },
    todayAction: "",
    currentMode: "operacion",
    moneyGoal: {
      name: "",
      targetAmount: 0,
      note: "",
      updatedAt: "",
    },
    moneyMovements: [],
    priorities: [],
    focusBlocks: [],
    boss: {
      title: "",
      note: "",
    },
    copilot: {
      type: defaultCopilotType,
      phrase: DEFAULT_COPILOT_PHRASE,
    },
    reviews: {
      daily: {
        answerOne: "",
        answerTwo: "",
        answerThree: "",
        updatedAt: "",
      },
      weekly: {
        answerOne: "",
        answerTwo: "",
        answerThree: "",
        updatedAt: "",
      },
      monthly: {
        answerOne: "",
        answerTwo: "",
        answerThree: "",
        updatedAt: "",
      },
    },
    projects: [],
  };
}

export const appState = createInitialState();

export const sessionState = {
  authReady: false,
  authUser: null,
  authBusy: false,
  migrationBusy: false,
  firebaseConfigured: false,
  persistenceMode: "local",
  authFeedback: "",
  authFeedbackType: "info",
  storeStatus: "idle",
  storeMessage: "",
  migrationMeta: null,
};

export const uiState = {
  processingIdeaId: null,
  viewingIdeaId: null,
  editingOutputId: null,
  editingProjectId: null,
  activatingProjectOutputId: null,
  editingMoneyMovementId: null,
  editingPriorityId: null,
  editingFocusBlockId: null,
  activeReviewTab: "daily",
  activeIdeaFilter: "todas",
  ideaSearchText: "",
  expandedProjectIds: new Set(),
  recentProjectAction: null,
  dashboardTodayActionPaused: false,
  dashboardActionFeedback: "",
  dashboardActionDetailsOpen: false,
  dashboardActionState: "idle",
  dashboardLastCompletedText: "",
  dashboardGuideKey: "",
  isCopilotEditorOpen: false,
};

export function normalizeProjectStatus(value = "") {
  const safeValue = normalizeText(value);

  if (safeValue === "pausa" || safeValue === "en pausa") {
    return "pausa";
  }

  if (safeValue === "completado") {
    return "completado";
  }

  return "activo";
}

export function normalizeProjectRecord(project = {}) {
  const name = String(project.name || project.nombre || "").trim();
  const expectedResult = String(project.expectedResult || project.resultadoEsperado || "").trim();
  const nextAction = String(project.nextAction || project.siguienteAccion || "").trim();
  const area = String(project.area || "").trim();
  const priority = String(project.priority || project.prioridad || "media").trim() || "media";
  const status = normalizeProjectStatus(project.status || project.estado);
  const sourceOutputId = project.sourceOutputId || project.origenSalidaId || null;
  const createdAt = project.createdAt || project.fechaCreacion || project.updatedAt || new Date().toISOString();
  const activatedAt = project.activatedAt || project.fechaActivacion || createdAt;
  const updatedAt = project.updatedAt || activatedAt;

  return {
    id: project.id || createId("project"),
    sourceOutputId,
    origenSalidaId: sourceOutputId,
    name,
    nombre: name,
    expectedResult,
    resultadoEsperado: expectedResult,
    nextAction,
    siguienteAccion: nextAction,
    priority,
    prioridad: priority,
    status,
    estado: status,
    area,
    createdAt,
    fechaCreacion: createdAt,
    activatedAt,
    fechaActivacion: activatedAt,
    updatedAt,
  };
}

export function replaceAppState(nextState) {
  Object.keys(appState).forEach((key) => {
    delete appState[key];
  });

  Object.assign(appState, nextState);
}

export function getIdeaById(ideaId) {
  return appState.ideas.find((idea) => idea.id === ideaId);
}

export function getOutputById(outputId) {
  return appState.outputs.find((output) => output.id === outputId);
}

export function getOutputByIdeaId(ideaId) {
  return appState.outputs.find((output) => output.ideaId === ideaId) || null;
}

export function getProjectById(projectId) {
  return appState.projects.find((project) => project.id === projectId);
}

export function getPriorityById(priorityId) {
  return appState.priorities.find((priority) => priority.id === priorityId);
}

export function getFocusBlockById(focusBlockId) {
  return appState.focusBlocks.find((focusBlock) => focusBlock.id === focusBlockId);
}

export function getMoneyMovementById(movementId) {
  return appState.moneyMovements.find((movement) => movement.id === movementId);
}

export function getIdeasSorted() {
  return [...appState.ideas].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function getOutputsSorted() {
  return [...appState.outputs].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

export function getProjectsSorted() {
  return [...appState.projects].sort((a, b) => {
    const projectBDate = b.updatedAt || b.activatedAt || b.createdAt;
    const projectADate = a.updatedAt || a.activatedAt || a.createdAt;
    return new Date(projectBDate) - new Date(projectADate);
  });
}

export function getPrioritiesSorted() {
  return [...appState.priorities].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

export function getFocusBlocksSorted() {
  return [...appState.focusBlocks].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

export function getMoneyMovementsSorted() {
  return [...appState.moneyMovements].sort((a, b) => {
    return new Date(b.updatedAt || b.createdAt || b.date) - new Date(a.updatedAt || a.createdAt || a.date);
  });
}

export function getFinanceSummary() {
  return appState.moneyMovements.reduce(
    (summary, movement) => {
      const movementAmount = parseMoneyAmount(movement.amount);

      if (movement.type === "ingreso") {
        summary.income += movementAmount;
      } else if (movement.type === "gasto") {
        summary.expense += movementAmount;
      } else if (movement.type === "cobro pendiente") {
        summary.pending += movementAmount;
      }

      summary.balance = summary.income - summary.expense;
      return summary;
    },
    {
      income: 0,
      expense: 0,
      pending: 0,
      balance: 0,
    }
  );
}

export function getMoneyGoalProgress() {
  const financeSummary = getFinanceSummary();
  const targetAmount = parseMoneyAmount(appState.moneyGoal.targetAmount);
  const progressRatio = targetAmount > 0 ? financeSummary.income / targetAmount : 0;
  const progressPercent = Math.max(0, Math.min(progressRatio * 100, 100));

  return {
    targetAmount,
    currentIncome: financeSummary.income,
    progressPercent,
    pendingAmount: financeSummary.pending,
  };
}

export function getActiveProjectsCount(excludedProjectId = null) {
  return appState.projects.filter((project) => {
    if (excludedProjectId && project.id === excludedProjectId) {
      return false;
    }

    return project.status === "activo";
  }).length;
}

export function canAddAnotherActiveProject(excludedProjectId = null) {
  return getActiveProjectsCount(excludedProjectId) < MAX_ACTIVE_PROJECTS;
}

export function getActivePrioritiesCount(excludedPriorityId = null) {
  return appState.priorities.filter((priority) => {
    if (excludedPriorityId && priority.id === excludedPriorityId) {
      return false;
    }

    return priority.status !== "completada";
  }).length;
}

export function canAddAnotherActivePriority(excludedPriorityId = null) {
  return getActivePrioritiesCount(excludedPriorityId) < MAX_ACTIVE_PRIORITIES;
}

export function getActiveFocusBlocksCount(excludedFocusBlockId = null) {
  return appState.focusBlocks.filter((focusBlock) => {
    if (excludedFocusBlockId && focusBlock.id === excludedFocusBlockId) {
      return false;
    }

    return focusBlock.status !== "completado";
  }).length;
}

export function canAddAnotherFocusBlock(excludedFocusBlockId = null) {
  return getActiveFocusBlocksCount(excludedFocusBlockId) < MAX_ACTIVE_FOCUS_BLOCKS;
}

export function hasProjectFromOutput(outputId) {
  return appState.projects.some((project) => (project.sourceOutputId || project.origenSalidaId) === outputId);
}

export function getProjectFromOutput(outputId) {
  return appState.projects.find((project) => (project.sourceOutputId || project.origenSalidaId) === outputId) || null;
}

export function hasActivatedProjectFromIdea(ideaId) {
  const linkedOutput = getOutputByIdeaId(ideaId);

  if (!linkedOutput) {
    return false;
  }

  return Boolean(getProjectFromOutput(linkedOutput.id));
}

export function getIdeaCountsByStatus() {
  const counts = {
    todas: appState.ideas.length,
    pendiente: 0,
    procesada: 0,
    archivada: 0,
  };

  appState.ideas.forEach((idea) => {
    if (counts[idea.status] !== undefined) {
      counts[idea.status] += 1;
    }
  });

  return counts;
}

export function getVisibleIdeas() {
  const searchText = normalizeText(uiState.ideaSearchText);

  return getIdeasSorted().filter((idea) => {
    const matchesFilter =
      uiState.activeIdeaFilter === "todas" || idea.status === uiState.activeIdeaFilter;
    const searchableText = normalizeText(`${idea.title} ${idea.note || ""} ${idea.source || ""}`);
    const matchesSearch = !searchText || searchableText.includes(searchText);

    return matchesFilter && matchesSearch;
  });
}

export function removeOutputByIdeaId(ideaId) {
  appState.outputs = appState.outputs.filter((output) => output.ideaId !== ideaId);
}

export function buildOutputFromIdea(idea) {
  return {
    id: createId("output"),
    ideaId: idea.id,
    ideaTitle: idea.title,
    problem: idea.processing.problem,
    purpose: idea.processing.purpose,
    area: idea.processing.area,
    timing: idea.processing.timing,
    minimumVersion: idea.processing.minimumVersion,
    outputType: idea.processing.outputType,
    updatedAt: new Date().toISOString(),
  };
}

export function buildProjectFromOutput(output, activationData = {}) {
  const activationDate = new Date().toISOString();

  return normalizeProjectRecord({
    id: createId("project"),
    sourceOutputId: output.id,
    name: String(activationData.name || output.ideaTitle || "").trim(),
    expectedResult: String(activationData.expectedResult || output.purpose || "").trim(),
    nextAction: String(activationData.nextAction || "").trim(),
    priority: String(activationData.priority || "media").trim() || "media",
    status: "activo",
    area: String(activationData.area || output.area || "").trim(),
    createdAt: activationDate,
    activatedAt: activationDate,
    updatedAt: activationDate,
  });
}
