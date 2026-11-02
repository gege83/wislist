import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "AIzaSyChI1dfrySho6uu__IDJpG1uaxz8ifqrI4",
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "wishlist-e9f11.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "wishlist-e9f11",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "wishlist-e9f11.firebasestorage.app",
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "598889132017",
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "1:598889132017:web:eec0504fc33faaf2c4de50",
  measurementId: "G-JYTH4TVRZL"
};

// Initialize Firebase
export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);

if (import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS !== "0") {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", {
    disableWarnings: true,
  });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}
