import OrganizationsOverview from '../features/organizations/components/OrganizationsOverview.tsx';

export default function OrganizationsPage() {
  return (
    <div className="space-y-6">
      <h1 className="page-title">Mes organisations</h1>
      <OrganizationsOverview />
    </div>
  );
}
