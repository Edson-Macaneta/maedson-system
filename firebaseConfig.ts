import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// ------------------------------------------------------------------
// IMPORTANTE: SUBSTITUA OS VALORES ABAIXO PELAS SUAS CHAVES DO FIREBASE
// ------------------------------------------------------------------
const firebaseConfig = {
  apiKey: "SUA_API_KEY_AQUI",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_PROJETO.appspot.com",
  messagingSenderId: "SEU_MESSAGING_SENDER_ID",
  appId: "SEU_APP_ID"
};

// Verifica se as chaves foram configuradas antes de iniciar
const isConfigured = firebaseConfig.apiKey !== "SUA_API_KEY_AQUI";

let app;
let auth;
let db;
let googleProvider;

if (isConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  googleProvider = new GoogleAuthProvider();
} else {
  console.warn("Firebase não configurado. Por favor, edite o arquivo firebaseConfig.ts");
}

export { auth, db, googleProvider, isConfigured };