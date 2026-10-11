import { useDocumentTitle } from '../hooks/useDocumentTitle.ts';
import DashboardView from '../features/dashboard/components/DashboardView.tsx';

export default function DashboardPage() {
  useDocumentTitle('Dashboard');
  return (
    <div className="space-y-7">
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Suivi de vos événements à venir.</p>
      </div>
      <DashboardView />
    </div>
  );
}
