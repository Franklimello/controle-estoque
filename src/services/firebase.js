// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCh-55LWeahrnI1jyCp8dEBm2rs7IN5gHg",
  authDomain: "controle-estoque-d918f.firebaseapp.com",
  projectId: "controle-estoque-d918f",
  storageBucket: "controle-estoque-d918f.firebasestorage.app",
  messagingSenderId: "219528544550",
  appId: "1:219528544550:web:5d7790a7cb85d502a881e7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

export default app;


