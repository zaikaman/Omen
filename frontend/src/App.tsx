import { BrowserRouter, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { DashboardHome } from "./pages/DashboardHome";

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
        <Route path="/docs" element={<Home />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
}
