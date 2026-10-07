import { useParams } from 'react-router';
import PublicOrganizationView from '../features/organizations/components/PublicOrganizationView.tsx';

export default function OrganizationPage() {
  const { organizationId } = useParams();

  return organizationId ? (
    <PublicOrganizationView
      key={organizationId}
      organizationId={organizationId}
    />
  ) : null;
}
