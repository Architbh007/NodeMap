import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { LandingPage } from '@/pages/LandingPage';
import { UploadPage } from '@/pages/UploadPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { GraphExplorerPage } from '@/pages/GraphExplorerPage';
import { RepoGraphPage } from '@/pages/RepoGraphPage';
import { DependencyGraphPage } from '@/pages/DependencyGraphPage';
import { EndpointMapPage } from '@/pages/EndpointMapPage';
import { RiskMapPage } from '@/pages/RiskMapPage';
import { PRImpactPage } from '@/pages/PRImpactPage';
import { DeadCodePage } from '@/pages/DeadCodePage';
import { AIExplainerPage } from '@/pages/AIExplainerPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { SettingsPage } from '@/pages/SettingsPage';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />

      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/repo-graph" element={<RepoGraphPage />} />
        <Route path="/dependency-graph" element={<DependencyGraphPage />} />
        <Route path="/endpoint-map" element={<EndpointMapPage />} />
        <Route path="/risk-map" element={<RiskMapPage />} />
        <Route path="/pr-impact" element={<PRImpactPage />} />
        <Route path="/dead-code" element={<DeadCodePage />} />
        <Route path="/tunner" element={<AIExplainerPage />} />
        <Route path="/ai-explainer" element={<Navigate to="/tunner" replace />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        {/* legacy direct graph route */}
        <Route path="/graph/:id" element={<GraphExplorerPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
