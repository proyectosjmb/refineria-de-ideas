/*
  Migracion de la base y la capa operativa desde el snapshot local hacia Firestore.
*/

import {
  loadDashboardMeta,
  saveDashboardMeta,
  syncRemoteCollections,
  syncRemoteOperationalState,
} from "./remote-store.js";

function cloneManagedCollections(state = {}) {
  return {
    ideas: Array.isArray(state.ideas) ? state.ideas.map((idea) => ({ ...idea })) : [],
    outputs: Array.isArray(state.outputs) ? state.outputs.map((output) => ({ ...output })) : [],
    projects: Array.isArray(state.projects) ? state.projects.map((project) => ({ ...project })) : [],
  };
}

function countManagedCollections(managedCollections = {}) {
  return {
    ideas: managedCollections.ideas?.length || 0,
    outputs: managedCollections.outputs?.length || 0,
    projects: managedCollections.projects?.length || 0,
  };
}

function cloneOperationalLayer(state = {}) {
  return {
    focus: {
      mission: String(state.focus?.mission || "").trim(),
      weekFocus: String(state.focus?.weekFocus || "").trim(),
    },
    todayAction: String(state.todayAction || "").trim(),
    currentMode: String(state.currentMode || "operacion").trim() || "operacion",
    boss: {
      title: String(state.boss?.title || "").trim(),
      note: String(state.boss?.note || "").trim(),
    },
    copilot: state.copilot
      ? {
        ...state.copilot,
        characters: Array.isArray(state.copilot.characters)
          ? state.copilot.characters.map((character) => ({ ...character }))
          : [],
        phrases: Array.isArray(state.copilot.phrases)
          ? state.copilot.phrases.map((phrase) => ({ ...phrase }))
          : [],
      }
      : null,
    priorities: Array.isArray(state.priorities)
      ? state.priorities.map((priority) => ({ ...priority }))
      : [],
    focusBlocks: Array.isArray(state.focusBlocks)
      ? state.focusBlocks.map((focusBlock) => ({ ...focusBlock }))
      : [],
    reviews: {
      daily: { ...(state.reviews?.daily || {}) },
      weekly: { ...(state.reviews?.weekly || {}) },
      monthly: { ...(state.reviews?.monthly || {}) },
    },
    moneyGoal: { ...(state.moneyGoal || {}) },
  };
}

function countSavedReviews(reviews = {}) {
  return ["daily", "weekly", "monthly"].reduce((total, reviewType) => {
    const reviewEntry = reviews[reviewType] || {};
    const hasContent = Boolean(
      String(reviewEntry.answerOne || "").trim()
      || String(reviewEntry.answerTwo || "").trim()
      || String(reviewEntry.answerThree || "").trim()
      || String(reviewEntry.updatedAt || "").trim()
    );

    return hasContent ? total + 1 : total;
  }, 0);
}

function countOperationalLayer(operationalLayer = {}) {
  return {
    priorities: operationalLayer.priorities?.length || 0,
    focusBlocks: operationalLayer.focusBlocks?.length || 0,
    reviews: countSavedReviews(operationalLayer.reviews),
    hasFocus: Boolean(
      String(operationalLayer.focus?.mission || "").trim()
      || String(operationalLayer.focus?.weekFocus || "").trim()
    ),
    hasTodayAction: Boolean(String(operationalLayer.todayAction || "").trim()),
    hasBoss: Boolean(
      String(operationalLayer.boss?.title || "").trim()
      || String(operationalLayer.boss?.note || "").trim()
    ),
    hasMoneyGoal: Boolean(
      String(operationalLayer.moneyGoal?.name || "").trim()
      || Number(operationalLayer.moneyGoal?.targetAmount || 0) > 0
      || String(operationalLayer.moneyGoal?.note || "").trim()
    ),
    companionCharacters: operationalLayer.copilot?.characters?.length || 0,
    companionPhrases: operationalLayer.copilot?.phrases?.length || 0,
    hasCompanionPhrase: Boolean(String(operationalLayer.copilot?.activePhraseText || "").trim()),
  };
}

export async function migrateLocalCollectionsToRemote({
  userId,
  localState,
  persistenceMode = "dual",
} = {}) {
  if (!userId) {
    throw new Error("Se necesita un usuario autenticado para migrar datos.");
  }

  const managedCollections = cloneManagedCollections(localState);
  const operationalLayer = cloneOperationalLayer(localState);
  const counts = countManagedCollections(managedCollections);
  const operationCounts = countOperationalLayer(operationalLayer);
  const migratedAt = new Date().toISOString();

  await Promise.all([
    syncRemoteCollections(userId, managedCollections),
    syncRemoteOperationalState(userId, operationalLayer),
  ]);
  await saveDashboardMeta(userId, {
    migration: {
      ideasOutputsProjects: {
        status: "completed",
        source: "localStorage",
        persistenceMode,
        migratedAt,
        counts,
      },
      operationLayer: {
        status: "completed",
        source: "localStorage",
        persistenceMode,
        migratedAt,
        counts: operationCounts,
      },
    },
  });

  return {
    managedCollections,
    operationalLayer,
    counts,
    operationCounts,
    migratedAt,
    meta: await loadDashboardMeta(userId),
  };
}
