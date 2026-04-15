/*
  Handlers base: enfoque, acción del día, modo, revisión y eventos globales.
*/

import {
  DEFAULT_COPILOT_PHRASE,
  OPERATION_MODES,
  REVIEW_CONFIG,
} from "./config.js";
import { elements } from "./dom.js";
import {
  renderApp,
  renderDashboard,
  renderFocus,
  renderReviews,
  renderTodayAction,
} from "./render-core.js";
import {
  closeDashboardCollectionDetailPanel,
  closeIdeaDetailPanel,
  closeOutputEditPanel,
  closeProcessPanel,
  closeProjectEditPanel,
  openDashboardCollectionDetailPanel,
} from "./panels.js";
import { appState, sessionState, uiState } from "./state.js";
import {
  loadActiveAppView,
  loadSectionLayout,
  saveActiveAppView,
  saveSectionLayout,
  saveState,
} from "./storage.js";
import { uploadCompanionCharacterImage } from "./remote-store.js";
import {
  setFeedbackTimeout,
  setFocusSaveButtonState,
  setModeFeedback,
  setReviewSaveButtonState,
  setTodayActionSaveButtonState,
} from "./ui-helpers.js";
import { createId, getModeLabel } from "./utils.js";

let navigationHighlightTimeout = null;
let pendingNavigationObserver = null;
let activeHighlightedSection = null;
const APP_VIEW_KEYS = ["panel-operativo", "operacion-diaria", "refineria"];
const ACCORDION_SECTION_CONFIG = [
  { key: "focus", selector: "#focus-panel", defaultOpen: true },
  { key: "mode", selector: "#mode-panel", defaultOpen: true },
  { key: "projects", selector: "#projects-panel", defaultOpen: false },
  { key: "priorities", selector: "#priorities-panel", defaultOpen: false },
  { key: "focusBlocks", selector: "#focus-blocks-panel", defaultOpen: false },
  { key: "boss", selector: "#boss-panel", defaultOpen: false },
  { key: "review", selector: "#review-panel", defaultOpen: false },
  { key: "moneyGoal", selector: "#money-goal-panel", defaultOpen: false },
  { key: "inbox", selector: "#inbox-panel", defaultOpen: true },
  { key: "outputs", selector: "#outputs-panel", defaultOpen: false },
];
const DEFAULT_SECTION_LAYOUT = Object.fromEntries(
  ACCORDION_SECTION_CONFIG.map((sectionConfig) => [
    sectionConfig.key,
    {
      isOpen: sectionConfig.defaultOpen,
      isPinned: false,
    },
  ])
);
const accordionRegistry = new Map();
let sectionLayoutState = loadSectionLayout(DEFAULT_SECTION_LAYOUT);
let activeAppView = loadActiveAppView("panel-operativo");

function getSectionLayoutEntry(sectionKey) {
  if (!sectionLayoutState[sectionKey]) {
    sectionLayoutState[sectionKey] = {
      isOpen: true,
      isPinned: false,
    };
  }

  if (typeof sectionLayoutState[sectionKey].isOpen !== "boolean") {
    sectionLayoutState[sectionKey].isOpen = true;
  }

  // La versión simplificada elimina la fijación visual y neutraliza estados heredados.
  sectionLayoutState[sectionKey].isPinned = false;

  return sectionLayoutState[sectionKey];
}

function persistSectionLayoutState() {
  saveSectionLayout(sectionLayoutState);
}

function getAppViewElement(viewKey) {
  if (viewKey === "panel-operativo") {
    return elements.panelOperativoView;
  }

  if (viewKey === "operacion-diaria") {
    return elements.operacionDiariaView;
  }

  if (viewKey === "refineria") {
    return elements.refineryView;
  }

  return null;
}

function syncAppViewState() {
  APP_VIEW_KEYS.forEach((viewKey) => {
    const viewElement = getAppViewElement(viewKey);
    const isActive = viewKey === activeAppView;

    if (viewElement) {
      viewElement.hidden = !isActive;
      viewElement.classList.toggle("is-active", isActive);
    }
  });

  elements.appViewButtons.forEach((button) => {
    const isActive = button.dataset.appViewTarget === activeAppView;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
    button.setAttribute("tabindex", isActive ? "0" : "-1");
  });

  document.body.dataset.appView = activeAppView;
}

export function setActiveSection(viewKey, options = {}) {
  const { persist = true } = options;

  if (!APP_VIEW_KEYS.includes(viewKey) || viewKey === activeAppView) {
    if (persist && APP_VIEW_KEYS.includes(viewKey)) {
      saveActiveAppView(viewKey);
    }
    return;
  }

  activeAppView = viewKey;
  syncAppViewState();

  if (persist) {
    saveActiveAppView(viewKey);
  }
}

export function setActiveAppView(viewKey, options = {}) {
  setActiveSection(viewKey, options);
}

function getSectionViewKey(targetSection) {
  return targetSection?.closest("[data-app-view]")?.dataset.appView || "panel-operativo";
}

function syncAccordionSectionState(sectionKey) {
  const accordionEntry = accordionRegistry.get(sectionKey);

  if (!accordionEntry) {
    return;
  }

  const layoutEntry = getSectionLayoutEntry(sectionKey);
  const { section, shell, sectionHead, chevron, sectionTitle } = accordionEntry;

  section.classList.toggle("is-collapsed", !layoutEntry.isOpen);
  section.classList.remove("is-pinned");
  section.dataset.sectionOpen = String(layoutEntry.isOpen);
  section.dataset.sectionPinned = "false";
  shell.setAttribute("aria-hidden", String(!layoutEntry.isOpen));
  shell.inert = !layoutEntry.isOpen;
  sectionHead.setAttribute("aria-expanded", String(layoutEntry.isOpen));
  sectionHead.setAttribute(
    "aria-label",
    layoutEntry.isOpen ? `Colapsar ${sectionTitle}` : `Expandir ${sectionTitle}`
  );
  chevron.dataset.state = layoutEntry.isOpen ? "open" : "closed";
}

function syncAllAccordionSections() {
  accordionRegistry.forEach((_, sectionKey) => {
    syncAccordionSectionState(sectionKey);
  });
}

function openAccordionSection(sectionKey, options = {}) {
  const { persist = true } = options;
  const layoutEntry = getSectionLayoutEntry(sectionKey);

  layoutEntry.isOpen = true;
  syncAllAccordionSections();

  if (persist) {
    persistSectionLayoutState();
  }
}

function closeAccordionSection(sectionKey, options = {}) {
  const { persist = true } = options;
  const layoutEntry = getSectionLayoutEntry(sectionKey);

  layoutEntry.isOpen = false;
  syncAccordionSectionState(sectionKey);

  if (persist) {
    persistSectionLayoutState();
  }
}

function openAllAccordionSections() {
  accordionRegistry.forEach((_, sectionKey) => {
    const layoutEntry = getSectionLayoutEntry(sectionKey);
    layoutEntry.isOpen = true;
  });

  syncAllAccordionSections();
  persistSectionLayoutState();
}

function closeAllUnpinnedAccordionSections() {
  accordionRegistry.forEach((_, sectionKey) => {
    const layoutEntry = getSectionLayoutEntry(sectionKey);
    layoutEntry.isOpen = false;
  });
  syncAllAccordionSections();
  persistSectionLayoutState();
}

function toggleAccordionSection(sectionKey, options = {}) {
  const { persist = true } = options;
  const layoutEntry = getSectionLayoutEntry(sectionKey);

  if (layoutEntry.isOpen) {
    closeAccordionSection(sectionKey, { persist });
    return;
  }

  openAccordionSection(sectionKey, { persist });
}

function ensureAccordionSectionVisible(targetSection) {
  const sectionKey = targetSection?.dataset.sectionKey;

  if (!sectionKey || !accordionRegistry.has(sectionKey)) {
    return;
  }

  openAccordionSection(sectionKey, { persist: true });
}

function buildAccordionChevron() {
  const chevron = document.createElement("span");
  chevron.className = "accordion-chevron";
  chevron.setAttribute("aria-hidden", "true");
  return chevron;
}

function enhanceAccordionSection(sectionConfig) {
  const section = document.querySelector(sectionConfig.selector);
  const sectionHead = section?.querySelector(".section-head");
  const sectionTitle = sectionHead?.querySelector("h2")?.textContent?.trim() || sectionConfig.key;

  if (!section || !sectionHead) {
    return;
  }

  section.dataset.sectionKey = sectionConfig.key;

  let accordionShell = section.querySelector(".accordion-shell");
  let accordionBody = section.querySelector(".accordion-body");

  if (!accordionShell || !accordionBody) {
    const sectionChildren = Array.from(section.children).filter((child) => child !== sectionHead);

    accordionShell = document.createElement("div");
    accordionBody = document.createElement("div");
    accordionShell.className = "accordion-shell";
    accordionBody.className = "accordion-body";

    sectionChildren.forEach((child) => {
      accordionBody.appendChild(child);
    });

    accordionShell.appendChild(accordionBody);
    section.appendChild(accordionShell);
  }

  if (!accordionShell.id) {
    accordionShell.id = `accordion-panel-${sectionConfig.key}`;
  }

  const mainContent = sectionHead.firstElementChild;

  if (!mainContent) {
    return;
  }

  sectionHead.querySelectorAll(".accordion-head-actions").forEach((node) => {
    node.remove();
  });

  let chevron = sectionHead.querySelector(".accordion-chevron");

  if (!chevron) {
    chevron = buildAccordionChevron();
  }

  mainContent.classList.add("accordion-head-main");
  sectionHead.classList.add("accordion-head-toggle");
  sectionHead.dataset.sectionAction = "toggle";
  sectionHead.dataset.sectionKey = sectionConfig.key;
  sectionHead.setAttribute("role", "button");
  sectionHead.setAttribute("tabindex", "0");
  sectionHead.setAttribute("aria-controls", accordionShell.id);
  sectionHead.appendChild(chevron);

  accordionRegistry.set(sectionConfig.key, {
    section,
    shell: accordionShell,
    sectionHead,
    sectionTitle,
    chevron,
  });
}

export function initializeCollapsibleSections() {
  ACCORDION_SECTION_CONFIG.forEach((sectionConfig) => {
    enhanceAccordionSection(sectionConfig);
  });

  syncAllAccordionSections();
}

export function initializeWorkspaceViews() {
  if (!APP_VIEW_KEYS.includes(activeAppView)) {
    activeAppView = "panel-operativo";
  }

  syncAppViewState();
}

function clearSectionHighlight(targetSection) {
  if (!targetSection) {
    return;
  }

  targetSection.classList.remove("section-jump-highlight");
}

function highlightTargetSection(targetSection) {
  if (!targetSection) {
    return;
  }

  clearTimeout(navigationHighlightTimeout);
  clearSectionHighlight(activeHighlightedSection);
  clearSectionHighlight(targetSection);

  // Fuerza el reinicio para que el resaltado pueda repetirse en clics consecutivos.
  void targetSection.offsetWidth;
  targetSection.classList.add("section-jump-highlight");
  activeHighlightedSection = targetSection;

  navigationHighlightTimeout = window.setTimeout(() => {
    clearSectionHighlight(targetSection);
    activeHighlightedSection = null;
  }, 1800);
}

function navigateFromDashboardCard(card) {
  const targetSelector = card?.dataset.scrollTarget;

  if (!targetSelector) {
    return;
  }

  const targetSection = document.querySelector(targetSelector);

  if (!targetSection) {
    return;
  }

  setActiveSection(getSectionViewKey(targetSection), {
    persist: true,
  });
  ensureAccordionSectionVisible(targetSection);

  if (pendingNavigationObserver) {
    pendingNavigationObserver.disconnect();
    pendingNavigationObserver = null;
  }

  if (!("IntersectionObserver" in window)) {
    targetSection.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    window.setTimeout(() => {
      highlightTargetSection(targetSection);
    }, 350);
    return;
  }

  pendingNavigationObserver = new IntersectionObserver(
    (entries) => {
      const matchingEntry = entries.find((entry) => entry.target === targetSection && entry.isIntersecting);

      if (!matchingEntry) {
        return;
      }

      highlightTargetSection(targetSection);
      pendingNavigationObserver.disconnect();
      pendingNavigationObserver = null;
    },
    {
      threshold: 0.15,
    }
  );

  pendingNavigationObserver.observe(targetSection);
  targetSection.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

function setDashboardActionFeedback(message = "") {
  uiState.dashboardActionFeedback = message;
  renderDashboard();
}

function clearDashboardActionFeedbackSoon() {
  setFeedbackTimeout("dashboardAction", () => {
    uiState.dashboardActionFeedback = "";
    renderDashboard();
  }, 1800);
}

function clearDashboardActionCompletionSoon() {
  setFeedbackTimeout("dashboardActionState", () => {
    uiState.dashboardActionState = "idle";
    uiState.dashboardLastCompletedText = "";
    renderDashboard();
  }, 1900);
}

function resetDashboardActionTransientState() {
  uiState.dashboardActionState = "idle";
  uiState.dashboardLastCompletedText = "";
}

function setCompanionPanelFeedback(message = "", isError = false) {
  if (!elements.companionPanelFeedback) {
    return;
  }

  elements.companionPanelFeedback.textContent = message;
  elements.companionPanelFeedback.classList.toggle("is-visible", Boolean(message));
  elements.companionPanelFeedback.classList.toggle("is-error", isError);
}

function getCompanionCharacters() {
  return Array.isArray(appState.copilot?.characters) ? appState.copilot.characters : [];
}

function getCompanionPhrases() {
  return Array.isArray(appState.copilot?.phrases) ? appState.copilot.phrases : [];
}

function applyCopilotState(nextCopilot = {}) {
  const activeCharacterId = nextCopilot.activeCharacterId || nextCopilot.type || appState.copilot?.activeCharacterId;
  const activePhraseText = String(
    nextCopilot.activePhraseText || nextCopilot.phrase || appState.copilot?.activePhraseText || ""
  ).trim() || DEFAULT_COPILOT_PHRASE;

  appState.copilot = {
    ...appState.copilot,
    ...nextCopilot,
    type: activeCharacterId,
    phrase: activePhraseText,
    activeCharacterId,
    activePhraseText,
  };
}

function toggleCopilotEditor(nextOpenState = !uiState.isCopilotEditorOpen) {
  uiState.isCopilotEditorOpen = Boolean(nextOpenState);
  if (!uiState.isCopilotEditorOpen) {
    setCompanionPanelFeedback("");
  }
  renderDashboard();

  if (uiState.isCopilotEditorOpen && elements.companionPhraseInput) {
    requestAnimationFrame(() => {
      elements.companionPhraseInput.focus();
      elements.companionPhraseInput.select();
    });
  }
}

export function handleCopilotToggleClick(event) {
  const toggleButton = event.target.closest("[data-copilot-edit-toggle]");

  if (!toggleButton) {
    return;
  }

  event.preventDefault();
  toggleCopilotEditor(true);
}

export async function handleCompanionCharacterSubmit(event) {
  event.preventDefault();

  const characterName = String(elements.companionCharacterNameField?.value || "").trim();
  const imageFile = elements.companionCharacterImageField?.files?.[0];

  setCompanionPanelFeedback("");

  if (!characterName) {
    setCompanionPanelFeedback("Escribe un nombre para el personaje.", true);
    elements.companionCharacterNameField?.focus();
    return;
  }

  if (!imageFile) {
    setCompanionPanelFeedback("Selecciona una imagen para guardar el personaje.", true);
    elements.companionCharacterImageField?.focus();
    return;
  }

  if (!["image/png", "image/webp"].includes(String(imageFile.type || "").toLowerCase())) {
    setCompanionPanelFeedback("Usa una imagen PNG o WEBP para el personaje.", true);
    elements.companionCharacterImageField?.focus();
    return;
  }

  if (!sessionState.authUser) {
    setCompanionPanelFeedback("Inicia sesión para subir imágenes y sincronizar personajes entre dispositivos.", true);
    return;
  }

  const characterId = createId("companion-character");
  const defaultButtonLabel = elements.companionCharacterSaveButton?.dataset.defaultLabel || "Guardar personaje";

  if (elements.companionCharacterSaveButton) {
    elements.companionCharacterSaveButton.disabled = true;
    elements.companionCharacterSaveButton.textContent = "Subiendo...";
  }

  try {
    const imageUrl = await uploadCompanionCharacterImage(sessionState.authUser.uid, characterId, imageFile);
    const nextCharacters = [
      ...getCompanionCharacters(),
      {
        id: characterId,
        name: characterName,
        imageUrl,
      },
    ];

    applyCopilotState({
      characters: nextCharacters,
      activeCharacterId: characterId,
    });

    saveState(appState);
    elements.companionCharacterForm?.reset();
    renderDashboard();
    setCompanionPanelFeedback("Personaje guardado y activado.");
    setFeedbackTimeout("companionPanel", () => {
      setCompanionPanelFeedback("");
    }, 2200);
  } catch (error) {
    console.warn("No se pudo guardar el personaje.", error);
    setCompanionPanelFeedback(
      "No se pudo subir la imagen del personaje. Revisa tu conexión o la configuración de Firebase Storage.",
      true
    );
  } finally {
    if (elements.companionCharacterSaveButton) {
      elements.companionCharacterSaveButton.disabled = false;
      elements.companionCharacterSaveButton.textContent = defaultButtonLabel;
    }
  }
}

export function handleCompanionPhraseSubmit(event) {
  event.preventDefault();

  const nextPhrase = String(elements.companionPhraseInput?.value || "").trim();

  setCompanionPanelFeedback("");

  if (!nextPhrase) {
    setCompanionPanelFeedback("Escribe una frase antes de guardarla.", true);
    elements.companionPhraseInput?.focus();
    return;
  }

  const matchingPhrase = getCompanionPhrases().find((phrase) => phrase.text === nextPhrase);

  applyCopilotState({
    activePhraseId: matchingPhrase?.id || "",
    activePhraseText: nextPhrase,
  });

  saveState(appState);
  renderDashboard();
  setCompanionPanelFeedback("Frase activa actualizada.");
  setFeedbackTimeout("companionPanel", () => {
    setCompanionPanelFeedback("");
  }, 2200);
}

export function handleCompanionPhraseSaveClick() {
  const nextPhrase = String(elements.companionPhraseInput?.value || "").trim();

  setCompanionPanelFeedback("");

  if (!nextPhrase) {
    setCompanionPanelFeedback("Escribe una frase antes de guardarla en la biblioteca.", true);
    elements.companionPhraseInput?.focus();
    return;
  }

  const existingPhrase = getCompanionPhrases().find((phrase) => phrase.text === nextPhrase);
  const nextPhraseId = existingPhrase?.id || createId("companion-phrase");
  const nextPhrases = existingPhrase
    ? getCompanionPhrases()
    : [...getCompanionPhrases(), { id: nextPhraseId, text: nextPhrase }];

  applyCopilotState({
    phrases: nextPhrases,
    activePhraseId: nextPhraseId,
    activePhraseText: nextPhrase,
  });

  saveState(appState);
  renderDashboard();
  setCompanionPanelFeedback(existingPhrase ? "La frase ya estaba guardada y quedó activa." : "Frase guardada en la biblioteca.");
  setFeedbackTimeout("companionPanel", () => {
    setCompanionPanelFeedback("");
  }, 2200);
}

export function handleCompanionLibraryClick(event) {
  const actionButton = event.target.closest("[data-companion-action]");

  if (!actionButton) {
    return;
  }

  const action = actionButton.dataset.companionAction;

  if (action === "activate-character") {
    const characterId = actionButton.dataset.characterId;

    if (!getCompanionCharacters().some((character) => character.id === characterId)) {
      return;
    }

    applyCopilotState({
      activeCharacterId: characterId,
    });
    saveState(appState);
    renderDashboard();
    setCompanionPanelFeedback("Personaje activo actualizado.");
    setFeedbackTimeout("companionPanel", () => {
      setCompanionPanelFeedback("");
    }, 2200);
    return;
  }

  if (action === "activate-phrase") {
    const phraseId = actionButton.dataset.phraseId;
    const selectedPhrase = getCompanionPhrases().find((phrase) => phrase.id === phraseId);

    if (!selectedPhrase) {
      return;
    }

    applyCopilotState({
      activePhraseId: selectedPhrase.id,
      activePhraseText: selectedPhrase.text,
    });
    saveState(appState);
    renderDashboard();
    setCompanionPanelFeedback("Frase activa actualizada.");
    setFeedbackTimeout("companionPanel", () => {
      setCompanionPanelFeedback("");
    }, 2200);
  }
}

function handleGlobalClick(event) {
  if (!uiState.isCopilotEditorOpen) {
    return;
  }

  if (event.target.closest("#companion-panel") || event.target.closest("[data-copilot-edit-toggle]")) {
    return;
  }

  toggleCopilotEditor(false);
}

export function handleDashboardActionClick(event) {
  const actionButton = event.target.closest("[data-dashboard-action]");

  if (!actionButton) {
    return;
  }

  const action = actionButton.dataset.dashboardAction;
  const hasTodayAction = Boolean(appState.todayAction);

  if (action === "details") {
    uiState.dashboardActionDetailsOpen = !uiState.dashboardActionDetailsOpen;
    renderDashboard();
    return;
  }

  if (!hasTodayAction) {
    setDashboardActionFeedback("Define una acción clave antes de moverla.");
    clearDashboardActionFeedbackSoon();
    return;
  }

  if (action === "complete") {
    uiState.dashboardLastCompletedText = appState.todayAction;
    uiState.dashboardActionState = "completed";
    appState.todayAction = "";
    uiState.dashboardTodayActionPaused = false;
    saveState(appState);
    renderTodayAction();
    setDashboardActionFeedback("Avance registrado");
    clearDashboardActionFeedbackSoon();
    clearDashboardActionCompletionSoon();
    return;
  }

  if (action === "pause") {
    uiState.dashboardTodayActionPaused = !uiState.dashboardTodayActionPaused;
    uiState.dashboardActionState = "idle";
    setDashboardActionFeedback(uiState.dashboardTodayActionPaused ? "Acción en pausa" : "Acción reanudada");
    clearDashboardActionFeedbackSoon();
  }
}

export function handleDashboardCollectionDetailClick(event) {
  const detailButton = event.target.closest("[data-dashboard-detail-trigger]");

  if (!detailButton) {
    return;
  }

  event.stopPropagation();

  const detailType = detailButton.dataset.dashboardDetailTrigger;

  if (!detailType) {
    return;
  }

  openDashboardCollectionDetailPanel(detailType);
}

export function handleAppViewSwitchClick(event) {
  const targetButton = event.target.closest("[data-app-view-target]");

  if (!targetButton) {
    return;
  }

  setActiveSection(targetButton.dataset.appViewTarget, {
    persist: true,
  });
}

export function handleFocusSubmit(event) {
  event.preventDefault();

  const formData = new FormData(elements.focusForm);

  appState.focus = {
    mission: String(formData.get("mission") || "").trim(),
    weekFocus: String(formData.get("weekFocus") || "").trim(),
  };

  saveState(appState);
  renderDashboard();
  renderFocus();
  setFocusSaveButtonState(true);
  setFeedbackTimeout("focus", () => {
    setFocusSaveButtonState(false);
  });
}

export function handleTodayActionSubmit(event) {
  event.preventDefault();

  const formData = new FormData(elements.todayActionForm);
  appState.todayAction = String(formData.get("todayAction") || "").trim();
  resetDashboardActionTransientState();
  uiState.dashboardTodayActionPaused = false;

  saveState(appState);
  renderTodayAction();
  renderDashboard();
  setTodayActionSaveButtonState(true, "Acción guardada");
  setFeedbackTimeout("todayAction", () => {
    setTodayActionSaveButtonState(false);
  });
}

export function handleModeSelection(event) {
  const modeButton = event.target.closest(".mode-option");

  if (!modeButton) {
    return;
  }

  const selectedMode = modeButton.dataset.mode;

  if (!OPERATION_MODES[selectedMode]) {
    return;
  }

  appState.currentMode = selectedMode;
  saveState(appState);
  renderApp();
  setModeFeedback(`Modo guardado: ${getModeLabel(selectedMode)}`);
  setFeedbackTimeout("mode", () => {
    setModeFeedback("");
  });
}

export function handleReviewTabClick(event) {
  const reviewTabButton = event.target.closest(".review-tab");

  if (!reviewTabButton) {
    return;
  }

  const nextReviewTab = reviewTabButton.dataset.reviewTab;

  if (!REVIEW_CONFIG[nextReviewTab]) {
    return;
  }

  uiState.activeReviewTab = nextReviewTab;
  renderReviews();
}

export function handleReviewSubmit(event) {
  event.preventDefault();

  const formData = new FormData(elements.reviewForm);
  const currentReviewType = uiState.activeReviewTab;

  appState.reviews[currentReviewType] = {
    answerOne: String(formData.get("answerOne") || "").trim(),
    answerTwo: String(formData.get("answerTwo") || "").trim(),
    answerThree: String(formData.get("answerThree") || "").trim(),
    updatedAt: new Date().toISOString(),
  };

  saveState(appState);
  renderReviews();
  setReviewSaveButtonState(true, `${REVIEW_CONFIG[currentReviewType].label} guardada`);
  setFeedbackTimeout("review", () => {
    setReviewSaveButtonState(false);
  });
}

export function handleGlobalKeydown(event) {
  if (event.key !== "Escape") {
    return;
  }

  if (uiState.isCopilotEditorOpen) {
    toggleCopilotEditor(false);
    return;
  }

  if (uiState.dashboardCollectionDetailType) {
    closeDashboardCollectionDetailPanel();
    return;
  }

  if (uiState.editingProjectId) {
    closeProjectEditPanel();
    return;
  }

  if (uiState.editingOutputId) {
    closeOutputEditPanel();
    return;
  }

  if (uiState.viewingIdeaId) {
    closeIdeaDetailPanel();
    return;
  }

  if (uiState.processingIdeaId) {
    closeProcessPanel();
  }
}

export function handleDashboardNavigationClick(event) {
  if (
    event.target.closest("[data-dashboard-action]")
    || event.target.closest("[data-dashboard-detail-trigger]")
    || event.target.closest("#dashboard-action-details")
  ) {
    return;
  }

  const targetCard = event.target.closest(".dashboard-nav-card");

  if (!targetCard) {
    return;
  }

  navigateFromDashboardCard(targetCard);
}

export function handleDashboardNavigationKeydown(event) {
  if (
    event.target.closest("[data-dashboard-action]")
    || event.target.closest("[data-dashboard-detail-trigger]")
    || event.target.closest("#dashboard-action-details")
  ) {
    return;
  }

  const targetCard = event.target.closest(".dashboard-nav-card");

  if (!targetCard || (event.key !== "Enter" && event.key !== " ")) {
    return;
  }

  event.preventDefault();
  navigateFromDashboardCard(targetCard);
}

export function handleAccordionActionClick(event) {
  const actionButton = event.target.closest("[data-section-action]");

  if (!actionButton) {
    return;
  }

  const sectionKey = actionButton.dataset.sectionKey;
  const action = actionButton.dataset.sectionAction;

  if (!sectionKey || !accordionRegistry.has(sectionKey)) {
    return;
  }

  if (action === "toggle") {
    toggleAccordionSection(sectionKey, {
      persist: true,
    });
  }
}

export function handleAccordionActionKeydown(event) {
  const actionHeader = event.target.closest('.section-head[data-section-action="toggle"]');

  if (!actionHeader || (event.key !== "Enter" && event.key !== " ")) {
    return;
  }

  event.preventDefault();
  toggleAccordionSection(actionHeader.dataset.sectionKey, {
    persist: true,
  });
}

export function bindCoreEvents() {
  elements.focusForm.addEventListener("submit", handleFocusSubmit);
  elements.todayActionForm.addEventListener("submit", handleTodayActionSubmit);
  elements.reviewForm.addEventListener("submit", handleReviewSubmit);
  elements.reviewTabs.forEach((button) => {
    button.addEventListener("click", handleReviewTabClick);
  });
  elements.modeOptions.forEach((button) => {
    button.addEventListener("click", handleModeSelection);
  });
  elements.closeProcessPanelButton.addEventListener("click", closeProcessPanel);
  elements.cancelProcessButton.addEventListener("click", closeProcessPanel);
  elements.processBackdrop.addEventListener("click", closeProcessPanel);
  elements.closeIdeaDetailPanelButton.addEventListener("click", closeIdeaDetailPanel);
  elements.ideaDetailBackdrop.addEventListener("click", closeIdeaDetailPanel);
  if (elements.closeDashboardCollectionDetailPanelButton) {
    elements.closeDashboardCollectionDetailPanelButton.addEventListener("click", closeDashboardCollectionDetailPanel);
  }
  if (elements.dashboardCollectionDetailBackdrop) {
    elements.dashboardCollectionDetailBackdrop.addEventListener("click", closeDashboardCollectionDetailPanel);
  }
  elements.closeOutputEditPanelButton.addEventListener("click", closeOutputEditPanel);
  elements.cancelOutputEditButton.addEventListener("click", closeOutputEditPanel);
  elements.outputEditBackdrop.addEventListener("click", closeOutputEditPanel);
  elements.closeProjectEditPanelButton.addEventListener("click", closeProjectEditPanel);
  elements.cancelProjectEditButton.addEventListener("click", closeProjectEditPanel);
  elements.projectEditBackdrop.addEventListener("click", closeProjectEditPanel);
  if (elements.closeCompanionPanelButton) {
    elements.closeCompanionPanelButton.addEventListener("click", () => {
      toggleCopilotEditor(false);
    });
  }
  if (elements.companionBackdrop) {
    elements.companionBackdrop.addEventListener("click", () => {
      toggleCopilotEditor(false);
    });
  }
  if (elements.workspace) {
    elements.workspace.addEventListener("click", handleCopilotToggleClick);
    elements.workspace.addEventListener("click", handleAccordionActionClick);
    elements.workspace.addEventListener("keydown", handleAccordionActionKeydown);
    elements.workspace.addEventListener("click", handleDashboardActionClick);
    elements.workspace.addEventListener("click", handleDashboardCollectionDetailClick);
    elements.workspace.addEventListener("click", handleDashboardNavigationClick);
    elements.workspace.addEventListener("keydown", handleDashboardNavigationKeydown);
  }
  if (elements.companionCharacterForm) {
    elements.companionCharacterForm.addEventListener("submit", handleCompanionCharacterSubmit);
  }
  if (elements.companionPhraseForm) {
    elements.companionPhraseForm.addEventListener("submit", handleCompanionPhraseSubmit);
  }
  if (elements.companionPhraseSaveButton) {
    elements.companionPhraseSaveButton.addEventListener("click", handleCompanionPhraseSaveClick);
  }
  if (elements.companionCharactersList) {
    elements.companionCharactersList.addEventListener("click", handleCompanionLibraryClick);
  }
  if (elements.companionPhrasesList) {
    elements.companionPhrasesList.addEventListener("click", handleCompanionLibraryClick);
  }
  if (elements.viewSwitcher) {
    elements.viewSwitcher.addEventListener("click", handleAppViewSwitchClick);
  }
  if (elements.expandAllSectionsButton) {
    elements.expandAllSectionsButton.addEventListener("click", openAllAccordionSections);
  }
  if (elements.collapseUnpinnedSectionsButton) {
    elements.collapseUnpinnedSectionsButton.addEventListener("click", closeAllUnpinnedAccordionSections);
  }
  document.addEventListener("click", handleGlobalClick);
  document.addEventListener("keydown", handleGlobalKeydown);
}
