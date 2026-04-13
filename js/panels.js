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
  getIdeaById,
  getOutputById,
  getOutputByIdeaId,
  getProjectFromOutput,
  getProjectById,
  uiState,
} from "./state.js";
import {
  escapeHtml,
  formatCatalogLabel,
  formatDate,
  getSelectableFieldState,
} from "./utils.js";
import {
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
