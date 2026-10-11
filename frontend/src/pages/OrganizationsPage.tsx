import { useDocumentTitle } from '../hooks/useDocumentTitle.ts';
import OrganizationsOverview from '../features/organizations/components/OrganizationsOverview.tsx';

export default function OrganizationsPage() {
  useDocumentTitle('Mes organisations');
  return (
    <div className="space-y-7">
      <div>
        <h1 className="page-title">Mes organisations</h1>
        <p className="page-subtitle">
          Les associations dont vous êtes membre, et vos invitations.
        </p>
      </div>
      <OrganizationsOverview />
    </div>
  );
}
