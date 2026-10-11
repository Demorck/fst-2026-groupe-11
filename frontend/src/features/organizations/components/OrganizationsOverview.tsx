import { useCallback, useEffect, useState } from 'react';
import type { SyntheticEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import TextField from '../../../components/TextField.tsx';
import { useSubmit } from '../../auth/hooks/useSubmit.ts';
import { alertDialog, toast } from '../../../components/dialogs.ts';
import { useAuth } from '../../auth/useAuth.ts';
import {
  answerInvitation,
  createOrganization,
  getInvitations,
  getMyOrganizations,
  leaveOrganization,
  uploadLogo,
} from '../api.ts';
import { translate } from '../messages.ts';
import { refreshPendingInvitations } from '../pendingInvitations.ts';
import { ROLE_LABELS } from '../types.ts';
import type { Invitation, MyOrganization } from '../types.ts';
import ConfirmButton from '../../../components/ConfirmButton.tsx';
import LogoPicker from './LogoPicker.tsx';
import OrganizationLogo from './OrganizationLogo.tsx';

function CreateOrganizationForm() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [logo, setLogo] = useState<File | null>(null);
  const { submit, pending, error } = useSubmit(async () => {
    const organization = await createOrganization({
      name: name.trim(),
      description: description.trim() || undefined,
    });
    if (logo) {
      try {
        await uploadLogo(organization.id, logo);
      } catch (err) {
        // The organization exists: do not block, the logo can be sent again from its page
        void alertDialog({
          title: 'Logo refusé',
          message: translate((err as Error).message),
        });
      }
    }
    await navigate(`/organizations/${organization.id}/manage`);
  });

  function onSubmit(event: SyntheticEvent) {
    event.preventDefault();
    void submit();
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-4 p-6">
      <h2 className="text-xl font-semibold">Créer une organisation</h2>
      <TextField
        label="Nom"
        required
        maxLength={80}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <TextField
        label="Description (facultatif)"
        maxLength={500}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <LogoPicker
        current={
          <OrganizationLogo
            organization={{
              id: '',
              name: name.trim() || 'Organisation',
              description: null,
              hasLogo: false,
              updatedAt: '',
            }}
            className="size-16 text-lg"
          />
        }
        file={logo}
        onPick={setLogo}
      />
      {error && (
        <p role="alert" className="alert-error">
          {translate(error)}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary text-sm"
      >
        {pending ? 'Création...' : "Créer l'organisation"}
      </button>
    </form>
  );
}

/** Invitations to answer, organizations I belong to and, for an organizer, the creation form. */
export default function OrganizationsOverview() {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<MyOrganization[] | null>(
    null,
  );
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      Promise.all([getMyOrganizations(), getInvitations()])
        .then(([mine, pending]) => {
          setOrganizations(mine);
          setInvitations(pending);
        })
        .catch((err: Error) => setError(translate(err.message))),
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function answer(id: string, choice: 'accept' | 'decline') {
    try {
      await answerInvitation(id, choice);
      await Promise.all([load(), refreshPendingInvitations()]);
      toast(
        choice === 'accept' ? 'Invitation acceptée.' : 'Invitation refusée.',
      );
    } catch (err) {
      void alertDialog({ message: translate((err as Error).message) });
    }
  }

  async function leave(id: string) {
    try {
      await leaveOrganization(id);
      await load();
      toast("Vous avez quitté l'organisation.");
    } catch (err) {
      void alertDialog({ message: translate((err as Error).message) });
    }
  }

  const organizer = user?.role === 'ORGANIZER';

  return (
    <div
      className={`grid items-start gap-8 ${organizer ? 'lg:grid-cols-[minmax(0,1fr)_340px]' : ''}`}
    >
      <div className="min-w-0 space-y-8">
        {error && (
          <p role="alert" className="alert-error">
            {error}
          </p>
        )}

        {invitations.length > 0 && (
          <section aria-labelledby="invitations" className="space-y-3">
            <h2 id="invitations" className="text-xl font-semibold">
              Invitations
            </h2>
            <ul className="space-y-3">
              {invitations.map(({ id, role, organization }) => (
                <li
                  key={id}
                  className="flex flex-col gap-3 rounded-xl border border-brand-edge bg-brand-tint/50 p-4 sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <OrganizationLogo organization={organization} />
                    <span className="min-w-0">
                      <strong>{organization.name}</strong> vous invite comme{' '}
                      {ROLE_LABELS[role].toLowerCase()}.
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void answer(id, 'accept')}
                      aria-label={`Accepter l'invitation de ${organization.name}`}
                      className="btn btn-primary btn-sm flex-1 sm:flex-none"
                    >
                      Accepter
                    </button>
                    <button
                      type="button"
                      onClick={() => void answer(id, 'decline')}
                      aria-label={`Refuser l'invitation de ${organization.name}`}
                      className="btn btn-secondary btn-sm flex-1 sm:flex-none"
                    >
                      Refuser
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="mine" className="space-y-3">
          <h2 id="mine" className="text-xl font-semibold">
            Vos organisations
          </h2>
          {!organizations && !error && (
            <div aria-busy="true" className="grid gap-4 sm:grid-cols-2">
              <p className="sr-only">Chargement...</p>
              <div className="skeleton h-40" />
              <div className="skeleton h-40" />
            </div>
          )}
          {organizations?.length === 0 && (
            <div className="card space-y-3 p-6">
              <p className="font-semibold">
                Vous n'appartenez à aucune organisation pour l'instant.
              </p>
              <p className="text-muted">
                {organizer
                  ? 'Créez la vôtre pour pouvoir organiser des événements.'
                  : 'Demandez à un gestionnaire de vous envoyer une invitation : elle apparaîtra ici.'}
              </p>
              {!organizer && (
                <Link to="/" className="btn btn-secondary btn-sm">
                  Voir les événements
                </Link>
              )}
            </div>
          )}
          <ul
            className={`grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 ${organizer ? '' : 'xl:grid-cols-3'}`}
          >
            {organizations?.map((organization) => (
              <li
                key={organization.id}
                className="card flex min-w-0 flex-col gap-3"
              >
                <div className="flex items-center gap-3">
                  <OrganizationLogo
                    organization={organization}
                    className="size-12 text-base"
                  />
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/organizations/${organization.id}/manage`}
                      className="block truncate font-semibold text-ink"
                    >
                      {organization.name}
                    </Link>
                    <span
                      className={`badge ${organization.role === 'MANAGER' ? 'badge-brand' : ''}`}
                    >
                      {ROLE_LABELS[organization.role]}
                    </span>
                  </div>
                </div>
                {organization.description && (
                  <p className="line-clamp-2 text-sm text-muted">
                    {organization.description}
                  </p>
                )}
                <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
                  <Link
                    to={`/organizations/${organization.id}`}
                    className="inline-flex min-h-11 items-center text-sm font-semibold"
                  >
                    Page publique
                  </Link>
                  <ConfirmButton
                    label="Quitter"
                    ariaLabel={`Quitter ${organization.name}`}
                    question="Quitter cette organisation ?"
                    details="Vos créneaux à venir sur ses événements seront retirés ; vos heures passées restent."
                    onConfirm={() => leave(organization.id)}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {organizer && (
        <aside className="lg:sticky lg:top-24">
          <CreateOrganizationForm />
        </aside>
      )}
    </div>
  );
}
