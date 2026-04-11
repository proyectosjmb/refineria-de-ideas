/*
  Inicializacion de Firebase con el SDK modular por CDN.
  La configuracion real se inyecta desde window.__REFINERIA_FIREBASE_CONFIG__ en index.html.
*/

import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

const REQUIRED_FIREBASE_KEYS = ["apiKey", "authDomain", "projectId", "appId"];

function getRawFirebaseConfig() {
  if (typeof window === "undefined") {
    return {};
  }

  return window.__REFINERIA_FIREBASE_CONFIG__ || {};
}

function hasRequiredFirebaseConfig(config = {}) {
  return REQUIRED_FIREBASE_KEYS.every((key) => Boolean(String(config?.[key] || "").trim()));
}

const firebaseConfig = getRawFirebaseConfig();
const firebaseReady = hasRequiredFirebaseConfig(firebaseConfig);

const firebaseApp = firebaseReady
  ? (getApps().length ? getApp() : initializeApp(firebaseConfig))
  : null;

const auth = firebaseApp ? getAuth(firebaseApp) : null;
const db = firebaseApp ? getFirestore(firebaseApp) : null;
const authPersistenceReady = auth
  ? setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.warn("No se pudo fijar la persistencia local de Firebase Auth.", error);
  })
  : Promise.resolve();

export function isFirebaseConfigured() {
  return firebaseReady;
}

export function getFirebaseServices() {
  return {
    app: firebaseApp,
    auth,
    db,
  };
}

export function getFirebaseSetupMessage() {
  if (firebaseReady) {
    return "";
  }

  return "Configura window.__REFINERIA_FIREBASE_CONFIG__ con tus credenciales de Firebase para activar autenticacion y Firestore.";
}

export async function registerWithEmail(email, password) {
  if (!auth) {
    throw new Error(getFirebaseSetupMessage());
  }

  await authPersistenceReady;
  return createUserWithEmailAndPassword(auth, email, password);
}

export async function loginWithEmail(email, password) {
  if (!auth) {
    throw new Error(getFirebaseSetupMessage());
  }

  await authPersistenceReady;
  return signInWithEmailAndPassword(auth, email, password);
}

export async function logoutCurrentUser() {
  if (!auth) {
    return;
  }

  await signOut(auth);
}

export function observeAuthState(callback) {
  if (!auth) {
    callback(null);
    return () => {};
  }

  return onAuthStateChanged(auth, callback);
}
