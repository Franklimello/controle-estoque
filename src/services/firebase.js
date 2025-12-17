// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
// As credenciais são carregadas das variáveis de ambiente
// Configure o arquivo .env na raiz do projeto com suas credenciais do Firebase
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Validação das variáveis de ambiente
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error("❌ Erro: Variáveis de ambiente do Firebase não configuradas!");
  console.error("Por favor, crie um arquivo .env na raiz do projeto com as credenciais do Firebase.");
  console.error("Veja o arquivo .env.example para um exemplo.");
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

export default app;


