/*
  Handlers del inbox, procesamiento guiado y edición de salidas.
*/

import { elements } from "./dom.js";
import {
  renderApp,
  renderDashboard,
  renderTodayAction,
} from "./render-core.js";
import {
  renderIdeas,
  renderInboxFilters,
} from "./render-ideas.js";
import {
  closeIdeaDetailPanel,
  closeOutputEditPanel,
  closeProcessPanel,
  openIdeaDetailPanel,
  openProjectActivationPanel,
  openOutputEditPanel,
  openProcessPanel,
  renderIdeaDetailPanel,
} from "./panels.js";
import {
  appState,
  buildOutputFromIdea,
  getIdeaById,
  getOutputById,
  getProjectFromOutput,
  hasActivatedProjectFromIdea,
  removeOutputByIdeaId,
  uiState,
} from "./state.js";
import { saveState } from "./storage.js";
import {
  createId,
  getResolvedSelectFieldValue,
} from "./utils.js";
import {
  setConditionalSelectFieldVisibility,
  setFeedbackTimeout,
  setOutputSaveButtonState,
  setTodayActionSaveButtonState,
} from "./ui-helpers.js";

function setIdeasFeedback(message = "", isError = false) {
  if (!elements.ideasFeedback) {
    return;
  }

  elements.ideasFeedback.textContent = message;
  elements.ideasFeedback.classList.toggle("is-visible", Boolean(message));
  elements.ideasFeedback.classList.toggle("is-error", isError);
}

function setIdeaDetailFeedback(message = "", isError = false) {
  if (!elements.ideaDetailFeedback) {
    return;
  }

  elements.ideaDetailFeedback.textContent = message;
  elements.ideaDetailFeedback.classList.toggle("is-visible", Boolean(message));
  elements.ideaDetailFeedback.classList.toggle("is-error", isError);
}

function normalizeSupportDocUrl(value = "") {
  return String(value || "").trim();
}

function isExternalDocumentUrl(value = "") {
  return /^https?:\/\//i.test(normalizeSupportDocUrl(value));
}

function runIdeaAction(action, ideaId, origin = "card") {
  const idea = getIdeaById(ideaId);

  if (!idea) {
    return;
  }

  if (origin === "detail") {
    setIdeaDetailFeedback("");
  }

  if (action === "details") {
    openIdeaDetailPanel(ideaId);
    return;
  }

  if (action === "process") {
    if (origin === "detail") {
      closeIdeaDetailPanel();
    }
    openProcessPanel(ideaId);
    return;
  }

  if (action === "archive") {
    setIdeasFeedback("");
    idea.status = "archivada";
    saveState(appState);
    renderApp();
    return;
  }

  if (action !== "delete") {
    return;
  }

  if (hasActivatedProjectFromIdea(ideaId)) {
    const traceabilityMessage =
      "No puedes borrar esta idea porque ya generó una salida activada como proyecto. Conserva la idea para mantener la trazabilidad del sistema.";
    setIdeasFeedback(traceabilityMessage, true);

    if (origin === "detail") {
      setIdeaDetailFeedback(traceabilityMessage, true);
      setFeedbackTimeout("ideaDetail", () => {
        setIdeaDetailFeedback("");
      }, 3200);
    }

    setFeedbackTimeout("ideas", () => {
      setIdeasFeedback("");
    }, 3200);
    return;
  }

  setIdeasFeedback("");
  appState.ideas = appState.ideas.filter((currentIdea) => currentIdea.id !== ideaId);
  removeOutputByIdeaId(ideaId);

  if (uiState.processingIdeaId === ideaId) {
    uiState.processingIdeaId = null;
  }

  if (uiState.viewingIdeaId === ideaId) {
    uiState.viewingIdeaId = null;
  }

  saveState(appState);
  renderApp();
}

export function handleCaptureSubmit(event) {
  event.preventDefault();

  const formData = new FormData(elements.captureForm);
  const title = String(formData.get("title") || "").trim();
  const note = String(formData.get("note") || "").trim();
  const source = String(formData.get("source") || "").trim();

  if (!title) {
    elements.titleField.focus();
    return;
  }

  appState.ideas.push({
    id: createId("idea"),
    title,
    note,
    source,
    supportDocUrl: "",
    createdAt: new Date().toISOString(),
    status: "pendiente",
    processing: null,
  });

  saveState(appState);
  elements.captureForm.reset();
  renderApp();
  elements.titleField.focus();
}

export function handleIdeaSearchInput(event) {
  uiState.ideaSearchText = event.target.value;
  renderIdeas();
  renderInboxFilters(uiState.activeIdeaFilter, uiState.ideaSearchText, elements.statusFilterButtons);
}

export function handleStatusFilterClick(event) {
  const filterButton = event.target.closest(".status-filter");

  if (!filterButton) {
    return;
  }

  uiState.activeIdeaFilter = filterButton.dataset.filter || "todas";
  renderIdeas();
  renderInboxFilters(uiState.activeIdeaFilter, uiState.ideaSearchText, elements.statusFilterButtons);
}

export function handleProblemFieldChange(event) {
  setConditionalSelectFieldVisibility(
    event.target,
    elements.problemCustomFieldWrapper,
    elements.problemCustomField
  );
}

export function handleEditOutputProblemFieldChange(event) {
  setConditionalSelectFieldVisibility(
    event.target,
    elements.editOutputProblemCustomFieldWrapper,
    elements.editOutputProblemCustomField
  );
}

export function handlePurposeFieldChange(event) {
  setConditionalSelectFieldVisibility(
    event.target,
    elements.purposeCustomFieldWrapper,
    elements.purposeCustomField
  );
}

export function handleAreaFieldChange(event) {
  setConditionalSelectFieldVisibility(
    event.target,
    elements.areaCustomFieldWrapper,
    elements.areaCustomField
  );
}

export function handleTimingFieldChange(event) {
  setConditionalSelectFieldVisibility(
    event.target,
    elements.timingCustomFieldWrapper,
    elements.timingCustomField
  );
}

export function handleEditOutputPurposeFieldChange(event) {
  setConditionalSelectFieldVisibility(
    event.target,
    elements.editOutputPurposeCustomFieldWrapper,
    elements.editOutputPurposeCustomField
  );
}

export function handleEditOutputAreaFieldChange(event) {
  setConditionalSelectFieldVisibility(
    event.target,
    elements.editOutputAreaCustomFieldWrapper,
    elements.editOutputAreaCustomField
  );
}

export function handleEditOutputTimingFieldChange(event) {
  setConditionalSelectFieldVisibility(
    event.target,
    elements.editOutputTimingCustomFieldWrapper,
    elements.editOutputTimingCustomField
  );
}

export function handleIdeaCardClick(event) {
  const actionButton = event.target.closest("[data-action]");

  if (!actionButton) {
    return;
  }

  runIdeaAction(actionButton.dataset.action, actionButton.dataset.id, "card");
}

export function handleIdeaDetailActionClick(event) {
  const actionButton = event.target.closest("[data-detail-action]");

  if (!actionButton) {
    return;
  }

  const action = actionButton.dataset.detailAction;

  if (action === "close") {
    closeIdeaDetailPanel();
    return;
  }

  runIdeaAction(action, actionButton.dataset.id, "detail");
}

export function handleIdeaSupportDocSubmit(event) {
  event.preventDefault();

  const idea = getIdeaById(uiState.viewingIdeaId);

  if (!idea) {
    closeIdeaDetailPanel();
    return;
  }

  const nextSupportDocUrl = normalizeSupportDocUrl(elements.ideaSupportDocUrlField?.value);
  setIdeaDetailFeedback("");

  if (nextSupportDocUrl && !isExternalDocumentUrl(nextSupportDocUrl)) {
    setIdeaDetailFeedback("Pega una URL completa que empiece con http:// o https://.", true);
    elements.ideaSupportDocUrlField?.focus();
    return;
  }

  idea.supportDocUrl = nextSupportDocUrl;
  const didSave = saveState(appState);

  renderIdeaDetailPanel();

  if (!didSave) {
    setIdeaDetailFeedback(
      "No se pudo guardar el documento de apoyo. El cambio puede perderse si recargas.",
      true
    );
    return;
  }

  setIdeaDetailFeedback(
    nextSupportDocUrl ? "Documento de apoyo guardado." : "Documento de apoyo eliminado."
  );
  setFeedbackTimeout("ideaDetail", () => {
    setIdeaDetailFeedback("");
  });
}

export function handleOutputCardClick(event) {
  const actionButton = event.target.closest("[data-output-action]");

  if (!actionButton) {
    return;
  }

  const outputId = actionButton.dataset.outputId;
  const action = actionButton.dataset.outputAction;
  const output = getOutputById(outputId);

  if (!output) {
    return;
  }

  if (action === "edit") {
    openOutputEditPanel(outputId);
    return;
  }

  if (action === "send-today") {
    appState.todayAction = output.minimumVersion || output.ideaTitle;
    uiState.dashboardActionState = "idle";
    uiState.dashboardLastCompletedText = "";
    uiState.dashboardTodayActionPaused = false;
    saveState(appState);
    renderTodayAction();
    renderDashboard();
    setTodayActionSaveButtonState(true, "Acción recibida desde una salida operativa");
    setFeedbackTimeout("todayAction", () => {
      setTodayActionSaveButtonState(false);
    });
    return;
  }

  if (action === "activate-project") {
    openProjectActivationPanel(output.id);
  }
}

export function handleProcessSubmit(event) {
  event.preventDefault();

  const idea = getIdeaById(uiState.processingIdeaId);

  if (!idea) {
    closeProcessPanel();
    return;
  }

  const formData = new FormData(elements.processForm);
  const resolvedProblem = getResolvedSelectFieldValue(
    formData.get("problem"),
    formData.get("problemCustom")
  );
  const resolvedPurpose = getResolvedSelectFieldValue(
    formData.get("purpose"),
    formData.get("purposeCustom")
  );
  const resolvedArea = getResolvedSelectFieldValue(
    formData.get("area"),
    formData.get("areaCustom")
  );
  const resolvedTiming = getResolvedSelectFieldValue(
    formData.get("timing"),
    formData.get("timingCustom")
  );

  if (!resolvedProblem) {
    if (String(formData.get("problem") || "").trim() === "otro") {
      elements.problemCustomField.focus();
    } else {
      elements.problemField.focus();
    }
    return;
  }

  if (!resolvedPurpose) {
    if (String(formData.get("purpose") || "").trim() === "otro") {
      elements.purposeCustomField.focus();
    } else {
      elements.purposeField.focus();
    }
    return;
  }

  if (!resolvedArea) {
    if (String(formData.get("area") || "").trim() === "otro") {
      elements.areaCustomField.focus();
    } else {
      elements.areaField.focus();
    }
    return;
  }

  if (!resolvedTiming) {
    if (String(formData.get("timing") || "").trim() === "otro") {
      elements.timingCustomField.focus();
    } else {
      elements.timingField.focus();
    }
    return;
  }

  idea.processing = {
    problem: resolvedProblem,
    purpose: resolvedPurpose,
    area: resolvedArea,
    timing: resolvedTiming,
    minimumVersion: String(formData.get("minimumVersion") || "").trim(),
    outputType: String(formData.get("outputType") || "").trim(),
  };

  idea.status = "procesada";
  removeOutputByIdeaId(idea.id);
  appState.outputs.push(buildOutputFromIdea(idea));

  saveState(appState);
  closeProcessPanel();
  renderApp();
}

export function handleOutputEditSubmit(event) {
  event.preventDefault();

  const output = getOutputById(uiState.editingOutputId);

  if (!output) {
    closeOutputEditPanel();
    return;
  }

  const formData = new FormData(elements.outputEditForm);
  const resolvedProblem = getResolvedSelectFieldValue(
    formData.get("problem"),
    formData.get("problemCustom")
  );
  const resolvedPurpose = getResolvedSelectFieldValue(
    formData.get("purpose"),
    formData.get("purposeCustom")
  );
  const resolvedArea = getResolvedSelectFieldValue(
    formData.get("area"),
    formData.get("areaCustom")
  );
  const resolvedTiming = getResolvedSelectFieldValue(
    formData.get("timing"),
    formData.get("timingCustom")
  );
  const linkedProject = getProjectFromOutput(output.id);
  const requestedOutputType = String(formData.get("outputType") || "").trim();

  if (!resolvedProblem) {
    if (String(formData.get("problem") || "").trim() === "otro") {
      elements.editOutputProblemCustomField.focus();
    } else {
      elements.editOutputProblemField.focus();
    }
    return;
  }

  if (!resolvedPurpose) {
    if (String(formData.get("purpose") || "").trim() === "otro") {
      elements.editOutputPurposeCustomField.focus();
    } else {
      elements.editOutputPurposeField.focus();
    }
    return;
  }

  if (!resolvedArea) {
    if (String(formData.get("area") || "").trim() === "otro") {
      elements.editOutputAreaCustomField.focus();
    } else {
      elements.editOutputAreaField.focus();
    }
    return;
  }

  if (!resolvedTiming) {
    if (String(formData.get("timing") || "").trim() === "otro") {
      elements.editOutputTimingCustomField.focus();
    } else {
      elements.editOutputTimingField.focus();
    }
    return;
  }

  if (linkedProject && requestedOutputType && requestedOutputType !== output.outputType) {
    setOutputSaveButtonState(
      true,
      "No puedes cambiar el tipo de esta salida porque ya fue activada como proyecto.",
      true
    );
    return;
  }

  const previousOutput = {
    ideaTitle: output.ideaTitle,
    problem: output.problem,
    purpose: output.purpose,
    area: output.area,
    timing: output.timing,
    minimumVersion: output.minimumVersion,
    outputType: output.outputType,
    updatedAt: output.updatedAt,
  };

  output.ideaTitle = String(formData.get("ideaTitle") || "").trim();
  output.problem = resolvedProblem;
  output.purpose = resolvedPurpose;
  output.area = resolvedArea;
  output.timing = resolvedTiming;
  output.minimumVersion = String(formData.get("minimumVersion") || "").trim();
  output.outputType = linkedProject ? output.outputType : requestedOutputType;
  output.updatedAt = new Date().toISOString();

  const linkedIdea = getIdeaById(output.ideaId);
  const previousIdea = linkedIdea
    ? {
        title: linkedIdea.title,
        status: linkedIdea.status,
        processing: linkedIdea.processing ? { ...linkedIdea.processing } : null,
      }
    : null;
  const previousProject = linkedProject
    ? {
        name: linkedProject.name,
        nombre: linkedProject.nombre,
        area: linkedProject.area,
        origenSalidaId: linkedProject.origenSalidaId,
        resultadoEsperado: linkedProject.resultadoEsperado,
        siguienteAccion: linkedProject.siguienteAccion,
        prioridad: linkedProject.prioridad,
        estado: linkedProject.estado,
        fechaCreacion: linkedProject.fechaCreacion,
        fechaActivacion: linkedProject.fechaActivacion,
        updatedAt: linkedProject.updatedAt,
      }
    : null;

  if (linkedIdea) {
    linkedIdea.title = output.ideaTitle;
    linkedIdea.processing = {
      problem: output.problem,
      purpose: output.purpose,
      area: output.area,
      timing: output.timing,
      minimumVersion: output.minimumVersion,
      outputType: output.outputType,
    };

    if (linkedIdea.status === "pendiente") {
      linkedIdea.status = "procesada";
    }
  }

  if (linkedProject) {
    linkedProject.name = output.ideaTitle;
    linkedProject.nombre = linkedProject.name;
    linkedProject.area = output.area;
    linkedProject.origenSalidaId = linkedProject.sourceOutputId;
    linkedProject.resultadoEsperado = linkedProject.expectedResult;
    linkedProject.siguienteAccion = linkedProject.nextAction;
    linkedProject.prioridad = linkedProject.priority;
    linkedProject.estado = linkedProject.status;
    linkedProject.fechaCreacion = linkedProject.createdAt;
    linkedProject.fechaActivacion = linkedProject.activatedAt;
    linkedProject.updatedAt = new Date().toISOString();
  }

  const didSave = saveState(appState);

  if (!didSave) {
    Object.assign(output, previousOutput);

    if (linkedIdea && previousIdea) {
      linkedIdea.title = previousIdea.title;
      linkedIdea.status = previousIdea.status;
      linkedIdea.processing = previousIdea.processing ? { ...previousIdea.processing } : null;
    }

    if (linkedProject && previousProject) {
      Object.assign(linkedProject, previousProject);
    }

    setOutputSaveButtonState(
      true,
      "No se pudieron guardar los cambios. La salida sigue igual hasta que el guardado funcione.",
      true
    );
    return;
  }

  renderApp();
  setOutputSaveButtonState(true, "Salida actualizada y guardada");
  setFeedbackTimeout("output", () => {
    setOutputSaveButtonState(false);
  });
}

export function bindIdeasEvents() {
  elements.captureForm.addEventListener("submit", handleCaptureSubmit);
  elements.processForm.addEventListener("submit", handleProcessSubmit);
  elements.outputEditForm.addEventListener("submit", handleOutputEditSubmit);
  elements.ideaSupportDocForm.addEventListener("submit", handleIdeaSupportDocSubmit);
  elements.problemField.addEventListener("change", handleProblemFieldChange);
  elements.purposeField.addEventListener("change", handlePurposeFieldChange);
  elements.areaField.addEventListener("change", handleAreaFieldChange);
  elements.timingField.addEventListener("change", handleTimingFieldChange);
  elements.editOutputProblemField.addEventListener("change", handleEditOutputProblemFieldChange);
  elements.editOutputPurposeField.addEventListener("change", handleEditOutputPurposeFieldChange);
  elements.editOutputAreaField.addEventListener("change", handleEditOutputAreaFieldChange);
  elements.editOutputTimingField.addEventListener("change", handleEditOutputTimingFieldChange);
  elements.ideaSearchField.addEventListener("input", handleIdeaSearchInput);
  elements.statusFilterBlock.addEventListener("click", handleStatusFilterClick);
  elements.ideasList.addEventListener("click", handleIdeaCardClick);
  elements.ideaDetailPanel.addEventListener("click", handleIdeaDetailActionClick);
  elements.outputsList.addEventListener("click", handleOutputCardClick);
}
