/*
  Render de la capa operativa diaria: prioridades, bloques, jefe y proyectos.
*/

import { elements } from "./dom.js";
import {
  appState,
  getActiveFocusBlocksCount,
  getActivePrioritiesCount,
  getActiveProjectsCount,
  getFocusBlocksSorted,
  getPrioritiesSorted,
  getProjectsSorted,
  uiState,
} from "./state.js";
import {
  escapeHtml,
  formatDate,
  formatTimeRange,
  normalizeText,
} from "./utils.js";

const PROJECT_PRIORITY_WEIGHT = {
  alta: 3,
  media: 2,
  baja: 1,
};

function getPrimaryPriorityId(priorities) {
  return priorities.find((priority) => priority.status !== "completada")?.id || null;
}

function getPrimaryFocusBlockId(focusBlocks) {
  return focusBlocks.find((focusBlock) => focusBlock.status !== "completado")?.id || null;
}

function getStrategicProjectId(projects) {
  const activeProjects = projects.filter((project) => project.status === "activo");

  if (activeProjects.length === 0) {
    return null;
  }

  return [...activeProjects]
    .sort((projectA, projectB) => {
      const priorityWeightDifference =
        (PROJECT_PRIORITY_WEIGHT[normalizeText(projectB.priority)] || 0)
        - (PROJECT_PRIORITY_WEIGHT[normalizeText(projectA.priority)] || 0);

      if (priorityWeightDifference !== 0) {
        return priorityWeightDifference;
      }

      return new Date(projectB.updatedAt) - new Date(projectA.updatedAt);
    })[0]
    .id;
}

function getPriorityModeMeta(priority, primaryPriorityId) {
  if (appState.currentMode !== "supervivencia" || priority.status === "completada") {
    return {
      className: "",
      badge: "",
    };
  }

  if (priority.id === primaryPriorityId) {
    return {
      className: "is-mode-featured",
      badge: "Prioridad principal sugerida",
    };
  }

  return {
    className: "is-mode-muted",
    badge: "Menor carga visual por hoy",
  };
}

function getFocusBlockModeMeta(focusBlock, primaryFocusBlockId) {
  if (focusBlock.status === "completado") {
    return {
      className: "",
      badge: "",
    };
  }

  if (appState.currentMode === "supervivencia") {
    if (focusBlock.id === primaryFocusBlockId) {
      return {
        className: "is-mode-featured",
        badge: "Bloque recomendado",
      };
    }

    return {
      className: "is-mode-muted",
      badge: "Secundario por ahora",
    };
  }

  if (appState.currentMode === "avance") {
    return {
      className: "is-mode-strategic",
      badge: "Bloque estratégico",
    };
  }

  return {
    className: "",
    badge: "",
  };
}

function getProjectModeMeta(project, strategicProjectId) {
  if (appState.currentMode !== "avance" || project.status !== "activo") {
    return {
      className: "",
      badge: "",
    };
  }

  if (project.id === strategicProjectId) {
    return {
      className: "is-mode-strategic",
      badge: "Proyecto a empujar hoy",
    };
  }

  return {
    className: "",
    badge: "",
  };
}

export function renderPriorities() {
  const priorities = getPrioritiesSorted();
  const activePrioritiesCount = getActivePrioritiesCount();
  const primaryPriorityId = getPrimaryPriorityId(priorities);

  elements.prioritiesActiveCounter.textContent = `${activePrioritiesCount} activas`;

  if (priorities.length === 0) {
    elements.prioritiesList.innerHTML = `
      <article class="empty-state">
        <h3>Aún no definiste prioridades para hoy</h3>
        <p>
          Define hasta tres prioridades activas para bajar el ruido y darle dirección concreta al día.
        </p>
      </article>
    `;
    return;
  }

  elements.prioritiesList.innerHTML = priorities
    .map((priority) => {
      const isCompleted = priority.status === "completada";
      const modeMeta = getPriorityModeMeta(priority, primaryPriorityId);
      const emphasisBadge = modeMeta.badge
        ? `<span class="mode-emphasis-badge">${escapeHtml(modeMeta.badge)}</span>`
        : "";

      return `
        <article class="mini-card ${isCompleted ? "is-completed" : ""} ${modeMeta.className}">
          <div class="mini-card-top">
            <h3 class="mini-card-title">${escapeHtml(priority.title)}</h3>
            <span class="status-badge status-${normalizeText(priority.status)}">${escapeHtml(priority.status)}</span>
          </div>

          ${emphasisBadge}

          <div class="mini-card-meta">
            <span class="mini-card-badge"><strong>Actualizada</strong> ${escapeHtml(formatDate(priority.updatedAt))}</span>
          </div>

          <div class="mini-card-actions">
            <button class="project-action-button" type="button" data-priority-action="edit" data-priority-id="${priority.id}">
              Editar
            </button>
            ${!isCompleted ? `
              <button class="project-action-button" type="button" data-priority-action="complete" data-priority-id="${priority.id}">
                Completar
              </button>
            ` : ""}
            <button class="project-action-button project-action-danger" type="button" data-priority-action="delete" data-priority-id="${priority.id}">
              Eliminar
            </button>
          </div>
        </article>
      `;
    })
    .join("");
}

export function renderFocusBlocks() {
  const focusBlocks = getFocusBlocksSorted();
  const activeFocusBlocksCount = getActiveFocusBlocksCount();
  const primaryFocusBlockId = getPrimaryFocusBlockId(focusBlocks);

  elements.focusBlocksActiveCounter.textContent = `${activeFocusBlocksCount} activos`;

  if (focusBlocks.length === 0) {
    elements.focusBlocksList.innerHTML = `
      <article class="empty-state">
        <h3>Aún no reservaste bloques de enfoque</h3>
        <p>
          Define uno o dos bloques reales para proteger tiempo importante antes de que el día se disperse.
        </p>
      </article>
    `;
    return;
  }

  elements.focusBlocksList.innerHTML = focusBlocks
    .map((focusBlock) => {
      const blockCardClass =
        focusBlock.status === "completado"
          ? "is-completed"
          : focusBlock.status === "en curso"
            ? "is-in-progress"
            : "";
      const modeMeta = getFocusBlockModeMeta(focusBlock, primaryFocusBlockId);
      const emphasisBadge = modeMeta.badge
        ? `<span class="mode-emphasis-badge">${escapeHtml(modeMeta.badge)}</span>`
        : "";

      return `
        <article class="mini-card ${blockCardClass} ${modeMeta.className}">
          <div class="mini-card-top">
            <h3 class="mini-card-title">${escapeHtml(focusBlock.title)}</h3>
            <span class="status-badge status-${normalizeText(focusBlock.status).replace(/\s+/g, "-")}">${escapeHtml(focusBlock.status)}</span>
          </div>

          ${emphasisBadge}

          <div class="mini-card-meta">
            <span class="mini-card-badge"><strong>Horario</strong> ${escapeHtml(formatTimeRange(focusBlock.startTime, focusBlock.endTime))}</span>
          </div>

          <div class="mini-card-actions">
            <button class="project-action-button" type="button" data-focus-block-action="edit" data-focus-block-id="${focusBlock.id}">
              Editar
            </button>
            ${focusBlock.status !== "completado" ? `
              <button class="project-action-button" type="button" data-focus-block-action="complete" data-focus-block-id="${focusBlock.id}">
                Completar
              </button>
            ` : ""}
            <button class="project-action-button project-action-danger" type="button" data-focus-block-action="delete" data-focus-block-id="${focusBlock.id}">
              Eliminar
            </button>
          </div>
        </article>
      `;
    })
    .join("");
}

export function renderBoss() {
  elements.bossTitleField.value = appState.boss.title || "";
  elements.bossNoteField.value = appState.boss.note || "";
}

function getProjectStatusText(status = "") {
  if (normalizeText(status) === "pausa" || normalizeText(status) === "en pausa") {
    return "En pausa";
  }

  if (normalizeText(status) === "completado") {
    return "Completado";
  }

  return "Activo";
}

function capitalizeLabel(value = "") {
  if (!value) {
    return "";
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getProjectHeaderMeta(project) {
  const normalizedStatus = normalizeText(project.status);

  if (normalizedStatus === "pausa") {
    return {
      icon: "\u23F8\uFE0F",
      eyebrow: "Proyecto en pausa",
      badge: "EN PAUSA",
      accentClass: "is-pause",
    };
  }

  if (normalizedStatus === "completado") {
    return {
      icon: "\u2705",
      eyebrow: "Proyecto completado",
      badge: "COMPLETADO",
      accentClass: "is-completed",
    };
  }

  return {
    icon: "\uD83D\uDE80",
    eyebrow: "Proyecto activo",
    badge: "EN EJECUCION",
    accentClass: "is-active",
  };
}

function getProjectActionMeta(project) {
  const normalizedStatus = normalizeText(project.status);

  if (normalizedStatus === "pausa") {
    return {
      label: "Al volver",
      text: project.nextAction || project.expectedResult,
      note: "Esto es lo primero que conviene mover al reactivarlo.",
    };
  }

  if (normalizedStatus === "completado") {
    return {
      label: "Cerrado",
      text: project.expectedResult || "Proyecto completado",
      note: "La operación ya quedó cerrada. Los detalles quedan como referencia.",
    };
  }

  return {
    label: "Ahora",
    text: project.nextAction || project.expectedResult,
    note: "La siguiente acción manda. Lo demás acompaña.",
  };
}

function getProjectStageProgress(project) {
  const stages = [
    {
      label: "Claridad",
      isDone: Boolean(project.name && project.expectedResult),
    },
    {
      label: "Activación",
      isDone: Boolean(project.activatedAt || project.sourceOutputId || project.origenSalidaId),
    },
    {
      label: "Acción",
      isDone: Boolean(project.nextAction),
    },
    {
      label: "Operación",
      isDone: normalizeText(project.status) === "activo" || normalizeText(project.status) === "completado",
    },
  ];
  const completedCount = stages.filter((stage) => stage.isDone).length;

  return {
    stages,
    percent: Math.round((completedCount / stages.length) * 100),
  };
}

function getProjectDetails(project) {
  const linkedOutput = appState.outputs.find(
    (output) => output.id === (project.sourceOutputId || project.origenSalidaId)
  ) || null;
  const linkedIdea = linkedOutput
    ? appState.ideas.find((idea) => idea.id === linkedOutput.ideaId) || null
    : null;
  const contextText = linkedOutput?.problem
    || linkedIdea?.note
    || "No hay contexto adicional guardado para este proyecto.";
  const notes = [
    linkedOutput?.minimumVersion ? `Versión mínima: ${linkedOutput.minimumVersion}` : "",
    linkedOutput?.timing ? `Momento sugerido: ${linkedOutput.timing}` : "",
    linkedIdea?.source ? `Fuente: ${linkedIdea.source}` : "",
  ].filter(Boolean);

  return {
    contextText,
    notesText: notes.join(" | ") || "Sin notas secundarias registradas por ahora.",
    originLabel: linkedOutput ? "Salida activada desde Refinería" : "Proyecto legado",
  };
}

function getProjectCardActionState(projectId) {
  if (!uiState.recentProjectAction || uiState.recentProjectAction.projectId !== projectId) {
    return "";
  }

  return `is-recent-${uiState.recentProjectAction.tone || "success"}`;
}

function renderProjectCollection(projects, strategicProjectId) {
  return projects
    .map((project) => {
      const toggleLabel = project.status === "activo" ? "Pausar" : "Reactivar";
      const modeMeta = getProjectModeMeta(project, strategicProjectId);
      const emphasisBadge = modeMeta.badge
        ? `<span class="mode-emphasis-badge">${escapeHtml(modeMeta.badge)}</span>`
        : "";
      const headerMeta = getProjectHeaderMeta(project);
      const actionMeta = getProjectActionMeta(project);
      const stageProgress = getProjectStageProgress(project);
      const projectDetails = getProjectDetails(project);
      const activationDate = project.activatedAt || project.fechaActivacion || project.updatedAt;
      const isDetailsOpen = uiState.expandedProjectIds.has(project.id);
      const detailButtonLabel = isDetailsOpen ? "Ocultar detalles" : "Ver detalles";
      const detailId = `project-details-${project.id}`;
      const actionStateClass = getProjectCardActionState(project.id);
      const statusText = getProjectStatusText(project.status);
      const quickActionButtons = project.status === "completado"
        ? ""
        : project.status === "activo"
          ? `
              <button
                class="project-action-button project-action-button-primary"
                type="button"
                data-project-action="complete"
                data-project-id="${project.id}"
              >
                Completar
              </button>
              <button
                class="project-action-button project-action-button-secondary"
                type="button"
                data-project-action="toggle-status"
                data-project-id="${project.id}"
              >
                ${toggleLabel}
              </button>
            `
          : `
              <button
                class="project-action-button project-action-button-primary"
                type="button"
                data-project-action="toggle-status"
                data-project-id="${project.id}"
              >
                ${toggleLabel}
              </button>
              <button
                class="project-action-button project-action-button-secondary"
                type="button"
                data-project-action="complete"
                data-project-id="${project.id}"
              >
                Completar
              </button>
            `;
      const stageMarkup = stageProgress.stages
        .map(
          (stage) => `
            <span class="project-stage-pill ${stage.isDone ? "is-done" : ""}">
              ${escapeHtml(stage.label)}
            </span>
          `
        )
        .join("");
      const radarRows = [
        ["Estado", statusText],
        ["Prioridad", capitalizeLabel(project.priority || "media")],
        ["Área", project.area || "Sin área"],
        ["Activado", formatDate(activationDate)],
        ["Actualizado", formatDate(project.updatedAt || activationDate)],
        ["Origen", projectDetails.originLabel],
      ]
        .map(
          ([label, value]) => `
            <div class="project-detail-row">
              <span>${escapeHtml(label)}</span>
              <strong>${escapeHtml(value)}</strong>
            </div>
          `
        )
        .join("");

      return `
        <article class="project-card is-${normalizeText(project.status).replace(/\s+/g, "-")} ${headerMeta.accentClass} ${modeMeta.className} ${actionStateClass} ${isDetailsOpen ? "is-details-open" : ""}">
          <div class="project-header">
            <div class="project-header-main">
              <span class="project-heading-icon" aria-hidden="true">${headerMeta.icon}</span>
              <div class="project-header-copy">
                <p class="project-eyebrow">${escapeHtml(headerMeta.eyebrow)}</p>
                <span class="project-status-pill">${escapeHtml(headerMeta.badge)}</span>
              </div>
            </div>
            ${emphasisBadge}
          </div>

          <div class="project-title-block">
            <h3 class="project-name">${escapeHtml(project.name)}</h3>
            <div class="project-objective-block">
              <span class="project-mini-label">Objetivo</span>
              <p class="project-objective">${escapeHtml(project.expectedResult)}</p>
            </div>
          </div>

          <section class="project-action-zone">
            <div class="project-action-kicker-row">
              <span class="project-mini-label project-mini-label-accent">${escapeHtml(actionMeta.label)}</span>
            </div>
            <p class="project-action-text">${escapeHtml(actionMeta.text)}</p>
            <p class="project-action-note">${escapeHtml(actionMeta.note)}</p>
          </section>

          <div class="project-actions-shell">
            <div class="project-actions-bar">
              ${quickActionButtons}
            </div>
            <button
              class="project-action-button project-action-button-ghost project-details-toggle"
              type="button"
              data-project-action="toggle-details"
              data-project-id="${project.id}"
              aria-expanded="${String(isDetailsOpen)}"
              aria-controls="${detailId}"
            >
              ${detailButtonLabel}
            </button>
          </div>

          <div class="project-details-shell" id="${detailId}" aria-hidden="${String(!isDetailsOpen)}">
            <div class="project-details-inner">
              <div class="project-details-grid">
                <section class="project-detail-card">
                  <span class="project-detail-label">Recorrido Refinería</span>
                  <div class="project-progress-head">
                    <strong class="project-progress-value">${stageProgress.percent}%</strong>
                    <span class="project-progress-caption">${escapeHtml(statusText)}</span>
                  </div>
                  <div class="project-progress-bar" aria-hidden="true">
                    <span class="project-progress-fill" style="width: ${stageProgress.percent}%;"></span>
                  </div>
                  <div class="project-stage-list">
                    ${stageMarkup}
                  </div>
                </section>

                <section class="project-detail-card">
                  <span class="project-detail-label">Contexto original</span>
                  <p class="project-detail-copy">${escapeHtml(projectDetails.contextText)}</p>
                </section>

                <section class="project-detail-card">
                  <span class="project-detail-label">Radar operativo</span>
                  <div class="project-detail-rows">
                    ${radarRows}
                  </div>
                </section>
              </div>

              <div class="project-detail-notes">
                <span class="project-detail-label">Notas</span>
                <p class="project-detail-copy">${escapeHtml(projectDetails.notesText)}</p>
              </div>

              <div class="project-detail-footer">
                <button class="project-action-button project-action-button-ghost" type="button" data-project-action="edit" data-project-id="${project.id}">
                  Editar
                </button>
                <button class="project-action-button project-action-danger" type="button" data-project-action="delete" data-project-id="${project.id}">
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

export function renderProjects() {
  const projects = getProjectsSorted();
  const activeProjects = projects.filter((project) => project.status === "activo");
  const pausedProjects = projects.filter((project) => project.status === "pausa");
  const completedProjects = projects.filter((project) => project.status === "completado");
  const activeProjectsCount = getActiveProjectsCount();
  const strategicProjectId = getStrategicProjectId(projects);

  elements.projectsActiveCounter.textContent = `${activeProjectsCount} activos`;

  if (projects.length === 0) {
    elements.projectsList.innerHTML = `
      <article class="empty-state">
        <h3>Aún no hay proyectos activos</h3>
        <p>
          Activa una salida operativa de tipo proyecto para traerla a ejecución real.
        </p>
      </article>
    `;
    elements.projectsPausedSection.hidden = true;
    elements.projectsPausedList.innerHTML = "";
    elements.projectsCompletedSection.hidden = true;
    elements.projectsCompletedList.innerHTML = "";
    return;
  }

  elements.projectsList.innerHTML = activeProjects.length > 0
    ? renderProjectCollection(activeProjects, strategicProjectId)
    : `
      <article class="empty-state">
        <h3>No hay proyectos activos ahora mismo</h3>
        <p>
          Si quieres mover uno, reactiva un proyecto en pausa o activa una salida tipo proyecto desde Refinería.
        </p>
      </article>
    `;

  elements.projectsPausedSection.hidden = pausedProjects.length === 0;
  elements.projectsPausedList.innerHTML = pausedProjects.length > 0
    ? renderProjectCollection(pausedProjects, strategicProjectId)
    : "";

  elements.projectsCompletedSection.hidden = completedProjects.length === 0;
  elements.projectsCompletedList.innerHTML = completedProjects.length > 0
    ? renderProjectCollection(completedProjects, strategicProjectId)
    : "";
}
