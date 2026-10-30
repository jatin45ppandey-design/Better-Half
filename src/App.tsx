import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { RoomProvider } from './context/RoomContext';
import { ToastContainer } from './components/ui/Toast';

// Core routes loaded directly for instant initial paint
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { DashboardPage } from './pages/DashboardPage';
import { RoomLobbyPage } from './pages/RoomLobbyPage';
import { GameArenaPage } from './pages/GameArenaPage';
import { NotFoundPage } from './pages/NotFoundPage';

// Lazy loaded supporting screens
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
      Loading PlaySpace...
    </span>
  </div>
);

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <RoomProvider>
            <Suspense fallback={<RouteLoadingFallback />}>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/room/:roomCode" element={<RoomLobbyPage />} />
                <Route path="/game/:gameId" element={<GameArenaPage />} />
                
                {/* Phase 3 Supporting Application Routes */}
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/friends" element={<FriendsPage />} />
                <Route path="/invitations" element={<InvitationsPage />} />
                <Route path="/history" element={<MatchHistoryPage />} />
                <Route path="/rivalry" element={<RivalryPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/admin" element={<AdminDashboardPage />} />

                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
            <ToastContainer />
          </RoomProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
