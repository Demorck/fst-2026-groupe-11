import { useParams } from 'react-router';
import OrganizationDetailView from '../features/organizations/components/OrganizationDetailView.tsx';

export default function OrganizationManagePage() {
  const { organizationId } = useParams();

  // key: moving from one organization to another reloads it instead of showing the old one
  return organizationId ? (
    <OrganizationDetailView
      key={organizationId}
      organizationId={organizationId}
    />
  ) : null;
}
