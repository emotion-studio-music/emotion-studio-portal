import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { MiniPlayer } from './MiniPlayer';
import { IconCalendar, IconDisc, IconLogout, IconSettings, IconUsers } from './Icons';
import { useToday } from '../lib/today';
import { useAllDemos } from '../lib/demos';

export function AdminLayout() {
  const { user, logout } = useAuth();
  const newDemos = useAllDemos(true).filter((d) => d.status === 'nuova').length;
  const today = useToday();
  return (
    <div className="admin-app">
      <aside className="sidebar">
        <img src="/logo.png" alt="Emotion Studio" />
        <nav className="side-nav" aria-label="Menu admin">
          <NavLink to="/admin/oggi" className={({ isActive }) => `side-link${isActive ? ' active' : ''}`}>
            <IconCalendar /> <span>Oggi</span>{today.count > 0 && <b className="nav-count" aria-label={`${today.count} cose da fare`}>{today.count}</b>}
          </NavLink>
          <NavLink to="/admin" end className={({ isActive }) => `side-link${isActive ? ' active' : ''}`}>
            <IconUsers /> <span>Artisti</span>
          </NavLink>
 <NavLink to="/admin/demo" className={({ isActive }) => `side-link${isActive ? ' active' : ''}`}>
            <IconDisc /> <span>Demo</span>{newDemos > 0 && <b className="nav-count" aria-label={`${newDemos} nuove`}>{newDemos}</b>}
          </NavLink>
          <NavLink to="/admin/impostazioni" className={({ isActive }) => `side-link${isActive ? ' active' : ''}`}>
            <IconSettings /> <span>Impostazioni studio</span>
          </NavLink>
        </nav>
        <div className="sidebar-foot">
          <span className="who tiny muted" style={{ padding: '0 12px', overflowWrap: 'anywhere' }}>{user?.email}</span>
          <button className="side-link btn-ghost" style={{ border: 'none', background: 'none', cursor: 'pointer' }} onClick={() => void logout()}>
            <IconLogout /> <span>Esci</span>
          </button>
        </div>
      </aside>
      <main className="admin-main">
        <div className="admin-inner">
          <Outlet />
        </div>
      </main>
      <MiniPlayer bottom="calc(16px + env(safe-area-inset-bottom, 0px))" />
    </div>
  );
}
