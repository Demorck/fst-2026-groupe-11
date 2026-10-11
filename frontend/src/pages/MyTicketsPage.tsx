import { useDocumentTitle } from '../hooks/useDocumentTitle.ts';
import MyTickets from '../features/tickets/components/MyTickets.tsx';

export default function MyTicketsPage() {
  useDocumentTitle('Mes billets');
  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Mes billets</h1>
        <p className="page-subtitle">
          Présentez le code à l'entrée de l'événement.
        </p>
      </div>
      <MyTickets />
    </div>
  );
}
