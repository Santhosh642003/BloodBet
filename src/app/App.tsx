import { BrowserRouter, Routes, Route } from 'react-router';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { TournamentPage } from './pages/TournamentPage';
import { FightersPage } from './pages/FightersPage';
import { ContractsPage } from './pages/ContractsPage';
import { BuildFighterPage } from './pages/BuildFighterPage';
import { HostTournamentPage } from './pages/HostTournamentPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { ProfilePage } from './pages/ProfilePage';
import { PlayersPage } from './pages/PlayersPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/tournament" element={<TournamentPage />} />
        <Route path="/fighters" element={<FightersPage />} />
        <Route path="/contracts" element={<ContractsPage />} />
        <Route path="/build-fighter" element={<BuildFighterPage />} />
        <Route path="/host-tournament" element={<HostTournamentPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/players" element={<PlayersPage />} />
      </Routes>
    </BrowserRouter>
  );
}
