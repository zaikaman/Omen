import { BrowserRouter, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { DashboardHome } from "./pages/DashboardHome";
import { SignalsPage } from "./pages/SignalsPage";
import { IntelPage } from "./pages/IntelPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { AnalyticsOverview } from "./pages/analytics/AnalyticsOverview";
import { PerformanceAnalytics } from "./pages/analytics/PerformanceAnalytics";
import { MarketAnalytics } from "./pages/analytics/MarketAnalytics";
import { SignalAnalytics } from "./pages/analytics/SignalAnalytics";
import { EvidencePage } from "./pages/EvidencePage";
import { SwarmTracePage } from "./pages/SwarmTracePage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/app" element={
          <DashboardLayout>
            <DashboardHome />
          </DashboardLayout>
        } />
        <Route path="/app/signals" element={
          <DashboardLayout>
            <SignalsPage />
          </DashboardLayout>
        } />
        <Route path="/app/intel" element={
          <DashboardLayout>
            <IntelPage />
          </DashboardLayout>
        } />
        <Route path="/app/intel/:id" element={
          <DashboardLayout>
            <IntelPage />
          </DashboardLayout>
        } />
        <Route path="/app/analytics" element={
          <DashboardLayout>
            <AnalyticsPage />
          </DashboardLayout>
        }>
          <Route index element={<AnalyticsOverview />} />
          <Route path="performance" element={<PerformanceAnalytics />} />
          <Route path="market" element={<MarketAnalytics />} />
          <Route path="signals" element={<SignalAnalytics />} />
        </Route>
        <Route path="/app/evidence" element={
          <DashboardLayout>
            <EvidencePage />
          </DashboardLayout>
        } />
        <Route path="/app/swarm" element={
          <DashboardLayout>
            <SwarmTracePage />
          </DashboardLayout>
        } />
        <Route path="/docs" element={<Home />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
}
