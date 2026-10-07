import { NavLink, Outlet, useNavigate } from 'react-router';
import { clearSession, useSession } from '../features/auth/session.ts';

export default function RootLayout() {
  const session = useSession();
  const navigate = useNavigate();

  async function logout() {
    clearSession();
    await navigate('/');
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b bg-white">
        <nav className="mx-auto flex max-w-5xl gap-6 px-4 py-3">
          <NavLink to="/" className="font-semibold">
            G-Event
          </NavLink>
          <NavLink to="/" end>
            Événements
          </NavLink>
          {session?.user.role === 'ORGANIZER' && (
            <>
              <NavLink to="/events/new">Créer un événement</NavLink>
              <NavLink to="/dashboard">Dashboard</NavLink>
            </>
          )}
          {session && <NavLink to="/me/tickets">Mes billets</NavLink>}
          {session ? (
            <>
              <NavLink to="/profile" className="ml-auto">
                {session.user.name}
              </NavLink>
              <button type="button" onClick={logout}>
                Déconnexion
              </button>
            </>
          ) : (
            <NavLink to="/login" className="ml-auto">
              Connexion
            </NavLink>
          )}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
