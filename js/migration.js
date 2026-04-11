/*
  Migracion de ideas, outputs y projects desde el snapshot local hacia Firestore.
*/

import { loadDashboardMeta, saveDashboardMeta, syncRemoteCollections } from "./remote-store.js";

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

export async function migrateLocalCollectionsToRemote({
  userId,
  localState,
  persistenceMode = "dual",
} = {}) {
  if (!userId) {
    throw new Error("Se necesita un usuario autenticado para migrar datos.");
  }

  const managedCollections = cloneManagedCollections(localState);
  const counts = countManagedCollections(managedCollections);
  const migratedAt = new Date().toISOString();

  await syncRemoteCollections(userId, managedCollections);
  await saveDashboardMeta(userId, {
    migration: {
      ideasOutputsProjects: {
        status: "completed",
        source: "localStorage",
        persistenceMode,
        migratedAt,
        counts,
      },
    },
  });

  return {
    managedCollections,
    counts,
    migratedAt,
    meta: await loadDashboardMeta(userId),
  };
}
