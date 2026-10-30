import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { IconLogout, IconSettings, IconUsers } from './Icons';

export function AdminLayout() {
  const { user, logout } = useAuth();
  return (
    <div className="admin-app">
      <aside className="sidebar">
        <img src="/logo.png" alt="Emotion Studio" />
        <nav className="side-nav" aria-label="Menu admin">
          <NavLink to="/admin" end className={({ isActive }) => `side-link${isActive ? ' active' : ''}`}>
            <IconUsers /> <span>Artisti</span>
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
    </div>
  );
}
