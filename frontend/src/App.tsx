// FILE: frontend/src/App.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import ChatPage from "./pages/ChatPage";
import FilesPage from "./pages/FilesPage";
import SearchPage from "./pages/SearchPage";
import ImagesPage from "./pages/ImagesPage";
import CodePage from "./pages/CodePage";
import DocumentsPage from "./pages/DocumentsPage";
import MemoryPage from "./pages/MemoryPage";
import AlertsPage from "./pages/AlertsPage";
import KnowledgePage from "./pages/KnowledgePage";
import VoicePage from "./pages/VoicePage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/chat" replace />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="chat/:conversationId" element={<ChatPage />} />
        <Route path="files" element={<FilesPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="images" element={<ImagesPage />} />
        <Route path="code" element={<CodePage />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="memory" element={<MemoryPage />} />
        <Route path="alerts" element={<AlertsPage />} />
        <Route path="knowledge" element={<KnowledgePage />} />
        <Route path="voice" element={<VoicePage />} />
      </Route>
    </Routes>
  );
}
