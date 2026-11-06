import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "swiper/swiper-bundle.css";
import "flatpickr/dist/flatpickr.css";
import App from "./App.tsx";
import { AppWrapper } from "./components/common/PageMeta.tsx";
import { ThemeProvider } from "./context/ThemeContext.tsx";
import { NotificationProvider } from "./context/NotificationProvider.tsx";
import { ConfirmProvider } from "./context/ConfirmProvider.tsx";
import { AuthProvider } from "./context/AuthContext.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <ThemeProvider>
        <NotificationProvider>
          <ConfirmProvider>
            <AppWrapper>
              <App />
            </AppWrapper>
          </ConfirmProvider>
        </NotificationProvider>
      </ThemeProvider>
    </AuthProvider>
  </StrictMode>,
);
