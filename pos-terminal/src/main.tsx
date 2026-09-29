import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import App from "./App";
import "./index.css";

// Apply the saved theme before the first paint, synchronously, so the app
// never flashes dark before switching to a saved light preference.
try {
  const raw = localStorage.getItem("pos-theme");
  const theme = raw ? JSON.parse(raw)?.state?.theme : null;
  document.documentElement.setAttribute("data-theme", theme === "light" ? "light" : "dark");
} catch {
  document.documentElement.setAttribute("data-theme", "dark");
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 2000,
          style: {
            background: "#1f2937",
            color: "#f9fafb",
            borderRadius: "16px",
            fontSize: "16px",
            padding: "12px 24px",
          },
        }}
      />
    </QueryClientProvider>
  </React.StrictMode>
);
