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
import {
  getDownloadURL,
  ref,
  uploadBytes,
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-storage.js";
import {
  COPILOT_OPTIONS,
  DEFAULT_COPILOT_PHRASE,
  DEFAULT_COPILOT_TYPE,
  OPERATION_MODES,
} from "./config.js";
import { getFirebaseServices, isFirebaseConfigured } from "./firebase.js";
import { parseMoneyAmount } from "./utils.js";

const { db, storage } = getFirebaseServices();
const REMOTE_COLLECTION_NAMES = ["ideas", "outputs", "projects"];
const OPERATIONAL_META_DOCS = {
  focus: "focus",
  operation: "operation",
  reviews: "reviews",
  money: "money",
  companion: "companion",
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

function buildDefaultCompanionCharacters() {
  return COPILOT_OPTIONS.map((copilot) => ({
    id: copilot.id,
    name: copilot.name,
    imageUrl: copilot.src,
  }));
}

function normalizeCompanionCharacterDoc(data = {}) {
  const id = normalizeString(data.id);
  const name = normalizeString(data.name);
  const imageUrl = normalizeString(data.imageUrl);

  if (!id || !name || !imageUrl) {
    return null;
  }

  return {
    id,
    name,
    imageUrl,
  };
}

function normalizeCompanionPhraseDoc(data = {}) {
  const id = normalizeString(data.id);
  const text = normalizeString(data.text);

  if (!id || !text) {
    return null;
  }

  return {
    id,
    text,
  };
}

function normalizeCompanionMetaDoc(data = {}) {
  return {
    activeCharacterId: normalizeString(data.activeCharacterId),
    activePhraseId: normalizeString(data.activePhraseId),
    activePhraseText: normalizeString(data.activePhraseText),
  };
}

function normalizeCompanionState(companionState = {}) {
  const defaultCharacters = buildDefaultCompanionCharacters();
  const incomingCharacters = Array.isArray(companionState.characters)
    ? companionState.characters
      .map((character) => normalizeCompanionCharacterDoc(character))
      .filter(Boolean)
    : [];
  const charactersMap = new Map(defaultCharacters.map((character) => [character.id, character]));

  incomingCharacters.forEach((character) => {
    charactersMap.set(character.id, character);
  });

  const characters = [...charactersMap.values()];
  const phrases = Array.isArray(companionState.phrases)
    ? companionState.phrases
      .map((phrase) => normalizeCompanionPhraseDoc(phrase))
      .filter(Boolean)
    : [];
  const defaultCharacterId = characters.some((character) => character.id === DEFAULT_COPILOT_TYPE)
    ? DEFAULT_COPILOT_TYPE
    : characters[0]?.id || "cohete";
  const activeCharacterId = characters.some(
    (character) => character.id === normalizeString(companionState.activeCharacterId)
  )
    ? normalizeString(companionState.activeCharacterId)
    : defaultCharacterId;
  const activePhraseId = phrases.some((phrase) => phrase.id === normalizeString(companionState.activePhraseId))
    ? normalizeString(companionState.activePhraseId)
    : "";
  const activePhraseText = normalizeString(companionState.activePhraseText)
    || phrases.find((phrase) => phrase.id === activePhraseId)?.text
    || DEFAULT_COPILOT_PHRASE;

  return {
    type: activeCharacterId,
    phrase: activePhraseText,
    activeCharacterId,
    activePhraseId,
    activePhraseText,
    characters,
    phrases,
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
    companionSnapshot,
    prioritiesSnapshot,
    focusBlocksSnapshot,
    companionCharactersSnapshot,
    companionPhrasesSnapshot,
  ] = await Promise.all([
    getDoc(getUserMetaRef(userId, OPERATIONAL_META_DOCS.focus)),
    getDoc(getUserMetaRef(userId, OPERATIONAL_META_DOCS.operation)),
    getDoc(getUserMetaRef(userId, OPERATIONAL_META_DOCS.reviews)),
    getDoc(getUserMetaRef(userId, OPERATIONAL_META_DOCS.money)),
    getDoc(getUserMetaRef(userId, OPERATIONAL_META_DOCS.companion)),
    getDocs(getUserCollectionRef(userId, "priorities")),
    getDocs(getUserCollectionRef(userId, "focusBlocks")),
    getDocs(getUserCollectionRef(userId, "companionCharacters")),
    getDocs(getUserCollectionRef(userId, "companionPhrases")),
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
    copilot: normalizeCompanionState({
      ...normalizeCompanionMetaDoc(companionSnapshot.exists() ? companionSnapshot.data() : {}),
      characters: mapSnapshotToRecords(companionCharactersSnapshot),
      phrases: mapSnapshotToRecords(companionPhrasesSnapshot),
    }),
    reviews: reviewsSnapshot.exists() ? normalizeReviewsDoc(reviewsSnapshot.data()) : null,
    moneyGoal: moneySnapshot.exists() ? normalizeMoneyDoc(moneySnapshot.data()) : null,
    priorities: sortRecordsByTimestamp(mapSnapshotToRecords(prioritiesSnapshot), "updatedAt"),
    focusBlocks: sortRecordsByTimestamp(mapSnapshotToRecords(focusBlocksSnapshot), "updatedAt"),
    meta: {
      focusExists: focusSnapshot.exists(),
      operationExists: operationSnapshot.exists(),
      reviewsExists: reviewsSnapshot.exists(),
      moneyExists: moneySnapshot.exists(),
      companionExists: companionSnapshot.exists(),
      prioritiesCount: prioritiesSnapshot.size,
      focusBlocksCount: focusBlocksSnapshot.size,
      companionCharactersCount: companionCharactersSnapshot.size,
      companionPhrasesCount: companionPhrasesSnapshot.size,
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
  const companion = normalizeCompanionState(operationalState.copilot || operationalState.companion || {});

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
    setDoc(
      getUserMetaRef(userId, OPERATIONAL_META_DOCS.companion),
      {
        activeCharacterId: companion.activeCharacterId,
        activePhraseId: companion.activePhraseId,
        activePhraseText: companion.activePhraseText,
      },
      { merge: true }
    ),
    syncOneCollection(userId, "priorities", operationalState.priorities || []),
    syncOneCollection(userId, "focusBlocks", operationalState.focusBlocks || []),
    syncOneCollection(userId, "companionCharacters", companion.characters || []),
    syncOneCollection(userId, "companionPhrases", companion.phrases || []),
    saveDashboardMeta(userId, {
      operationSnapshot: normalizeDashboardOperationSnapshot({
        ...operationalState,
        copilot: companion,
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

export async function uploadCompanionCharacterImage(userId, characterId, file) {
  assertRemoteAvailable();

  if (!storage) {
    throw new Error("Firebase Storage no esta disponible en esta configuracion.");
  }

  if (!userId || !characterId || !file) {
    throw new Error("Faltan datos para subir la imagen del personaje.");
  }

  const imageRef = ref(storage, `users/${userId}/companionCharacters/${characterId}/image`);
  await uploadBytes(imageRef, file, {
    contentType: file.type || "image/png",
  });
  return getDownloadURL(imageRef);
}
