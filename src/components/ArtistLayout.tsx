import { NavLink, Outlet } from 'react-router-dom';
import { IconCard, IconDisc, IconHome, IconUpload, IconUser } from './Icons';

const tabs = [
  { to: '/', label: 'Home', Icon: IconHome, end: true },
  { to: '/progetti', label: 'Progetti', Icon: IconDisc },
  { to: '/carica', label: 'Carica', Icon: IconUpload },
  { to: '/pagamenti', label: 'Pagamenti', Icon: IconCard },
  { to: '/profilo', label: 'Profilo', Icon: IconUser },
];

export function ArtistLayout() {
  return (
    <div className="artist-app">
      <Outlet />
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
