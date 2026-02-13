import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { isMobile } from "./lib/useIsMobile";
import DebugConsole from "./components/DebugConsole";
import Layout from "./components/Layout";
import MobileLayout from "./components/MobileLayout";
import HomePage from "./pages/HomePage";
import SettingsPage from "./pages/SettingsPage";
import MobileHomePage from "./pages/MobileHomePage";
import MobileFileBrowserPage from "./pages/MobileFileBrowserPage";
import MobileSettingsPage from "./pages/MobileSettingsPage";

export default function App() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";

  if (isMobile) {
    return (
      <BrowserRouter basename={base}>
        <MobileLayout>
          <Routes>
            <Route path="/" element={<MobileHomePage />} />
            <Route path="/browse" element={<MobileFileBrowserPage />} />
            <Route path="/settings" element={<MobileSettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </MobileLayout>
        <DebugConsole />
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter basename={base}>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
      <DebugConsole />
    </BrowserRouter>
  );
}
