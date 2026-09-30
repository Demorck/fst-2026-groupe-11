import { NavLink, Outlet } from 'react-router';

export default function RootLayout() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b bg-white">
        <nav className="mx-auto flex max-w-5xl gap-6 px-4 py-3">
          <NavLink to="/" className="font-semibold">
            G-Event
          </NavLink>
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/login" className="ml-auto">
            Connexion
          </NavLink>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
