import BrandMark from '../../../components/BrandMark.tsx';
import type { ReactNode } from 'react';

const POINTS = [
  ['Réservez votre place', 'Un billet gratuit avec son code, en deux clics.'],
  [
    'Aidez vos associations',
    'Inscrivez-vous sur les créneaux bénévoles des événements de vos organisations.',
  ],
  [
    'Organisez sans tableur',
    'Événements, bénévoles, check-in et suivi au même endroit.',
  ],
] as const;

/** Sign-in and sign-up frame: what G-Event does on the left (from lg up), the form on the right. */
export default function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto grid max-w-5xl overflow-hidden rounded-2xl border border-line bg-white lg:grid-cols-[1fr_minmax(0,30rem)]">
      <aside className="hidden flex-col justify-between gap-10 bg-brand p-10 text-white lg:flex">
        <p className="flex items-center gap-3 font-display text-3xl font-bold">
          <BrandMark className="size-9" />
          G-Event
        </p>
        <ul className="space-y-6">
          {POINTS.map(([heading, text]) => (
            <li key={heading}>
              <p className="font-display text-xl font-semibold">{heading}</p>
              <p className="text-white/80">{text}</p>
            </li>
          ))}
        </ul>
        <p className="text-sm text-white/70">
          Pour les associations étudiantes et leurs bénévoles.
        </p>
      </aside>
      <div className="space-y-6 p-6 sm:p-10">
        <div>
          <h1 className="page-title">{title}</h1>
          <p className="page-subtitle">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
