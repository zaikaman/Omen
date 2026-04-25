import { BrowserRouter, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { DashboardHome } from "./pages/DashboardHome";
import { SignalsPage } from "./pages/SignalsPage";
import { IntelPage } from "./pages/IntelPage";

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
        <Route path="/docs" element={<Home />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
}
