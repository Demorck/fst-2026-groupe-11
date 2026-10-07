import { createBrowserRouter } from 'react-router';
import RequireAuth from './features/auth/components/RequireAuth.tsx';
import RootLayout from './layouts/RootLayout.tsx';
import CheckinPage from './pages/CheckinPage.tsx';
import CreateEventPage from './pages/CreateEventPage.tsx';
import DashboardPage from './pages/DashboardPage.tsx';
import EventDetailPage from './pages/EventDetailPage.tsx';
import EventsPage from './pages/EventsPage.tsx';
import HealthPage from './pages/HealthPage.tsx';
import AttestationPage from './pages/AttestationPage.tsx';
import LoginPage from './pages/LoginPage.tsx';
import MyTicketsPage from './pages/MyTicketsPage.tsx';
import NotFoundPage from './pages/NotFoundPage.tsx';
import OrganizationManagePage from './pages/OrganizationManagePage.tsx';
import OrganizationPage from './pages/OrganizationPage.tsx';
import OrganizationsPage from './pages/OrganizationsPage.tsx';
import RegisterPage from './pages/RegisterPage.tsx';
import VolunteerShiftsPage from './pages/VolunteerShiftsPage.tsx';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <EventsPage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'events/:eventId', element: <EventDetailPage /> },
      // Public: who an organization is and what it runs next
      {
        path: 'organizations/:organizationId',
        element: <OrganizationPage />,
      },
      {
        element: <RequireAuth roles={['ORGANIZER']} />,
        children: [
          { path: 'events/new', element: <CreateEventPage /> },
          { path: 'events/:eventId/checkin', element: <CheckinPage /> },
          { path: 'dashboard', element: <DashboardPage /> },
        ],
      },
      {
        element: <RequireAuth />,
        children: [{ path: 'me/tickets', element: <MyTicketsPage /> }],
      },
      {
        element: <RequireAuth roles={['VOLUNTEER', 'ORGANIZER']} />,
        children: [
          { path: 'organizations', element: <OrganizationsPage /> },
          {
            path: 'organizations/:organizationId/manage',
            element: <OrganizationManagePage />,
          },
          {
            path: 'organizations/:organizationId/attestation/:userId',
            element: <AttestationPage />,
          },
          { path: 'events/:eventId/shifts', element: <VolunteerShiftsPage /> },
        ],
      },
      { path: 'health', element: <HealthPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
