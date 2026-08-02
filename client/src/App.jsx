import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell.jsx";
import ProtectedRoute from "./routes/ProtectedRoute.jsx";
import Landing from "./pages/Landing.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import ResumeUpload from "./pages/ResumeUpload.jsx";
import ATSResult from "./pages/ATSResult.jsx";
import VoiceInterview from "./pages/VoiceInterview.jsx";
import FinalReport from "./pages/FinalReport.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/resume/upload" element={<ResumeUpload />} />
            <Route path="/ats-result/:resumeId" element={<ATSResult />} />
            <Route path="/interview/:sessionId" element={<VoiceInterview />} />
            <Route path="/report/:sessionId" element={<FinalReport />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
