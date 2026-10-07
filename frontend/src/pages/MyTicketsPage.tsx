import MyTickets from '../features/tickets/components/MyTickets.tsx';

export default function MyTicketsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Mes billets</h1>
      <MyTickets />
    </div>
  );
}
