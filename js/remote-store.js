/*
  Capa remota para la base de refineria y la capa operativa.
*/

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import { OPERATION_MODES } from "./config.js";
import { getFirebaseServices, isFirebaseConfigured } from "./firebase.js";
import { parseMoneyAmount } from "./utils.js";

const { db } = getFirebaseServices();
const REMOTE_COLLECTION_NAMES = ["ideas", "outputs", "projects"];
const OPERATIONAL_META_DOCS = {
  focus: "focus",
  operation: "operation",
  reviews: "reviews",
  money: "money",
  dashboard: "dashboard",
};

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

function getUserMetaRef(userId, docName) {
  return doc(db, "users", userId, "meta", docName);
}

function getDashboardMetaRef(userId) {
  return getUserMetaRef(userId, OPERATIONAL_META_DOCS.dashboard);
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

function normalizeString(value = "") {
  return String(value || "").trim();
}

function normalizeReviewEntry(reviewEntry = {}) {
  return {
    answerOne: normalizeString(reviewEntry.answerOne),
    answerTwo: normalizeString(reviewEntry.answerTwo),
    answerThree: normalizeString(reviewEntry.answerThree),
    updatedAt: normalizeString(reviewEntry.updatedAt),
  };
}

function normalizeFocusDoc(data = {}) {
  return {
    mission: normalizeString(data.mission),
    weekFocus: normalizeString(data.weekFocus),
  };
}

function normalizeOperationDoc(data = {}) {
  const currentMode = OPERATION_MODES[data.currentMode] ? data.currentMode : "operacion";

  return {
    todayAction: normalizeString(data.todayAction),
    currentMode,
    boss: {
      title: normalizeString(data.boss?.title),
      note: normalizeString(data.boss?.note),
    },
  };
}

function normalizeReviewsDoc(data = {}) {
  return {
    daily: normalizeReviewEntry(data.daily),
    weekly: normalizeReviewEntry(data.weekly),
    monthly: normalizeReviewEntry(data.monthly),
  };
}

function normalizeMoneyDoc(data = {}) {
  return {
    name: normalizeString(data.name),
    targetAmount: parseMoneyAmount(data.targetAmount),
    note: normalizeString(data.note),
    updatedAt: normalizeString(data.updatedAt),
  };
}

function normalizeDashboardOperationSnapshot(operationalState = {}) {
  const reviews = operationalState.reviews || {};

  return {
    focus: {
      mission: normalizeString(operationalState.focus?.mission),
      weekFocus: normalizeString(operationalState.focus?.weekFocus),
    },
    todayAction: normalizeString(operationalState.todayAction),
    currentMode: OPERATION_MODES[operationalState.currentMode]
      ? operationalState.currentMode
      : "operacion",
    boss: {
      title: normalizeString(operationalState.boss?.title),
      note: normalizeString(operationalState.boss?.note),
    },
    counts: {
      priorities: Array.isArray(operationalState.priorities) ? operationalState.priorities.length : 0,
      focusBlocks: Array.isArray(operationalState.focusBlocks) ? operationalState.focusBlocks.length : 0,
    },
    reviews: {
      dailyUpdatedAt: normalizeString(reviews.daily?.updatedAt),
      weeklyUpdatedAt: normalizeString(reviews.weekly?.updatedAt),
      monthlyUpdatedAt: normalizeString(reviews.monthly?.updatedAt),
    },
    moneyGoal: {
      name: normalizeString(operationalState.moneyGoal?.name),
      targetAmount: parseMoneyAmount(operationalState.moneyGoal?.targetAmount),
      updatedAt: normalizeString(operationalState.moneyGoal?.updatedAt),
    },
    updatedAt: new Date().toISOString(),
  };
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

export async function loadRemoteOperationalState(userId) {
  assertRemoteAvailable();

  const [
    focusSnapshot,
    operationSnapshot,
    reviewsSnapshot,
    moneySnapshot,
    prioritiesSnapshot,
    focusBlocksSnapshot,
  ] = await Promise.all([
    getDoc(getUserMetaRef(userId, OPERATIONAL_META_DOCS.focus)),
    getDoc(getUserMetaRef(userId, OPERATIONAL_META_DOCS.operation)),
    getDoc(getUserMetaRef(userId, OPERATIONAL_META_DOCS.reviews)),
    getDoc(getUserMetaRef(userId, OPERATIONAL_META_DOCS.money)),
    getDocs(getUserCollectionRef(userId, "priorities")),
    getDocs(getUserCollectionRef(userId, "focusBlocks")),
  ]);
  const normalizedOperation = operationSnapshot.exists()
    ? normalizeOperationDoc(operationSnapshot.data())
    : {
      todayAction: "",
      currentMode: "operacion",
      boss: {
        title: "",
        note: "",
      },
    };

  return {
    focus: focusSnapshot.exists() ? normalizeFocusDoc(focusSnapshot.data()) : null,
    todayAction: normalizedOperation.todayAction,
    currentMode: normalizedOperation.currentMode,
    boss: normalizedOperation.boss,
    reviews: reviewsSnapshot.exists() ? normalizeReviewsDoc(reviewsSnapshot.data()) : null,
    moneyGoal: moneySnapshot.exists() ? normalizeMoneyDoc(moneySnapshot.data()) : null,
    priorities: sortRecordsByTimestamp(mapSnapshotToRecords(prioritiesSnapshot), "updatedAt"),
    focusBlocks: sortRecordsByTimestamp(mapSnapshotToRecords(focusBlocksSnapshot), "updatedAt"),
    meta: {
      focusExists: focusSnapshot.exists(),
      operationExists: operationSnapshot.exists(),
      reviewsExists: reviewsSnapshot.exists(),
      moneyExists: moneySnapshot.exists(),
      prioritiesCount: prioritiesSnapshot.size,
      focusBlocksCount: focusBlocksSnapshot.size,
    },
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

export async function syncRemoteOperationalState(userId, operationalState = {}) {
  assertRemoteAvailable();

  const focus = normalizeFocusDoc(operationalState.focus);
  const operation = normalizeOperationDoc({
    todayAction: operationalState.todayAction,
    currentMode: operationalState.currentMode,
    boss: operationalState.boss,
  });
  const reviews = normalizeReviewsDoc(operationalState.reviews);
  const moneyGoal = normalizeMoneyDoc(operationalState.moneyGoal);

  await Promise.all([
    setDoc(
      getUserMetaRef(userId, OPERATIONAL_META_DOCS.focus),
      {
        ...focus,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    ),
    setDoc(
      getUserMetaRef(userId, OPERATIONAL_META_DOCS.operation),
      {
        ...operation,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    ),
    setDoc(
      getUserMetaRef(userId, OPERATIONAL_META_DOCS.reviews),
      {
        ...reviews,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    ),
    setDoc(
      getUserMetaRef(userId, OPERATIONAL_META_DOCS.money),
      moneyGoal,
      { merge: true }
    ),
    syncOneCollection(userId, "priorities", operationalState.priorities || []),
    syncOneCollection(userId, "focusBlocks", operationalState.focusBlocks || []),
    saveDashboardMeta(userId, {
      operationSnapshot: normalizeDashboardOperationSnapshot({
        ...operationalState,
        focus,
        ...operation,
        reviews,
        moneyGoal,
      }),
    }),
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
