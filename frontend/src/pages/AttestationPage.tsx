import { useParams } from 'react-router';
import AttestationView from '../features/organizations/components/AttestationView.tsx';

export default function AttestationPage() {
  const { organizationId, userId } = useParams();

  return organizationId && userId ? (
    <AttestationView organizationId={organizationId} userId={userId} />
  ) : null;
}
