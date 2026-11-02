import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { PlayerProvider } from './lib/player';
import { isConfigured } from './lib/firebase';
import { Loading } from './components/Loading';
import { ArtistLayout } from './components/ArtistLayout';
import { AdminLayout } from './components/AdminLayout';
import { Login } from './pages/Login';
import { Consent } from './pages/Consent';
import { NoAccess } from './pages/NoAccess';
import { Setup } from './pages/Setup';
import { ArtistHome } from './pages/artist/ArtistHome';
import { Profile } from './pages/artist/Profile';
import { Payments } from './pages/artist/Payments';
import { Artists } from './pages/admin/Artists';
import { ArtistForm } from './pages/admin/ArtistForm';
import { Settings } from './pages/admin/Settings';
import { Music } from './pages/admin/Music';
import { Projects } from './pages/artist/Projects';
import { TrackPage } from './pages/TrackPage';
import { DemoPage } from './pages/DemoPage';
import { Demos } from './pages/admin/Demos';
import { Upload } from './pages/artist/Upload';
import { Sessions } from './pages/artist/Sessions';
import { ManagePayments, ManageRedirect, ManageWork } from './pages/admin/Manage';
import { Today } from './pages/admin/Today';

function ArtistPreview() {
  const { id } = useParams();
  return <div className="artist-app" style={{ paddingBottom: 0 }}><ArtistHome artistId={id!} preview /></div>;
}

function AdminTrackRoute() {
  const { id, trackId } = useParams();
  return <TrackPage artistId={id!} trackId={trackId!} backTo={`/admin/artisti/${id}/musica`} backLabel="Musica" href={`/admin/artisti/${id}/brani/${trackId}`} />;
}

function ArtistTrackRoute() {
  const { artistId } = useAuth();
  const { trackId } = useParams();
  return <TrackPage artistId={artistId!} trackId={trackId!} backTo="/progetti" backLabel="Progetti" href={`/brano/${trackId}`} />;
}

function AdminDemoRoute() {
  const { id, demoId } = useParams();
  return <DemoPage artistId={id!} demoId={demoId!} backTo="/admin/demo" backLabel="Demo" href={`/admin/artisti/${id}/demo/${demoId}`} />;
}

function ArtistDemoRoute() {
  const { artistId } = useAuth();
  const { demoId } = useParams();
  return <DemoPage artistId={artistId!} demoId={demoId!} backTo="/carica" backLabel="Le mie demo" href={`/demo/${demoId}`} />;
}

function FeatTrackRoute() {
  const { ownerId, trackId } = useParams();
  return <TrackPage artistId={ownerId!} trackId={trackId!} backTo="/progetti" backLabel="Progetti" href={`/feat/${ownerId}/${trackId}`} shared />;
}

function ArtistHomeRoute() {
  const { artistId } = useAuth();
  return <ArtistHome artistId={artistId!} />;
}

function Gate() {
  const { loading, user, role, privacyAccepted } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Login />;
  if (role === 'none') return <NoAccess />;

  if (role === 'admin') {
    return (
      <PlayerProvider>
      <Routes>
        <Route path="/admin/artisti/:id/anteprima" element={<ArtistPreview />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Artists />} />
          <Route path="artisti/nuovo" element={<ArtistForm key="nuovo" />} />
          <Route path="artisti/:id" element={<ArtistForm />} />
          <Route path="artisti/:id/musica" element={<Music />} />
          <Route path="artisti/:id/brani/:trackId" element={<AdminTrackRoute />} />
          <Route path="impostazioni" element={<Settings />} />
          <Route path="demo" element={<Demos />} />
          <Route path="oggi" element={<Today />} />
          <Route path="artisti/:id/pagamenti" element={<ManagePayments />} />
          <Route path="artisti/:id/lavori" element={<ManageWork />} />
          <Route path="artisti/:id/gestione" element={<ManageRedirect />} />
          <Route path="artisti/:id/demo" element={<Demos />} />
          <Route path="artisti/:id/demo/:demoId" element={<AdminDemoRoute />} />
        </Route>
        <Route path="*" element={<Navigate to="/admin/oggi" replace />} />
      </Routes>
      </PlayerProvider>
    );
  }

  if (!privacyAccepted) return <Consent />;
  return (
    <PlayerProvider>
    <Routes>
      <Route element={<ArtistLayout />}>
        <Route index element={<ArtistHomeRoute />} />
        <Route path="progetti" element={<Projects />} />
        <Route path="brano/:trackId" element={<ArtistTrackRoute />} />
        <Route path="carica" element={<Upload />} />
        <Route path="demo/:demoId" element={<ArtistDemoRoute />} />
        <Route path="sessioni" element={<Sessions />} />
        <Route path="feat/:ownerId/:trackId" element={<FeatTrackRoute />} />
        <Route path="pagamenti" element={<Payments />} />
        <Route path="profilo" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </PlayerProvider>
  );
}

export default function App() {
  if (!isConfigured) return <Setup />;
  return (
    <AuthProvider>
      <BrowserRouter>
        <Gate />
      </BrowserRouter>
    </AuthProvider>
  );
}
