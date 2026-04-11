/*
  Capa remota limitada a ideas, outputs, projects y la meta de migracion.
*/

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import { getFirebaseServices, isFirebaseConfigured } from "./firebase.js";

const { db } = getFirebaseServices();
const REMOTE_COLLECTION_NAMES = ["ideas", "outputs", "projects"];

function assertRemoteAvailable() {
  if (!isFirebaseConfigured() || !db) {
    throw new Error(
      "Firebase no esta configurado todavia. Activa la configuracion antes de usar Firestore."
    );
  }
}

function getUserCollectionRef(userId, collectionName) {
  return collection(db, "users", userId, collectionName);
}

function getDashboardMetaRef(userId) {
  return doc(db, "users", userId, "meta", "dashboard");
}

function mapSnapshotToRecords(snapshot) {
  return snapshot.docs.map((snapshotDoc) => ({
    id: snapshotDoc.id,
    ...snapshotDoc.data(),
  }));
}

function sortRecordsByTimestamp(records = [], fallbackKey = "updatedAt") {
  return [...records].sort((recordA, recordB) => {
    const valueA = recordA[fallbackKey] || recordA.createdAt || "";
    const valueB = recordB[fallbackKey] || recordB.createdAt || "";
    return new Date(valueB) - new Date(valueA);
  });
}

export function canUseRemoteStore() {
  return isFirebaseConfigured() && Boolean(db);
}

export async function loadRemoteCollections(userId) {
  assertRemoteAvailable();

  const [ideasSnapshot, outputsSnapshot, projectsSnapshot] = await Promise.all(
    REMOTE_COLLECTION_NAMES.map((collectionName) => getDocs(getUserCollectionRef(userId, collectionName)))
  );

  return {
    ideas: sortRecordsByTimestamp(mapSnapshotToRecords(ideasSnapshot), "createdAt"),
    outputs: sortRecordsByTimestamp(mapSnapshotToRecords(outputsSnapshot), "updatedAt"),
    projects: sortRecordsByTimestamp(mapSnapshotToRecords(projectsSnapshot), "updatedAt"),
  };
}

async function syncOneCollection(userId, collectionName, records = []) {
  const collectionRef = getUserCollectionRef(userId, collectionName);
  const existingSnapshot = await getDocs(collectionRef);
  const existingIds = new Set(existingSnapshot.docs.map((snapshotDoc) => snapshotDoc.id));
  const batch = writeBatch(db);

  records.forEach((record) => {
    if (!record?.id) {
      return;
    }

    const { id, ...recordData } = record;
    batch.set(doc(collectionRef, id), recordData);
    existingIds.delete(id);
  });

  existingIds.forEach((staleId) => {
    batch.delete(doc(collectionRef, staleId));
  });

  await batch.commit();
}

export async function syncRemoteCollections(userId, managedState = {}) {
  assertRemoteAvailable();

  await Promise.all([
    syncOneCollection(userId, "ideas", managedState.ideas || []),
    syncOneCollection(userId, "outputs", managedState.outputs || []),
    syncOneCollection(userId, "projects", managedState.projects || []),
  ]);
}

export async function loadDashboardMeta(userId) {
  assertRemoteAvailable();

  const dashboardMetaSnapshot = await getDoc(getDashboardMetaRef(userId));
  return dashboardMetaSnapshot.exists() ? dashboardMetaSnapshot.data() : null;
}

export async function saveDashboardMeta(userId, payload = {}) {
  assertRemoteAvailable();
  await setDoc(getDashboardMetaRef(userId), payload, { merge: true });
}
