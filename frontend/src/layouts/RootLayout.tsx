import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { ROLE_LABELS } from '../features/auth/types.ts';
import { clearSession, useSession } from '../features/auth/session.ts';
import { usePendingInvitations } from '../features/organizations/pendingInvitations.ts';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');

// min-h-11: touch target; the active page gets the 2px brand underline of the mockup
const navClass = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-11 items-center border-b-2 ${
    isActive
      ? 'border-brand font-semibold text-brand'
      : 'border-transparent text-ink hover:text-brand'
  }`;

export default function RootLayout() {
  const session = useSession();
  const navigate = useNavigate();
  const inOrganizations =
    session?.user.role === 'ORGANIZER' || session?.user.role === 'VOLUNTEER';
  const pendingInvitations = usePendingInvitations(inOrganizations);

  async function logout() {
    clearSession();
    await navigate('/');
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-white">
        <nav className="mx-auto flex max-w-[1120px] flex-wrap items-center gap-x-7 gap-y-1 px-4 py-2 sm:px-6">
          <Link
            to="/"
            className="font-display text-[22px] font-bold text-ink hover:text-ink"
          >
            G-Event
          </Link>
          <NavLink to="/" end className={navClass}>
            Événements
          </NavLink>
          {session?.user.role === 'ORGANIZER' && (
            <>
              <NavLink to="/events/new" className={navClass}>
                Créer un événement
              </NavLink>
              <NavLink to="/dashboard" className={navClass}>
                Dashboard
              </NavLink>
            </>
          )}
          {session && (
            <NavLink to="/me/tickets" className={navClass}>
              Mes billets
            </NavLink>
          )}
          {inOrganizations && (
            <NavLink to="/organizations" className={navClass}>
              Mes organisations
              {pendingInvitations > 0 && (
                <span
                  aria-label={`${pendingInvitations} invitation(s) en attente`}
                  className="ml-1.5 rounded-full bg-brand px-1.5 py-0.5 text-xs font-semibold text-white"
                >
                  {pendingInvitations}
                </span>
              )}
            </NavLink>
          )}
          <div className="ml-auto flex items-center gap-3 text-sm">
            {session ? (
              <>
                <span
                  aria-hidden="true"
                  className="flex size-8 items-center justify-center rounded-full bg-brand-tint font-semibold text-brand-deep"
                >
                  {initials(session.user.name)}
                </span>
                <NavLink
                  to="/profile"
                  className="font-medium text-ink hover:text-brand"
                >
                  {session.user.name}
                </NavLink>
                <span className="hidden text-muted sm:inline">
                  {ROLE_LABELS[session.user.role]}
                </span>
                <button
                  type="button"
                  onClick={logout}
                  className="btn btn-secondary"
                >
                  Déconnexion
                </button>
              </>
            ) : (
              <NavLink to="/login" className="btn btn-primary">
                Connexion
              </NavLink>
            )}
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-[1120px] px-4 pt-8 pb-16 sm:px-6 sm:pt-10">
        <Outlet />
      </main>
    </div>
  );
}
