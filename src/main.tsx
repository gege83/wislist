import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { AuthProvider } from "./context/AuthProvider";
import { FirebaseProvider } from "./context/FirebaseContext";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <FirebaseProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </FirebaseProvider>
  </StrictMode>,
);
