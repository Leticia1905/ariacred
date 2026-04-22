import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC7aTQo0taAGi9QYyV1-jr4uW-95ZtZxg",
  authDomain: "aria-cred.firebaseapp.com",
  projectId: "aria-cred",
  storageBucket: "aria-cred.firebasestorage.app",
  messagingSenderId: "182789570867",
  appId: "1:182789570867:web:f238ffb4c78cdfb4263e46"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
