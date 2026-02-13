import { BrowserRouter, Routes, Route } from "react-router";
import Layout from "./components/Layout";
import HomePage from "./pages/HomePage";
import SettingsPage from "./pages/SettingsPage";

export default function App() {
  // Vite sets BASE_URL to "/app/" in browser mode, "/" in Tauri mode
  const base = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";

  return (
    <BrowserRouter basename={base}>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
