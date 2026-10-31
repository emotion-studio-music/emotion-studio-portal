import { NavLink, Outlet } from 'react-router-dom';
import { MiniPlayer } from './MiniPlayer';
import { usePlayer } from '../lib/player';
import { IconCard, IconDisc, IconHome, IconUpload, IconUser } from './Icons';

const tabs = [
  { to: '/', label: 'Home', Icon: IconHome, end: true },
  { to: '/progetti', label: 'Progetti', Icon: IconDisc },
  { to: '/carica', label: 'Demo', Icon: IconUpload },
  { to: '/pagamenti', label: 'Pagamenti', Icon: IconCard },
  { to: '/profilo', label: 'Profilo', Icon: IconUser },
];

export function ArtistLayout() {
  const pl = usePlayer();
  return (
    <div className={`artist-app${pl.track ? ' with-mini' : ''}`}>
      <Outlet />
      <MiniPlayer bottom="calc(66px + env(safe-area-inset-bottom, 0px))" />
      <nav className="tabbar" aria-label="Navigazione principale">
        <div className="tabbar-inner">
          {tabs.map(({ to, label, Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
              <Icon />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
