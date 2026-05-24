import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import { AuthGuard } from "@/components/AuthGuard";
import { AppInitializer } from "@/components/AppInitializer";
import Dashboard from "@/pages/Dashboard";
import IncomePage from "@/pages/IncomePage";
import ExpensesPage from "@/pages/ExpensesPage";
import TransfersPage from "@/pages/TransfersPage";
import BankBalancesPage from "@/pages/BankBalancesPage";
import ReportsPage from "@/pages/ReportsPage";
import SearchPage from "@/pages/SearchPage";
import SettingsPage from "@/pages/SettingsPage";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import SetupWizard from "@/pages/SetupWizard";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Setup (auth required, setup not required) */}
          <Route
            path="/setup"
            element={
              <AuthGuard requireSetup={false}>
                <SetupWizard />
              </AuthGuard>
            }
          />

          {/* Protected routes */}
          <Route
            path="/*"
            element={
              <AuthGuard>
                <AppInitializer>
                  <AppLayout>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/income" element={<IncomePage />} />
                      <Route path="/expenses" element={<ExpensesPage />} />
                      <Route path="/transfers" element={<TransfersPage />} />
                      <Route path="/balances" element={<BankBalancesPage />} />
                      <Route path="/reports" element={<ReportsPage />} />
                      <Route path="/search" element={<SearchPage />} />
                      <Route path="/settings" element={<SettingsPage />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </AppLayout>
                </AppInitializer>
              </AuthGuard>
            }
          />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
