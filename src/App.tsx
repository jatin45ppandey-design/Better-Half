import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { RoomProvider } from './context/RoomContext';
import { GameCatalogProvider } from './context/GameCatalogContext';
import { ToastContainer } from './components/ui/Toast';
import { ProtectedRoute } from './components/auth/ProtectedRoute';

// Core routes loaded directly for instant initial paint
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { AuthCallbackPage } from './pages/AuthCallbackPage';
import { SignupPage } from './pages/SignupPage';
import { DashboardPage } from './pages/DashboardPage';
import { RoomLobbyPage } from './pages/RoomLobbyPage';
import { NotFoundPage } from './pages/NotFoundPage';

// Lazy loaded supporting screens and gameplay arena
const GameArenaPage = lazy(() => import('./pages/GameArenaPage').then((m) => ({ default: m.GameArenaPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const FriendsPage = lazy(() => import('./pages/FriendsPage').then((m) => ({ default: m.FriendsPage })));
const InvitationsPage = lazy(() => import('./pages/InvitationsPage').then((m) => ({ default: m.InvitationsPage })));
const MatchHistoryPage = lazy(() => import('./pages/MatchHistoryPage').then((m) => ({ default: m.MatchHistoryPage })));
const RivalryPage = lazy(() => import('./pages/RivalryPage').then((m) => ({ default: m.RivalryPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })));

const RouteLoadingFallback = () => (
  <div className="min-h-screen bg-[#FCFAFF] flex flex-col items-center justify-center p-6">
    <div className="w-12 h-12 rounded-2xl bg-[#F1EAFF] border border-[#E3D6FA] flex items-center justify-center animate-spin mb-4">
      <div className="w-4 h-4 rounded-full bg-[#593B91]" />
    </div>
    <span className="text-xs font-black uppercase tracking-widest text-[#756D82]">
      Loading Better-Half...
    </span>
  </div>
);

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <GameCatalogProvider>
            <RoomProvider>
              <Suspense fallback={<RouteLoadingFallback />}>
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/auth/callback" element={<AuthCallbackPage />} />
                <Route path="/signup" element={<SignupPage />} />

                {/* Protected Application Routes */}
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <DashboardPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/room/:roomCode"
                  element={
                    <ProtectedRoute>
                      <RoomLobbyPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/game/:gameId"
                  element={
                    <ProtectedRoute>
                      <GameArenaPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <ProfilePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/friends"
                  element={
                    <ProtectedRoute>
                      <FriendsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/invitations"
                  element={
                    <ProtectedRoute>
                      <InvitationsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/history"
                  element={
                    <ProtectedRoute>
                      <MatchHistoryPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/rivalry"
                  element={
                    <ProtectedRoute>
                      <RivalryPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <ProtectedRoute>
                      <SettingsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute>
                      <AdminDashboardPage />
                    </ProtectedRoute>
                  }
                />

                <Route path="*" element={<NotFoundPage />} />
              </Routes>
              </Suspense>
              <ToastContainer />
            </RoomProvider>
          </GameCatalogProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
