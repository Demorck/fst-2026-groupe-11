import { createBrowserRouter } from 'react-router';
import RootLayout from './layouts/RootLayout.tsx';
import CheckinPage from './pages/CheckinPage.tsx';
import CreateEventPage from './pages/CreateEventPage.tsx';
import DashboardPage from './pages/DashboardPage.tsx';
import EventDetailPage from './pages/EventDetailPage.tsx';
import EventsPage from './pages/EventsPage.tsx';
import HealthPage from './pages/HealthPage.tsx';
import LoginPage from './pages/LoginPage.tsx';
import NotFoundPage from './pages/NotFoundPage.tsx';
import VolunteerShiftsPage from './pages/VolunteerShiftsPage.tsx';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <EventsPage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'events/new', element: <CreateEventPage /> },
      { path: 'events/:eventId', element: <EventDetailPage /> },
      { path: 'events/:eventId/shifts', element: <VolunteerShiftsPage /> },
      { path: 'events/:eventId/checkin', element: <CheckinPage /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'health', element: <HealthPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
