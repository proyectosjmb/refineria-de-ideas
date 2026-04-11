/*
  Persistencia local basada en localStorage.
  Mantiene el formato actual y sirve como respaldo temporal durante la migracion.
*/

import {
  COPILOT_OPTIONS,
  DEFAULT_COPILOT_PHRASE,
  DEFAULT_COPILOT_TYPE,
  OPERATION_MODES,
  STORAGE_KEY,
} from "./config.js";
import { createInitialState, normalizeProjectRecord } from "./state.js";
import { createId, parseMoneyAmount } from "./utils.js";

const SECTION_LAYOUT_STORAGE_KEY = `${STORAGE_KEY}-section-layout-v1`;
const ACTIVE_VIEW_STORAGE_KEY = `${STORAGE_KEY}-active-view-v1`;
const COPILOT_TYPE_STORAGE_KEY = "copiloto_tipo";
const COPILOT_PHRASE_STORAGE_KEY = "copiloto_frase";
const IDEA_STATUSES = new Set(["pendiente", "procesada", "archivada"]);
const PRIORITY_STATUSES = new Set(["activa", "completada"]);
const FOCUS_BLOCK_STATUSES = new Set(["pendiente", "en curso", "completado"]);
const MONEY_MOVEMENT_TYPES = new Set(["ingreso", "gasto", "cobro pendiente"]);

export function readLocalStorageItem(key, contextMessage = "leer datos", fallback = null) {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.warn(`No se pudo ${contextMessage} desde localStorage.`, error);
    return fallback;
  }
}

export function writeLocalStorageItem(
  key,
  value,
  contextMessage = "guardar datos",
  notifyUser = false
) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.error(`No se pudo ${contextMessage} en localStorage.`, error);

    if (notifyUser && typeof window !== "undefined" && typeof window.alert === "function") {
      window.alert(
        "No se pudieron guardar los cambios en el navegador. Lo mas reciente podria perderse si recargas la pagina."
      );
    }

    return false;
  }
}

function normalizeString(value = "") {
  return String(value || "").trim();
}

function getSafeIsoTimestamp(value, fallback = new Date().toISOString()) {
  return normalizeString(value) || fallback;
}

function sanitizeIdeaProcessing(processing = null) {
  if (!processing || typeof processing !== "object") {
    return null;
  }

  const nextProcessing = {
    problem: normalizeString(processing.problem),
    purpose: normalizeString(processing.purpose),
    area: normalizeString(processing.area),
    timing: normalizeString(processing.timing),
    minimumVersion: normalizeString(processing.minimumVersion),
    outputType: normalizeString(processing.outputType),
  };

  const hasAnyProcessingValue = Object.values(nextProcessing).some(Boolean);
  return hasAnyProcessingValue ? nextProcessing : null;
}

function sanitizeIdeaRecord(idea = {}) {
  if (!idea || typeof idea !== "object") {
    return null;
  }

  const title = normalizeString(idea.title);

  if (!title) {
    return null;
  }

  const processing = sanitizeIdeaProcessing(idea.processing);
  let status = normalizeString(idea.status);

  if (!IDEA_STATUSES.has(status)) {
    status = "pendiente";
  }

  if (status === "procesada" && !processing) {
    status = "pendiente";
  }

  return {
    id: normalizeString(idea.id) || createId("idea"),
    title,
    note: normalizeString(idea.note),
    source: normalizeString(idea.source),
    createdAt: getSafeIsoTimestamp(idea.createdAt),
    status,
    processing,
  };
}

function sanitizeOutputRecord(output = {}) {
  if (!output || typeof output !== "object") {
    return null;
  }

  const ideaId = normalizeString(output.ideaId);
  const ideaTitle = normalizeString(output.ideaTitle);
  const outputType = normalizeString(output.outputType);

  if (!ideaId || !ideaTitle || !outputType) {
    return null;
  }

  return {
    id: normalizeString(output.id) || createId("output"),
    ideaId,
    ideaTitle,
    problem: normalizeString(output.problem),
    purpose: normalizeString(output.purpose),
    area: normalizeString(output.area),
    timing: normalizeString(output.timing),
    minimumVersion: normalizeString(output.minimumVersion),
    outputType,
    updatedAt: getSafeIsoTimestamp(output.updatedAt),
  };
}

function sanitizePriorityRecord(priority = {}) {
  if (!priority || typeof priority !== "object") {
    return null;
  }

  const title = normalizeString(priority.title);

  if (!title) {
    return null;
  }

  const status = PRIORITY_STATUSES.has(normalizeString(priority.status))
    ? normalizeString(priority.status)
    : "activa";

  return {
    id: normalizeString(priority.id) || createId("priority"),
    title,
    status,
    updatedAt: getSafeIsoTimestamp(priority.updatedAt),
  };
}

function sanitizeFocusBlockRecord(focusBlock = {}) {
  if (!focusBlock || typeof focusBlock !== "object") {
    return null;
  }

  const title = normalizeString(focusBlock.title);

  if (!title) {
    return null;
  }

  const status = FOCUS_BLOCK_STATUSES.has(normalizeString(focusBlock.status))
    ? normalizeString(focusBlock.status)
    : "pendiente";

  return {
    id: normalizeString(focusBlock.id) || createId("focus-block"),
    title,
    startTime: normalizeString(focusBlock.startTime),
    endTime: normalizeString(focusBlock.endTime),
    status,
    updatedAt: getSafeIsoTimestamp(focusBlock.updatedAt),
  };
}

function sanitizeMoneyMovementRecord(movement = {}) {
  if (!movement || typeof movement !== "object") {
    return null;
  }

  const concept = normalizeString(movement.concept);
  const date = normalizeString(movement.date);
  const amount = parseMoneyAmount(movement.amount);
  const type = MONEY_MOVEMENT_TYPES.has(normalizeString(movement.type))
    ? normalizeString(movement.type)
    : "ingreso";

  if (!concept || !date || amount <= 0) {
    return null;
  }

  const createdAt = getSafeIsoTimestamp(movement.createdAt);

  return {
    id: normalizeString(movement.id) || createId("money-movement"),
    type,
    concept,
    amount,
    date,
    note: normalizeString(movement.note),
    createdAt,
    updatedAt: getSafeIsoTimestamp(movement.updatedAt, createdAt),
  };
}

function sanitizeProjectRecord(project = {}) {
  if (!project || typeof project !== "object") {
    return null;
  }

  const name = normalizeString(project.name || project.nombre);
  const expectedResult = normalizeString(project.expectedResult || project.resultadoEsperado);
  const nextAction = normalizeString(project.nextAction || project.siguienteAccion);
  const sourceOutputId = normalizeString(project.sourceOutputId || project.origenSalidaId);

  if (!name || !expectedResult || !nextAction || !sourceOutputId) {
    return null;
  }

  return normalizeProjectRecord({
    ...project,
    name,
    nombre: name,
    expectedResult,
    resultadoEsperado: expectedResult,
    nextAction,
    siguienteAccion: nextAction,
    sourceOutputId,
    origenSalidaId: sourceOutputId,
  });
}

function sanitizeArrayBlock(value, sanitizeItem, blockName) {
  if (!Array.isArray(value)) {
    console.warn(`El bloque ${blockName} tenia un formato invalido. Se usara un fallback seguro.`);
    return [];
  }

  return value.reduce((safeItems, item) => {
    const sanitizedItem = sanitizeItem(item);

    if (sanitizedItem) {
      safeItems.push(sanitizedItem);
    }

    return safeItems;
  }, []);
}

function normalizeCopilotType(value = "") {
  const fallbackType = COPILOT_OPTIONS.some((copilot) => copilot.id === DEFAULT_COPILOT_TYPE)
    ? DEFAULT_COPILOT_TYPE
    : COPILOT_OPTIONS[0]?.id || "cohete";

  return COPILOT_OPTIONS.some((copilot) => copilot.id === value) ? value : fallbackType;
}

function normalizeCopilotPhrase(value = "") {
  const phrase = String(value || "").trim();
  return phrase || DEFAULT_COPILOT_PHRASE;
}

export function loadCopilotPreferences(legacyCopilot = {}) {
  const savedType = readLocalStorageItem(COPILOT_TYPE_STORAGE_KEY, "leer las preferencias de copiloto");
  const savedPhrase = readLocalStorageItem(COPILOT_PHRASE_STORAGE_KEY, "leer la frase del copiloto");

  return {
    type: normalizeCopilotType(savedType || legacyCopilot?.type),
    phrase: normalizeCopilotPhrase(savedPhrase || legacyCopilot?.phrase),
  };
}

export function saveCopilotPreferences(copilot = {}) {
  writeLocalStorageItem(
    COPILOT_TYPE_STORAGE_KEY,
    normalizeCopilotType(copilot.type),
    "guardar el tipo de copiloto"
  );
  writeLocalStorageItem(
    COPILOT_PHRASE_STORAGE_KEY,
    normalizeCopilotPhrase(copilot.phrase),
    "guardar la frase del copiloto"
  );
}

export function createSerializableAppState(state) {
  return {
    ideas: Array.isArray(state?.ideas) ? state.ideas : [],
    outputs: Array.isArray(state?.outputs) ? state.outputs : [],
    focus: state?.focus || { mission: "", weekFocus: "" },
    todayAction: state?.todayAction || "",
    currentMode: state?.currentMode || "operacion",
    moneyGoal: state?.moneyGoal || {
      name: "",
      targetAmount: 0,
      note: "",
      updatedAt: "",
    },
    moneyMovements: Array.isArray(state?.moneyMovements) ? state.moneyMovements : [],
    priorities: Array.isArray(state?.priorities) ? state.priorities : [],
    focusBlocks: Array.isArray(state?.focusBlocks) ? state.focusBlocks : [],
    boss: state?.boss || { title: "", note: "" },
    reviews: state?.reviews || createInitialState().reviews,
    projects: Array.isArray(state?.projects) ? state.projects : [],
  };
}

export function loadAppStateFromLocalStorage() {
  const savedState = readLocalStorageItem(STORAGE_KEY, "leer el estado principal");

  if (!savedState) {
    const initialState = createInitialState();
    initialState.copilot = loadCopilotPreferences(initialState.copilot);
    return initialState;
  }

  try {
    const parsedState = JSON.parse(savedState);
    const initialState = createInitialState();
    const ideas = sanitizeArrayBlock(parsedState?.ideas, sanitizeIdeaRecord, "ideas");
    const ideaIds = new Set(ideas.map((idea) => idea.id));
    const outputs = sanitizeArrayBlock(parsedState?.outputs, sanitizeOutputRecord, "outputs")
      .filter((output) => ideaIds.has(output.ideaId));

    return {
      ideas,
      outputs,
      focus: {
        mission: normalizeString(parsedState.focus?.mission || initialState.focus.mission),
        weekFocus: normalizeString(parsedState.focus?.weekFocus || initialState.focus.weekFocus),
      },
      todayAction: normalizeString(parsedState.todayAction || parsedState.focus?.todayAction),
      currentMode: OPERATION_MODES[parsedState.currentMode] ? parsedState.currentMode : "operacion",
      moneyGoal: {
        name: normalizeString(parsedState.moneyGoal?.name),
        targetAmount: parseMoneyAmount(parsedState.moneyGoal?.targetAmount),
        note: normalizeString(parsedState.moneyGoal?.note),
        updatedAt: normalizeString(parsedState.moneyGoal?.updatedAt),
      },
      moneyMovements: sanitizeArrayBlock(
        parsedState?.moneyMovements,
        sanitizeMoneyMovementRecord,
        "moneyMovements"
      ),
      priorities: sanitizeArrayBlock(parsedState?.priorities, sanitizePriorityRecord, "priorities"),
      focusBlocks: sanitizeArrayBlock(parsedState?.focusBlocks, sanitizeFocusBlockRecord, "focusBlocks"),
      boss: {
        title: normalizeString(parsedState.boss?.title),
        note: normalizeString(parsedState.boss?.note),
      },
      copilot: loadCopilotPreferences(parsedState.copilot),
      reviews: {
        daily: {
          answerOne: normalizeString(parsedState.reviews?.daily?.answerOne),
          answerTwo: normalizeString(parsedState.reviews?.daily?.answerTwo),
          answerThree: normalizeString(parsedState.reviews?.daily?.answerThree),
          updatedAt: normalizeString(parsedState.reviews?.daily?.updatedAt),
        },
        weekly: {
          answerOne: normalizeString(parsedState.reviews?.weekly?.answerOne),
          answerTwo: normalizeString(parsedState.reviews?.weekly?.answerTwo),
          answerThree: normalizeString(parsedState.reviews?.weekly?.answerThree),
          updatedAt: normalizeString(parsedState.reviews?.weekly?.updatedAt),
        },
        monthly: {
          answerOne: normalizeString(parsedState.reviews?.monthly?.answerOne),
          answerTwo: normalizeString(parsedState.reviews?.monthly?.answerTwo),
          answerThree: normalizeString(parsedState.reviews?.monthly?.answerThree),
          updatedAt: normalizeString(parsedState.reviews?.monthly?.updatedAt),
        },
      },
      projects: sanitizeArrayBlock(parsedState?.projects, sanitizeProjectRecord, "projects"),
    };
  } catch (error) {
    console.warn("No se pudo leer el estado guardado. Se usara un estado limpio.", error);
    const initialState = createInitialState();
    initialState.copilot = loadCopilotPreferences(initialState.copilot);
    return initialState;
  }
}

export function saveAppStateToLocalStorage(state) {
  return writeLocalStorageItem(
    STORAGE_KEY,
    JSON.stringify(createSerializableAppState(state)),
    "guardar el estado principal",
    true
  );
}

function cloneSectionLayout(defaultLayout = {}) {
  return Object.fromEntries(
    Object.entries(defaultLayout).map(([sectionKey, value]) => [
      sectionKey,
      {
        isOpen: Boolean(value?.isOpen),
        isPinned: Boolean(value?.isPinned),
      },
    ])
  );
}

export function loadSectionLayout(defaultLayout = {}) {
  const savedLayout = readLocalStorageItem(
    SECTION_LAYOUT_STORAGE_KEY,
    "leer la configuracion de secciones"
  );

  if (!savedLayout) {
    return cloneSectionLayout(defaultLayout);
  }

  try {
    const parsedLayout = JSON.parse(savedLayout);

    return Object.fromEntries(
      Object.entries(defaultLayout).map(([sectionKey, defaultValue]) => {
        const savedValue = parsedLayout?.[sectionKey] || {};
        const isPinned = Boolean(savedValue.isPinned);
        const isOpen = isPinned ? true : savedValue.isOpen ?? defaultValue.isOpen;

        return [
          sectionKey,
          {
            isOpen: Boolean(isOpen),
            isPinned,
          },
        ];
      })
    );
  } catch (error) {
    console.warn("No se pudo leer la configuracion de secciones. Se usaran valores por defecto.", error);
    return cloneSectionLayout(defaultLayout);
  }
}

export function saveSectionLayout(sectionLayout) {
  writeLocalStorageItem(
    SECTION_LAYOUT_STORAGE_KEY,
    JSON.stringify(sectionLayout),
    "guardar la configuracion de secciones"
  );
}

export function loadActiveAppView(defaultView = "panel-operativo") {
  const savedView = readLocalStorageItem(ACTIVE_VIEW_STORAGE_KEY, "leer la vista activa");

  if (
    savedView === "panel-operativo"
    || savedView === "operacion-diaria"
    || savedView === "refineria"
  ) {
    return savedView;
  }

  if (savedView === "operativo") {
    return "operacion-diaria";
  }

  return defaultView;
}

export function saveActiveAppView(viewKey) {
  writeLocalStorageItem(ACTIVE_VIEW_STORAGE_KEY, viewKey, "guardar la vista activa");
}
