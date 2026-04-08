/*
  Handlers de operación diaria: proyectos, prioridades, bloques y jefe.
*/

import { MAX_ACTIVE_FOCUS_BLOCKS, MAX_ACTIVE_PRIORITIES, MAX_ACTIVE_PROJECTS } from "./config.js";
import { elements } from "./dom.js";
import { setActiveAppView } from "./handlers-core.js";
import { renderApp, renderDashboard } from "./render-core.js";
import { renderBoss } from "./render-operacion.js";
import { closeProjectEditPanel, openProjectEditPanel } from "./panels.js";
import {
  appState,
  buildProjectFromOutput,
  canAddAnotherActivePriority,
  canAddAnotherActiveProject,
  canAddAnotherFocusBlock,
  getFocusBlockById,
  getOutputById,
  getPriorityById,
  getProjectById,
  uiState,
} from "./state.js";
import { saveState } from "./storage.js";
import { createId, getResolvedSelectFieldValue } from "./utils.js";
import {
  resetFocusBlockForm,
  resetPriorityForm,
  setBossSaveButtonState,
  setConditionalSelectFieldVisibility,
  setFeedbackTimeout,
  setFocusBlockSaveButtonState,
  setPrioritySaveButtonState,
  setProjectEditSaveButtonState,
  setProjectFeedback,
} from "./ui-helpers.js";

function syncProjectAliases(project) {
  project.origenSalidaId = project.sourceOutputId;
  project.nombre = project.name;
  project.resultadoEsperado = project.expectedResult;
  project.siguienteAccion = project.nextAction;
  project.prioridad = project.priority;
  project.estado = project.status;
  project.fechaCreacion = project.createdAt;
  project.fechaActivacion = project.activatedAt;
}

function showProjectFeedback(message = "", type = "success") {
  setProjectFeedback(message, type);
  setFeedbackTimeout("project", () => {
    setProjectFeedback("");
  });
}

function pulseProjectCard(projectId, tone = "success") {
  uiState.recentProjectAction = {
    projectId,
    tone,
  };
  setFeedbackTimeout("projectPulse", () => {
    if (uiState.recentProjectAction?.projectId === projectId) {
      uiState.recentProjectAction = null;
      renderApp();
    }
  }, 1500);
}

export function handlePrioritySubmit(event) {
  event.preventDefault();

  const formData = new FormData(elements.priorityForm);
  const priorityTitle = String(formData.get("title") || "").trim();
  const currentPriority = getPriorityById(uiState.editingPriorityId);

  if (!priorityTitle) {
    elements.priorityTitleField.focus();
    return;
  }

  if (!currentPriority && !canAddAnotherActivePriority()) {
    setPrioritySaveButtonState(
      true,
      `Solo puedes tener hasta ${MAX_ACTIVE_PRIORITIES} prioridades activas al mismo tiempo.`,
      true
    );
    return;
  }

  if (currentPriority) {
    currentPriority.title = priorityTitle;
    currentPriority.updatedAt = new Date().toISOString();
  } else {
    appState.priorities.push({
      id: createId("priority"),
      title: priorityTitle,
      status: "activa",
      updatedAt: new Date().toISOString(),
    });
  }

  saveState(appState);
  renderApp();
  resetPriorityForm();
  setPrioritySaveButtonState(true, currentPriority ? "Prioridad actualizada" : "Prioridad guardada");
  setFeedbackTimeout("priority", () => {
    setPrioritySaveButtonState(false);
  });
}

export function handleFocusBlockSubmit(event) {
  event.preventDefault();

  const formData = new FormData(elements.focusBlockForm);
  const focusBlockTitle = String(formData.get("title") || "").trim();
  const nextStatus = String(formData.get("status") || "pendiente").trim();
  const currentFocusBlock = getFocusBlockById(uiState.editingFocusBlockId);
  const willCountAsActive = nextStatus !== "completado";

  if (!focusBlockTitle) {
    elements.focusBlockTitleField.focus();
    return;
  }

  if (willCountAsActive && !canAddAnotherFocusBlock(currentFocusBlock?.id || null)) {
    setFocusBlockSaveButtonState(
      true,
      `Solo puedes tener hasta ${MAX_ACTIVE_FOCUS_BLOCKS} bloques activos al mismo tiempo.`,
      true
    );
    return;
  }

  if (currentFocusBlock) {
    currentFocusBlock.title = focusBlockTitle;
    currentFocusBlock.startTime = String(formData.get("startTime") || "").trim();
    currentFocusBlock.endTime = String(formData.get("endTime") || "").trim();
    currentFocusBlock.status = nextStatus;
    currentFocusBlock.updatedAt = new Date().toISOString();
  } else {
    appState.focusBlocks.push({
      id: createId("focus-block"),
      title: focusBlockTitle,
      startTime: String(formData.get("startTime") || "").trim(),
      endTime: String(formData.get("endTime") || "").trim(),
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    });
  }

  saveState(appState);
  renderApp();
  resetFocusBlockForm();
  setFocusBlockSaveButtonState(true, currentFocusBlock ? "Bloque actualizado" : "Bloque guardado");
  setFeedbackTimeout("focusBlock", () => {
    setFocusBlockSaveButtonState(false);
  });
}

export function handleBossSubmit(event) {
  event.preventDefault();

  const formData = new FormData(elements.bossForm);
  appState.boss = {
    title: String(formData.get("title") || "").trim(),
    note: String(formData.get("note") || "").trim(),
  };

  saveState(appState);
  renderDashboard();
  renderBoss();
  setBossSaveButtonState(true, "Jefe actual guardado");
  setFeedbackTimeout("boss", () => {
    setBossSaveButtonState(false);
  });
}

export function startPriorityEdit(priorityId) {
  const priority = getPriorityById(priorityId);

  if (!priority) {
    return;
  }

  uiState.editingPriorityId = priorityId;
  elements.priorityTitleField.value = priority.title || "";
  elements.cancelPriorityEditButton.hidden = false;
  elements.savePriorityButton.textContent = "Actualizar prioridad";
  elements.priorityTitleField.focus();
}

export function cancelPriorityEdit() {
  resetPriorityForm();
}

export function startFocusBlockEdit(focusBlockId) {
  const focusBlock = getFocusBlockById(focusBlockId);

  if (!focusBlock) {
    return;
  }

  uiState.editingFocusBlockId = focusBlockId;
  elements.focusBlockTitleField.value = focusBlock.title || "";
  elements.focusBlockStartField.value = focusBlock.startTime || "";
  elements.focusBlockEndField.value = focusBlock.endTime || "";
  elements.focusBlockStatusField.value = focusBlock.status || "pendiente";
  elements.cancelFocusBlockEditButton.hidden = false;
  elements.saveFocusBlockButton.textContent = "Actualizar bloque";
  elements.focusBlockTitleField.focus();
}

export function cancelFocusBlockEdit() {
  resetFocusBlockForm();
}

export function handleEditProjectAreaFieldChange(event) {
  setConditionalSelectFieldVisibility(
    event.target,
    elements.editProjectAreaCustomFieldWrapper,
    elements.editProjectAreaCustomField
  );
}

export function handlePriorityListClick(event) {
  const actionButton = event.target.closest("[data-priority-action]");

  if (!actionButton) {
    return;
  }

  const priorityId = actionButton.dataset.priorityId;
  const action = actionButton.dataset.priorityAction;
  const priority = getPriorityById(priorityId);

  if (!priority) {
    return;
  }

  if (action === "edit") {
    startPriorityEdit(priorityId);
    return;
  }

  if (action === "complete") {
    priority.status = "completada";
    priority.updatedAt = new Date().toISOString();

    if (uiState.editingPriorityId === priorityId) {
      resetPriorityForm();
    }

    saveState(appState);
    renderApp();
    setPrioritySaveButtonState(true, "Prioridad marcada como completada");
    setFeedbackTimeout("priority", () => {
      setPrioritySaveButtonState(false);
    });
    return;
  }

  if (action === "delete") {
    appState.priorities = appState.priorities.filter((currentPriority) => currentPriority.id !== priorityId);

    if (uiState.editingPriorityId === priorityId) {
      resetPriorityForm();
    }

    saveState(appState);
    renderApp();
    setPrioritySaveButtonState(true, "Prioridad eliminada");
    setFeedbackTimeout("priority", () => {
      setPrioritySaveButtonState(false);
    });
  }
}

export function handleFocusBlockListClick(event) {
  const actionButton = event.target.closest("[data-focus-block-action]");

  if (!actionButton) {
    return;
  }

  const focusBlockId = actionButton.dataset.focusBlockId;
  const action = actionButton.dataset.focusBlockAction;
  const focusBlock = getFocusBlockById(focusBlockId);

  if (!focusBlock) {
    return;
  }

  if (action === "edit") {
    startFocusBlockEdit(focusBlockId);
    return;
  }

  if (action === "complete") {
    focusBlock.status = "completado";
    focusBlock.updatedAt = new Date().toISOString();

    if (uiState.editingFocusBlockId === focusBlockId) {
      resetFocusBlockForm();
    }

    saveState(appState);
    renderApp();
    setFocusBlockSaveButtonState(true, "Bloque marcado como completado");
    setFeedbackTimeout("focusBlock", () => {
      setFocusBlockSaveButtonState(false);
    });
    return;
  }

  if (action === "delete") {
    appState.focusBlocks = appState.focusBlocks.filter(
      (currentFocusBlock) => currentFocusBlock.id !== focusBlockId
    );

    if (uiState.editingFocusBlockId === focusBlockId) {
      resetFocusBlockForm();
    }

    saveState(appState);
    renderApp();
    setFocusBlockSaveButtonState(true, "Bloque eliminado");
    setFeedbackTimeout("focusBlock", () => {
      setFocusBlockSaveButtonState(false);
    });
  }
}

export function handleProjectCardClick(event) {
  const actionButton = event.target.closest("[data-project-action]");

  if (!actionButton) {
    return;
  }

  const projectId = actionButton.dataset.projectId;
  const action = actionButton.dataset.projectAction;
  const project = getProjectById(projectId);

  if (!project) {
    return;
  }

  if (action === "toggle-details") {
    const projectCard = actionButton.closest(".project-card");
    const detailsPanel = projectCard?.querySelector(".project-details-shell");
    const isOpening = !uiState.expandedProjectIds.has(projectId);

    if (isOpening) {
      uiState.expandedProjectIds.add(projectId);
    } else {
      uiState.expandedProjectIds.delete(projectId);
    }

    if (projectCard && detailsPanel) {
      projectCard.classList.toggle("is-details-open", isOpening);
      detailsPanel.setAttribute("aria-hidden", String(!isOpening));
      actionButton.setAttribute("aria-expanded", String(isOpening));
      actionButton.textContent = isOpening ? "Ocultar detalles" : "Ver detalles";
      return;
    }

    renderApp();
    return;
  }

  if (action === "edit") {
    openProjectEditPanel(projectId);
    return;
  }

  if (action === "toggle-status") {
    if (project.status === "activo") {
      const previousProjectState = {
        status: project.status,
        estado: project.estado,
        activatedAt: project.activatedAt,
        fechaActivacion: project.fechaActivacion,
        updatedAt: project.updatedAt,
      };

      project.status = "pausa";
      project.updatedAt = new Date().toISOString();
      syncProjectAliases(project);
      const didSave = saveState(appState);

      if (!didSave) {
        Object.assign(project, previousProjectState);
        syncProjectAliases(project);
        showProjectFeedback(
          "No se pudo guardar el cambio de estado. El proyecto sigue en su estado anterior.",
          "error"
        );
        return;
      }

      pulseProjectCard(projectId, "pause");
      renderApp();
      showProjectFeedback("Proyecto movido a pausa", "success");
      return;
    }

    if (!canAddAnotherActiveProject(project.id)) {
      showProjectFeedback(
        `Ya tienes ${MAX_ACTIVE_PROJECTS} proyectos activos. Pausa o completa uno antes de reactivar otro.`,
        "error"
      );
      return;
    }

    const previousProjectState = {
      status: project.status,
      estado: project.estado,
      activatedAt: project.activatedAt,
      fechaActivacion: project.fechaActivacion,
      updatedAt: project.updatedAt,
    };

    project.status = "activo";
    project.activatedAt = new Date().toISOString();
    project.updatedAt = new Date().toISOString();
    syncProjectAliases(project);
    const didSave = saveState(appState);

    if (!didSave) {
      Object.assign(project, previousProjectState);
      syncProjectAliases(project);
      showProjectFeedback(
        "No se pudo guardar el cambio de estado. El proyecto sigue en su estado anterior.",
        "error"
      );
      return;
    }

    pulseProjectCard(projectId, "resume");
    renderApp();
    showProjectFeedback("Proyecto activado", "success");
    return;
  }

  if (action === "complete") {
    project.status = "completado";
    project.updatedAt = new Date().toISOString();
    syncProjectAliases(project);
    pulseProjectCard(projectId, "success");
    saveState(appState);
    renderApp();
    showProjectFeedback("Proyecto marcado como completado", "success");
    return;
  }

  if (action === "delete") {
    appState.projects = appState.projects.filter((currentProject) => currentProject.id !== projectId);
    uiState.expandedProjectIds.delete(projectId);
    if (uiState.recentProjectAction?.projectId === projectId) {
      uiState.recentProjectAction = null;
    }

    if (uiState.editingProjectId === projectId) {
      uiState.editingProjectId = null;
    }

    saveState(appState);
    renderApp();
    showProjectFeedback("Proyecto eliminado", "success");
  }
}

export function handleProjectEditSubmit(event) {
  event.preventDefault();

  const activationOutput = uiState.activatingProjectOutputId
    ? getOutputById(uiState.activatingProjectOutputId)
    : null;
  const project = getProjectById(uiState.editingProjectId);
  const isActivationMode = Boolean(activationOutput) && !project;

  if (!project && !activationOutput) {
    closeProjectEditPanel();
    return;
  }

  const formData = new FormData(elements.projectEditForm);
  const resolvedArea = getResolvedSelectFieldValue(
    formData.get("area"),
    formData.get("areaCustom")
  );
  const nextStatus = isActivationMode ? "activo" : String(formData.get("status") || "activo").trim();
  const nextName = String(formData.get("name") || "").trim();
  const nextExpectedResult = String(formData.get("expectedResult") || "").trim();
  const nextAction = String(formData.get("nextAction") || "").trim();

  if (!nextName) {
    elements.editProjectNameField.focus();
    return;
  }

  if (!nextExpectedResult) {
    elements.editProjectResultField.focus();
    return;
  }

  if (!nextAction) {
    elements.editProjectNextActionField.focus();
    return;
  }

  if (!resolvedArea) {
    if (String(formData.get("area") || "").trim() === "otro") {
      elements.editProjectAreaCustomField.focus();
    } else {
      elements.editProjectAreaField.focus();
    }
    return;
  }

  if (nextStatus === "activo" && !canAddAnotherActiveProject(project?.id || null)) {
    setProjectEditSaveButtonState(
      true,
      `Ya tienes ${MAX_ACTIVE_PROJECTS} proyectos activos. Pausa o completa uno antes de activar otro.`,
      true
    );
    return;
  }

  const timestamp = new Date().toISOString();

  if (isActivationMode) {
    if (activationOutput.outputType !== "proyecto") {
      setProjectEditSaveButtonState(true, "Solo las salidas tipo proyecto pueden activarse.", true);
      return;
    }

    const linkedProject = appState.projects.find(
      (currentProject) => currentProject.sourceOutputId === activationOutput.id
    );

    if (linkedProject) {
      setProjectEditSaveButtonState(true, "Esa salida ya fue activada como proyecto.", true);
      return;
    }

    const nextProject = buildProjectFromOutput(activationOutput, {
      name: nextName,
      expectedResult: nextExpectedResult,
      nextAction,
      priority: String(formData.get("priority") || "media").trim(),
      area: resolvedArea,
    });
    appState.projects.push(nextProject);
    uiState.expandedProjectIds.add(nextProject.id);

    activationOutput.ideaTitle = nextProject.name;
    activationOutput.area = nextProject.area;
    activationOutput.updatedAt = timestamp;

    const linkedIdea = appState.ideas.find((idea) => idea.id === activationOutput.ideaId);

    if (linkedIdea) {
      linkedIdea.title = nextProject.name;
      linkedIdea.processing = {
        ...(linkedIdea.processing || {}),
        area: nextProject.area,
      };
    }

    saveState(appState);
    uiState.activatingProjectOutputId = null;
    setActiveAppView("operacion-diaria", { persist: true });
    pulseProjectCard(nextProject.id, "resume");
    renderApp();
    showProjectFeedback("Proyecto activado desde una salida operativa", "success");
    return;
  }

  project.name = nextName;
  project.expectedResult = nextExpectedResult;
  project.nextAction = nextAction;
  project.priority = String(formData.get("priority") || "media").trim();
  project.status = nextStatus;
  project.area = resolvedArea;
  project.updatedAt = timestamp;

  if (project.status === "activo") {
    project.activatedAt = project.activatedAt || timestamp;
  }

  syncProjectAliases(project);

  if (project.sourceOutputId) {
    const linkedOutput = appState.outputs.find((output) => output.id === project.sourceOutputId);

    if (linkedOutput) {
      linkedOutput.ideaTitle = project.name;
      linkedOutput.area = project.area;
      linkedOutput.updatedAt = timestamp;

      const linkedIdea = appState.ideas.find((idea) => idea.id === linkedOutput.ideaId);

      if (linkedIdea) {
        linkedIdea.title = project.name;
        linkedIdea.processing = {
          ...(linkedIdea.processing || {}),
          area: project.area,
        };
      }
    }
  }

  saveState(appState);
  renderApp();
  setProjectEditSaveButtonState(true, "Proyecto actualizado y guardado");
  setFeedbackTimeout("projectEdit", () => {
    setProjectEditSaveButtonState(false);
  });
}

export function bindOperacionEvents() {
  elements.priorityForm.addEventListener("submit", handlePrioritySubmit);
  elements.focusBlockForm.addEventListener("submit", handleFocusBlockSubmit);
  elements.bossForm.addEventListener("submit", handleBossSubmit);
  elements.cancelPriorityEditButton.addEventListener("click", cancelPriorityEdit);
  elements.cancelFocusBlockEditButton.addEventListener("click", cancelFocusBlockEdit);
  elements.prioritiesList.addEventListener("click", handlePriorityListClick);
  elements.focusBlocksList.addEventListener("click", handleFocusBlockListClick);
  elements.projectsList.addEventListener("click", handleProjectCardClick);
  elements.projectsPausedList.addEventListener("click", handleProjectCardClick);
  elements.projectsCompletedList.addEventListener("click", handleProjectCardClick);
  elements.projectEditForm.addEventListener("submit", handleProjectEditSubmit);
  elements.editProjectAreaField.addEventListener("change", handleEditProjectAreaFieldChange);
}
