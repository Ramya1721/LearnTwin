import { Routes, Route, Navigate } from "react-router-dom";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import LearningPathPage from "./pages/LearningPath";
import TopicDetailPage from "./pages/TopicDetail";
import DigitalTwinPage from "./pages/DigitalTwin";
import SkillsGraphPage from "./pages/SkillsGraph";
import AssessmentsPage from "./pages/Assessments";
import PracticeHubPage from "./pages/PracticeHub";
import BottleneckAnalysisPage from "./pages/BottleneckAnalysis";
import PathCorrectionsPage from "./pages/PathCorrections";
import AnalyticsPage from "./pages/Analytics";
import AIAssistantPage from "./pages/AIAssistant";
import SettingsPage from "./pages/Settings";
import { ProtectedRoute } from "./components/ProtectedRoute";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/onboarding" element={<Onboarding />} />

      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/learning-path" element={<ProtectedRoute><LearningPathPage /></ProtectedRoute>} />
      <Route path="/learning-path/:itemId" element={<ProtectedRoute><TopicDetailPage /></ProtectedRoute>} />
      <Route path="/digital-twin" element={<ProtectedRoute><DigitalTwinPage /></ProtectedRoute>} />
      <Route path="/skills-graph" element={<ProtectedRoute><SkillsGraphPage /></ProtectedRoute>} />
      <Route path="/assessments" element={<ProtectedRoute><AssessmentsPage /></ProtectedRoute>} />
      <Route path="/practice" element={<ProtectedRoute><PracticeHubPage /></ProtectedRoute>} />
      <Route path="/bottlenecks" element={<ProtectedRoute><BottleneckAnalysisPage /></ProtectedRoute>} />
      <Route path="/path-corrections" element={<ProtectedRoute><PathCorrectionsPage /></ProtectedRoute>} />
      <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
      <Route path="/assistant" element={<ProtectedRoute><AIAssistantPage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
