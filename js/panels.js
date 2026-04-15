/*
  Render y control de los paneles laterales.
*/

import {
  AREA_PRESET_OPTIONS,
  LEGACY_PROBLEM_MAP,
  LEGACY_PURPOSE_MAP,
  PROBLEM_PRESET_OPTIONS,
  PURPOSE_PRESET_OPTIONS,
  TIMING_PRESET_OPTIONS,
} from "./config.js";
import { elements } from "./dom.js";
import {
  appState,
  getIdeaById,
  getOutputById,
  getOutputByIdeaId,
  getPrioritiesSorted,
  getProjectFromOutput,
  getProjectById,
  getProjectsSorted,
  uiState,
} from "./state.js";
import {
  escapeHtml,
  formatCatalogLabel,
  formatDate,
  getSelectableFieldState,
  normalizeText,
} from "./utils.js";
import {
  setDashboardCollectionDetailPanelVisibility,
  setIdeaDetailPanelVisibility,
  resetOutputEditForm,
  resetProcessForm,
  resetProjectEditForm,
  setConditionalSelectFieldVisibility,
  setOutputEditPanelVisibility,
  setProcessPanelVisibility,
  setProjectEditSaveButtonState,
  setProjectEditPanelVisibility,
} from "./ui-helpers.js";

function buildIdeaDetailMetaHtml(currentIdea) {
  return [
    `<span class="meta-chip"><strong>Fuente</strong> ${escapeHtml(currentIdea.source || "Sin fuente")}</span>`,
    `<span class="meta-chip"><strong>Fecha</strong> ${escapeHtml(formatDate(currentIdea.createdAt))}</span>`,
    `<span class="meta-chip"><strong>Estado</strong> ${escapeHtml(currentIdea.status)}</span>`,
  ].join("");
}

function normalizeSupportDocUrl(value = "") {
  return String(value || "").trim();
}

function isExternalDocumentUrl(value = "") {
  return /^https?:\/\//i.test(normalizeSupportDocUrl(value));
}

function syncIdeaSupportDocSection(currentIdea = null) {
  if (!elements.ideaSupportDocStatus || !elements.ideaSupportDocUrlField || !elements.openIdeaSupportDocLink) {
    return;
  }

  if (!currentIdea) {
    elements.ideaSupportDocStatus.textContent = "Aun no hay documento vinculado.";
    elements.ideaSupportDocUrlField.value = "";
    elements.openIdeaSupportDocLink.hidden = true;
    elements.openIdeaSupportDocLink.href = "#";
    return;
  }

  const supportDocUrl = normalizeSupportDocUrl(currentIdea.supportDocUrl);
  const hasValidSupportDoc = isExternalDocumentUrl(supportDocUrl);

  elements.ideaSupportDocUrlField.value = supportDocUrl;

  if (!supportDocUrl) {
    elements.ideaSupportDocStatus.textContent = "Aun no hay documento vinculado.";
  } else if (hasValidSupportDoc) {
    elements.ideaSupportDocStatus.textContent = "Documento vinculado y listo para abrir.";
  } else {
    elements.ideaSupportDocStatus.textContent = "La URL guardada necesita revisarse antes de abrirse.";
  }

  elements.openIdeaSupportDocLink.hidden = !hasValidSupportDoc;
  elements.openIdeaSupportDocLink.href = hasValidSupportDoc ? supportDocUrl : "#";
}

function buildIdeaTraceCards(currentIdea, linkedOutput, linkedProject) {
  const cards = [];

  cards.push(`
    <article class="idea-detail-trace-card">
      <p class="idea-detail-trace-kicker">Estado actual</p>
      <h4>${escapeHtml(currentIdea.status === "pendiente" ? "Idea aún en inbox" : "Idea ya refinada")}</h4>
      <p>
        ${escapeHtml(
          currentIdea.status === "pendiente"
            ? "Todavía no se ha traducido a una salida operativa. La tarjeta del inbox sigue siendo la entrada principal."
            : "La idea ya pasó por procesamiento y conserva una relación directa con lo que hoy vive en la refinería."
        )}
      </p>
    </article>
  `);

  if (currentIdea.processing) {
    cards.push(`
      <article class="idea-detail-trace-card">
        <p class="idea-detail-trace-kicker">Procesamiento base</p>
        <h4>${escapeHtml(formatCatalogLabel(currentIdea.processing.purpose) || "Sin utilidad definida")}</h4>
        <p>
          ${escapeHtml(
            `Necesidad: ${formatCatalogLabel(currentIdea.processing.problem) || "Sin definir"} - Área: ${formatCatalogLabel(currentIdea.processing.area) || "Sin área"} - Cuándo aplica: ${formatCatalogLabel(currentIdea.processing.timing) || "Sin timing"}`
          )}
        </p>
      </article>
    `);
  }

  if (linkedOutput) {
    cards.push(`
      <article class="idea-detail-trace-card">
        <p class="idea-detail-trace-kicker">Salida operativa vinculada</p>
        <h4>${escapeHtml(formatCatalogLabel(linkedOutput.outputType))}</h4>
        <p>${escapeHtml(linkedOutput.minimumVersion || "Sin versión mínima visible")}</p>
      </article>
    `);
  }

  if (linkedProject) {
    cards.push(`
      <article class="idea-detail-trace-card">
        <p class="idea-detail-trace-kicker">Operación real derivada</p>
        <h4>${escapeHtml(linkedProject.name)}</h4>
        <p>
          ${escapeHtml(
            `Proyecto ${linkedProject.status}. Siguiente acción: ${linkedProject.nextAction || "Sin siguiente acción visible"}`
          )}
        </p>
      </article>
    `);
  }

  if (!linkedOutput && !linkedProject) {
    cards.push(`
      <article class="idea-detail-trace-card">
        <p class="idea-detail-trace-kicker">Espacio de crecimiento</p>
        <h4>Lista para crecer después</h4>
        <p>Este panel ya puede albergar trazabilidad, contexto ampliado, notas futuras e historial sin rehacer la estructura base.</p>
      </article>
    `);
  }

  return cards.join("");
}

function buildDashboardCollectionDetailMetaRows(rows) {
  return rows
    .map(
      ([label, value]) => `
        <div class="dashboard-collection-detail-meta-row">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
        </div>
      `
    )
    .join("");
}

function buildDashboardCollectionEmptyState(title, text) {
  return `
    <article class="empty-state dashboard-collection-detail-empty">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(text)}</p>
    </article>
  `;
}

function buildDashboardProjectDetailCards(projects) {
  return projects
    .map((project, index) => {
      const linkedOutput = appState.outputs.find(
        (output) => output.id === (project.sourceOutputId || project.origenSalidaId)
      ) || null;
      const linkedIdea = linkedOutput
        ? appState.ideas.find((idea) => idea.id === linkedOutput.ideaId) || null
        : null;
      const contextText = project.expectedResult
        || linkedOutput?.problem
        || linkedIdea?.note
        || "Sin descripción larga guardada. Este proyecto solo tiene su estructura operativa actual.";
      const supportNotes = [
        linkedOutput?.minimumVersion ? `Versión mínima: ${linkedOutput.minimumVersion}` : "",
        linkedOutput?.timing ? `Momento sugerido: ${linkedOutput.timing}` : "",
        linkedIdea?.source ? `Fuente: ${linkedIdea.source}` : "",
      ].filter(Boolean).join(" | ") || "Sin notas secundarias registradas por ahora.";
      const detailRows = buildDashboardCollectionDetailMetaRows([
        ["Estado", project.status || "activo"],
        ["Prioridad", project.priority || "media"],
        ["Área", project.area || "Sin área"],
        ["Activado", formatDate(project.activatedAt || project.fechaActivacion || project.createdAt || project.updatedAt)],
        ["Actualizado", formatDate(project.updatedAt || project.activatedAt || project.createdAt)],
        ["Origen", linkedOutput ? "Salida operativa vinculada" : "Proyecto legado"],
      ]);

      return `
        <section class="form-block dashboard-collection-detail-item">
          <div class="dashboard-collection-detail-head">
            <div class="dashboard-collection-detail-heading">
              <p class="dashboard-collection-detail-kicker">Proyecto activo ${index + 1}</p>
              <h3>${escapeHtml(project.name || "Sin nombre")}</h3>
            </div>
            <span class="status-badge status-${normalizeText(project.status || "activo").replace(/\s+/g, "-")}">
              ${escapeHtml(project.status || "activo")}
            </span>
          </div>

          <div class="dashboard-collection-detail-summary">
            <div>
              <p class="context-label">Resultado</p>
              <p class="dashboard-collection-detail-copy">${escapeHtml(project.expectedResult || "Sin resultado esperado visible.")}</p>
            </div>
            <div>
              <p class="context-label">Siguiente paso</p>
              <p class="dashboard-collection-detail-copy">${escapeHtml(project.nextAction || "Sin siguiente paso visible.")}</p>
            </div>
          </div>

          <div class="dashboard-collection-detail-summary">
            <div>
              <p class="context-label">Contexto</p>
              <p class="dashboard-collection-detail-copy">${escapeHtml(contextText)}</p>
            </div>
            <div>
              <p class="context-label">Notas útiles</p>
              <p class="dashboard-collection-detail-copy">${escapeHtml(supportNotes)}</p>
            </div>
          </div>

          <div class="dashboard-collection-detail-meta-grid">
            ${detailRows}
          </div>
        </section>
      `;
    })
    .join("");
}

function buildDashboardPriorityDetailCards(priorities) {
  return priorities
    .map((priority, index) => {
      const detailRows = buildDashboardCollectionDetailMetaRows([
        ["Estado", priority.status || "activa"],
        ["Actualizada", formatDate(priority.updatedAt)],
        ["Posición visible", `${index + 1} de ${priorities.length}`],
      ]);

      return `
        <section class="form-block dashboard-collection-detail-item">
          <div class="dashboard-collection-detail-head">
            <div class="dashboard-collection-detail-heading">
              <p class="dashboard-collection-detail-kicker">Prioridad activa ${index + 1}</p>
              <h3>${escapeHtml(priority.title || "Sin título")}</h3>
            </div>
            <span class="status-badge status-${normalizeText(priority.status || "activa").replace(/\s+/g, "-")}">
              ${escapeHtml(priority.status || "activa")}
            </span>
          </div>

          <div class="dashboard-collection-detail-summary dashboard-collection-detail-summary-single">
            <div>
              <p class="context-label">Lectura actual</p>
              <p class="dashboard-collection-detail-copy">
                No hay descripción larga guardada para esta prioridad. La referencia disponible hoy es su título operativo, su estado y su última actualización.
              </p>
            </div>
          </div>

          <div class="dashboard-collection-detail-meta-grid">
            ${detailRows}
          </div>
        </section>
      `;
    })
    .join("");
}

export function renderDashboardCollectionDetailPanel() {
  const detailType = uiState.dashboardCollectionDetailType;

  if (!detailType) {
    elements.dashboardCollectionDetailTitle.textContent = "Detalles";
    elements.dashboardCollectionDetailContextTitle.textContent = "Sin elementos activos";
    elements.dashboardCollectionDetailContextMeta.textContent = "";
    elements.dashboardCollectionDetailList.innerHTML = "";
    setDashboardCollectionDetailPanelVisibility(false);
    return;
  }

  if (detailType === "projects") {
    const projects = getProjectsSorted()
      .filter((project) => project.status === "activo")
      .slice(0, 3);

    elements.dashboardCollectionDetailTitle.textContent = "Detalles de proyectos activos";
    elements.dashboardCollectionDetailContextTitle.textContent = projects.length
      ? `${projects.length} proyecto${projects.length === 1 ? "" : "s"} activo${projects.length === 1 ? "" : "s"}`
      : "Sin proyectos activos";
    elements.dashboardCollectionDetailContextMeta.textContent = projects.length
      ? "Se muestran hasta 3 proyectos activos con el mejor contexto disponible dentro de la base actual."
      : "Cuando actives un proyecto, aquí verás su resultado, siguiente paso y contexto operativo.";
    elements.dashboardCollectionDetailList.innerHTML = projects.length
      ? buildDashboardProjectDetailCards(projects)
      : buildDashboardCollectionEmptyState(
          "No hay proyectos activos",
          "Activa un proyecto desde la capa operativa para verlo aquí con más contexto."
        );
    setDashboardCollectionDetailPanelVisibility(true);
    return;
  }

  const priorities = getPrioritiesSorted()
    .filter((priority) => priority.status !== "completada")
    .slice(0, 3);

  elements.dashboardCollectionDetailTitle.textContent = "Detalles de prioridades activas";
  elements.dashboardCollectionDetailContextTitle.textContent = priorities.length
    ? `${priorities.length} prioridad${priorities.length === 1 ? "" : "es"} activa${priorities.length === 1 ? "" : "s"}`
    : "Sin prioridades activas";
  elements.dashboardCollectionDetailContextMeta.textContent = priorities.length
    ? "Se muestran hasta 3 prioridades activas usando la información operativa ya guardada."
    : "Cuando definas prioridades activas, aquí tendrás una lectura rápida sin entrar al bloque de edición.";
  elements.dashboardCollectionDetailList.innerHTML = priorities.length
    ? buildDashboardPriorityDetailCards(priorities)
    : buildDashboardCollectionEmptyState(
        "No hay prioridades activas",
        "Define prioridades en la sección operativa y este panel mostrará su lectura ampliada."
      );
  setDashboardCollectionDetailPanelVisibility(true);
}

export function renderProcessPanel() {
  const currentIdea = getIdeaById(uiState.processingIdeaId);

  if (!currentIdea) {
    elements.processIdeaTitle.textContent = "Sin idea seleccionada";
    elements.processIdeaMeta.textContent = "";
    resetProcessForm();
    setProcessPanelVisibility(false);
    return;
  }

  elements.processIdeaTitle.textContent = currentIdea.title;
  elements.processIdeaMeta.textContent =
    `Capturada el ${formatDate(currentIdea.createdAt)}` +
    (currentIdea.source ? ` - Fuente: ${currentIdea.source}` : "");
  elements.processIdeaTitleField.value = currentIdea.title || "";
  elements.processIdeaSourceField.value = currentIdea.source || "";

  const processProblemState = getSelectableFieldState(
    currentIdea.processing?.problem,
    PROBLEM_PRESET_OPTIONS,
    LEGACY_PROBLEM_MAP
  );
  const processPurposeState = getSelectableFieldState(
    currentIdea.processing?.purpose,
    PURPOSE_PRESET_OPTIONS,
    LEGACY_PURPOSE_MAP
  );
  const processAreaState = getSelectableFieldState(currentIdea.processing?.area, AREA_PRESET_OPTIONS, {});
  const processTimingState = getSelectableFieldState(currentIdea.processing?.timing, TIMING_PRESET_OPTIONS, {});

  elements.problemField.value = processProblemState.presetValue;
  elements.problemCustomField.value = processProblemState.customValue;
  setConditionalSelectFieldVisibility(
    elements.problemField,
    elements.problemCustomFieldWrapper,
    elements.problemCustomField
  );
  elements.purposeField.value = processPurposeState.presetValue;
  elements.purposeCustomField.value = processPurposeState.customValue;
  setConditionalSelectFieldVisibility(
    elements.purposeField,
    elements.purposeCustomFieldWrapper,
    elements.purposeCustomField
  );
  elements.areaField.value = processAreaState.presetValue;
  elements.areaCustomField.value = processAreaState.customValue;
  setConditionalSelectFieldVisibility(
    elements.areaField,
    elements.areaCustomFieldWrapper,
    elements.areaCustomField
  );
  elements.timingField.value = processTimingState.presetValue;
  elements.timingCustomField.value = processTimingState.customValue;
  setConditionalSelectFieldVisibility(
    elements.timingField,
    elements.timingCustomFieldWrapper,
    elements.timingCustomField
  );
  elements.minimumVersionField.value = currentIdea.processing?.minimumVersion || "";
  elements.outputTypeField.value = currentIdea.processing?.outputType || "";

  setProcessPanelVisibility(true);
}

export function renderIdeaDetailPanel() {
  const currentIdea = getIdeaById(uiState.viewingIdeaId);

  if (!currentIdea) {
    elements.ideaDetailContextTitle.textContent = "Sin idea seleccionada";
    elements.ideaDetailContextMeta.textContent = "";
    elements.ideaDetailDescription.textContent = "Sin contenido ampliado.";
    elements.ideaDetailMetaList.innerHTML = "";
    syncIdeaSupportDocSection();
    elements.ideaDetailTraceList.innerHTML = "";
    elements.ideaDetailActions.innerHTML = "";
    elements.ideaDetailFeedback.textContent = "";
    elements.ideaDetailFeedback.classList.remove("is-visible", "is-error");
    setIdeaDetailPanelVisibility(false);
    return;
  }

  const linkedOutput = getOutputByIdeaId(currentIdea.id);
  const linkedProject = linkedOutput ? getProjectFromOutput(linkedOutput.id) : null;
  const isArchived = currentIdea.status === "archivada";

  elements.ideaDetailContextTitle.textContent = currentIdea.title;
  elements.ideaDetailContextMeta.textContent =
    `Capturada el ${formatDate(currentIdea.createdAt)}` +
    (currentIdea.source ? ` - Fuente: ${currentIdea.source}` : " - Sin fuente declarada");
  elements.ideaDetailDescription.textContent = currentIdea.note || "Sin descripción ampliada. Esta idea solo tiene título y metadatos básicos por ahora.";
  elements.ideaDetailMetaList.innerHTML = buildIdeaDetailMetaHtml(currentIdea);
  syncIdeaSupportDocSection(currentIdea);
  elements.ideaDetailTraceList.innerHTML = buildIdeaTraceCards(currentIdea, linkedOutput, linkedProject);
  elements.ideaDetailActions.innerHTML = `
    <button
      class="button button-primary"
      type="button"
      data-detail-action="process"
      data-id="${currentIdea.id}"
      ${isArchived ? "disabled" : ""}
    >
      Procesar
    </button>
    <button
      class="button button-secondary"
      type="button"
      data-detail-action="archive"
      data-id="${currentIdea.id}"
      ${isArchived ? "disabled" : ""}
    >
      ${isArchived ? "Archivada" : "Archivar"}
    </button>
    <button
      class="button button-secondary"
      type="button"
      data-detail-action="close"
    >
      Cerrar
    </button>
    <button
      class="button button-secondary action-button-danger"
      type="button"
      data-detail-action="delete"
      data-id="${currentIdea.id}"
    >
      Eliminar
    </button>
  `;
  elements.ideaDetailFeedback.textContent = "";
  elements.ideaDetailFeedback.classList.remove("is-visible", "is-error");
  setIdeaDetailPanelVisibility(true);
}

export function renderOutputEditPanel() {
  const currentOutput = getOutputById(uiState.editingOutputId);

  if (!currentOutput) {
    elements.outputEditContextTitle.textContent = "Sin salida seleccionada";
    elements.outputEditContextMeta.textContent = "";
    resetOutputEditForm();
    setOutputEditPanelVisibility(false);
    return;
  }

  const linkedIdea = getIdeaById(currentOutput.ideaId);
  const linkedProject = getProjectFromOutput(currentOutput.id);
  const isOutputTypeLocked = Boolean(linkedProject);

  elements.outputEditContextTitle.textContent = currentOutput.ideaTitle;
  elements.outputEditContextMeta.textContent =
    `Última actualización ${formatDate(currentOutput.updatedAt)}` +
    (linkedIdea ? " - Vinculada al inbox" : " - Sin idea vinculada");

  elements.editOutputTitleField.value = currentOutput.ideaTitle || "";
  const editProblemState = getSelectableFieldState(
    currentOutput.problem,
    PROBLEM_PRESET_OPTIONS,
    LEGACY_PROBLEM_MAP
  );
  const editPurposeState = getSelectableFieldState(
    currentOutput.purpose,
    PURPOSE_PRESET_OPTIONS,
    LEGACY_PURPOSE_MAP
  );
  const editAreaState = getSelectableFieldState(currentOutput.area, AREA_PRESET_OPTIONS, {});
  const editTimingState = getSelectableFieldState(currentOutput.timing, TIMING_PRESET_OPTIONS, {});

  elements.editOutputProblemField.value = editProblemState.presetValue;
  elements.editOutputProblemCustomField.value = editProblemState.customValue;
  setConditionalSelectFieldVisibility(
    elements.editOutputProblemField,
    elements.editOutputProblemCustomFieldWrapper,
    elements.editOutputProblemCustomField
  );
  elements.editOutputPurposeField.value = editPurposeState.presetValue;
  elements.editOutputPurposeCustomField.value = editPurposeState.customValue;
  setConditionalSelectFieldVisibility(
    elements.editOutputPurposeField,
    elements.editOutputPurposeCustomFieldWrapper,
    elements.editOutputPurposeCustomField
  );
  elements.editOutputAreaField.value = editAreaState.presetValue;
  elements.editOutputAreaCustomField.value = editAreaState.customValue;
  setConditionalSelectFieldVisibility(
    elements.editOutputAreaField,
    elements.editOutputAreaCustomFieldWrapper,
    elements.editOutputAreaCustomField
  );
  elements.editOutputTimingField.value = editTimingState.presetValue;
  elements.editOutputTimingCustomField.value = editTimingState.customValue;
  setConditionalSelectFieldVisibility(
    elements.editOutputTimingField,
    elements.editOutputTimingCustomFieldWrapper,
    elements.editOutputTimingCustomField
  );
  elements.editOutputMinimumVersionField.value = currentOutput.minimumVersion || "";
  elements.editOutputTypeField.value = currentOutput.outputType || "";
  elements.editOutputTypeField.disabled = isOutputTypeLocked;

  if (elements.editOutputTypeLockNote) {
    elements.editOutputTypeLockNote.hidden = !isOutputTypeLocked;
  }

  setOutputEditPanelVisibility(true);
}

export function renderProjectEditPanel() {
  const activationOutput = uiState.activatingProjectOutputId
    ? getOutputById(uiState.activatingProjectOutputId)
    : null;
  const currentProject = getProjectById(uiState.editingProjectId);
  const isActivationMode = Boolean(activationOutput) && !currentProject;

  if (!currentProject && !activationOutput) {
    elements.projectEditContextTitle.textContent = "Sin proyecto seleccionado";
    elements.projectEditContextMeta.textContent = "";
    elements.projectEditReference.textContent = "";
    elements.projectEditReference.hidden = true;
    resetProjectEditForm();
    setProjectEditPanelVisibility(false);
    return;
  }

  const linkedOutput = isActivationMode
    ? activationOutput
    : currentProject.sourceOutputId
      ? getOutputById(currentProject.sourceOutputId)
      : null;
  const projectName = isActivationMode ? activationOutput.ideaTitle : currentProject.name;
  const projectResult = isActivationMode ? activationOutput.purpose : currentProject.expectedResult;
  const projectArea = isActivationMode ? activationOutput.area : currentProject.area;
  const projectPriority = isActivationMode ? "media" : currentProject.priority;
  const projectNextAction = isActivationMode ? "" : currentProject.nextAction;
  const projectStatus = isActivationMode ? "activo" : currentProject.status;
  const projectAreaState = getSelectableFieldState(projectArea, AREA_PRESET_OPTIONS, {});

  elements.projectEditKicker.textContent = isActivationMode ? "Activación de proyecto" : "Edición de proyecto";
  elements.projectEditTitle.textContent = isActivationMode ? "Activar proyecto" : "Editar proyecto";
  elements.projectEditContextLabel.textContent = isActivationMode ? "Salida original" : "Proyecto seleccionado";
  elements.projectEditContextTitle.textContent = projectName;
  elements.projectEditContextMeta.textContent = isActivationMode
    ? `Salida tipo proyecto actualizada ${formatDate(activationOutput.updatedAt)}`
    : `Última actualización ${formatDate(currentProject.updatedAt)}`
      + (linkedOutput ? " - Vinculado a una salida operativa" : " - Proyecto legado");
  elements.projectEditReference.textContent = linkedOutput?.minimumVersion
    ? `Versión mínima de referencia: ${linkedOutput.minimumVersion}`
    : "";
  elements.projectEditReference.hidden = !elements.projectEditReference.textContent;

  elements.projectEditGuidePrimaryTitle.textContent = isActivationMode
    ? "Activar proyecto"
    : "Qué puedes ajustar aquí";
  elements.projectEditGuidePrimaryText.textContent = isActivationMode
    ? "Haz que esta idea entre en ejecución definiendo qué resultado buscas y cuál es el siguiente paso."
    : "Puedes corregir el nombre, el resultado esperado y el siguiente paso para mantener el proyecto claro y movible.";
  elements.projectEditGuideSecondaryTitle.textContent = isActivationMode
    ? "Contexto de la salida original"
    : "Coherencia operativa";
  elements.projectEditGuideSecondaryText.textContent = isActivationMode
    ? "La salida original se mantiene. Usa su área y su versión mínima como referencia, pero ajusta estos mínimos a la ejecución real."
    : "Si este proyecto viene de una salida operativa, mantendremos sincronizados el título y el área para evitar contradicciones innecesarias.";
  elements.projectEditSettingsLabel.textContent = isActivationMode ? "Mínimos operativos" : "Estado operativo";
  elements.projectEditSettingsHelp.textContent = isActivationMode
    ? "Define solo lo necesario para comprometer este proyecto a ejecución real."
    : "Puedes cambiar prioridad, estado y área sin tener que borrar o recrear el proyecto.";
  elements.projectEditStatusWrapper.hidden = isActivationMode;
  elements.saveProjectEditButton.dataset.defaultLabel = isActivationMode ? "Activar proyecto" : "Guardar cambios";
  setProjectEditSaveButtonState(false);

  elements.editProjectNameField.value = projectName || "";
  elements.editProjectResultField.value = projectResult || "";
  elements.editProjectNextActionField.value = projectNextAction || "";
  elements.editProjectPriorityField.value = projectPriority || "media";
  elements.editProjectStatusField.value = projectStatus || "activo";
  elements.editProjectAreaField.value = projectAreaState.presetValue;
  elements.editProjectAreaCustomField.value = projectAreaState.customValue;
  setConditionalSelectFieldVisibility(
    elements.editProjectAreaField,
    elements.editProjectAreaCustomFieldWrapper,
    elements.editProjectAreaCustomField
  );

  setProjectEditPanelVisibility(true);
}

export function openProcessPanel(ideaId) {
  uiState.processingIdeaId = ideaId;
  renderProcessPanel();
}

export function closeProcessPanel() {
  uiState.processingIdeaId = null;
  renderProcessPanel();
}

export function openIdeaDetailPanel(ideaId) {
  uiState.viewingIdeaId = ideaId;
  renderIdeaDetailPanel();
}

export function closeIdeaDetailPanel() {
  uiState.viewingIdeaId = null;
  renderIdeaDetailPanel();
}

export function openDashboardCollectionDetailPanel(detailType) {
  uiState.dashboardCollectionDetailType = detailType;
  renderDashboardCollectionDetailPanel();
}

export function closeDashboardCollectionDetailPanel() {
  uiState.dashboardCollectionDetailType = "";
  renderDashboardCollectionDetailPanel();
}

export function openOutputEditPanel(outputId) {
  uiState.editingOutputId = outputId;
  renderOutputEditPanel();
}

export function closeOutputEditPanel() {
  uiState.editingOutputId = null;
  renderOutputEditPanel();
}

export function openProjectEditPanel(projectId) {
  uiState.activatingProjectOutputId = null;
  uiState.editingProjectId = projectId;
  renderProjectEditPanel();
}

export function closeProjectEditPanel() {
  uiState.editingProjectId = null;
  uiState.activatingProjectOutputId = null;
  renderProjectEditPanel();
}

export function openProjectActivationPanel(outputId) {
  uiState.editingProjectId = null;
  uiState.activatingProjectOutputId = outputId;
  renderProjectEditPanel();
}
