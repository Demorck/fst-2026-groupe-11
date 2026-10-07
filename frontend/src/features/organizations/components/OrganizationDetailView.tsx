import { useCallback, useEffect, useState } from 'react';
import type { ChangeEvent, SyntheticEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import TextField from '../../../components/TextField.tsx';
import { useSubmit } from '../../auth/hooks/useSubmit.ts';
import { useAuth } from '../../auth/useAuth.ts';
import {
  cancelInvitation,
  getOrganization,
  inviteMember,
  leaveOrganization,
  removeMember,
  uploadLogo,
} from '../api.ts';
import { translate } from '../messages.ts';
import { ROLE_LABELS, STATUS_LABELS } from '../types.ts';
import type { OrganizationDetail } from '../types.ts';
import AuditLog from './AuditLog.tsx';
import ConfirmButton from './ConfirmButton.tsx';
import MemberHours from './MemberHours.tsx';
import OrganizationLogo from './OrganizationLogo.tsx';

const LOGO_MAX_BYTES = 512 * 1024;

function InviteForm({
  organizationId,
  onInvited,
}: {
  organizationId: string;
  onInvited: () => Promise<void>;
}) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const { submit, pending, error } = useSubmit(async () => {
    setSent(false);
    await inviteMember(organizationId, email.trim());
    setSent(true);
    setEmail('');
    await onInvited();
  });

  function onSubmit(event: SyntheticEvent) {
    event.preventDefault();
    void submit();
  }

  return (
    <form onSubmit={onSubmit} className="max-w-xl space-y-3">
      <h2 className="text-xl font-semibold">Inviter</h2>
      <p className="text-sm text-gray-600">
        La personne doit avoir un compte bénévole ou organisateur et accepter
        l'invitation dans les 7 jours.
      </p>
      <TextField
        label="E-mail"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      {error && (
        <p role="alert" className="text-red-600">
          {translate(error)}
        </p>
      )}
      {sent && (
        <p role="status" className="text-green-700">
          Si cette adresse correspond à un compte bénévole ou organisateur, une
          invitation a été envoyée.
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-60"
      >
        {pending ? 'Envoi...' : 'Inviter'}
      </button>
    </form>
  );
}

/** Management of one organization: members, hours and, for its managers, logo, invitations and journal. */
export default function OrganizationDetailView({
  organizationId,
}: {
  organizationId: string;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [organization, setOrganization] = useState<OrganizationDetail | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // Bumped after each change so that the journal reloads
  const [changes, setChanges] = useState(0);

  const load = useCallback(
    () =>
      getOrganization(organizationId)
        .then(setOrganization)
        .catch((err: Error) => setError(translate(err.message))),
    [organizationId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function run(
    action: () => Promise<unknown>,
    after?: () => Promise<void>,
  ) {
    setActionError(null);
    try {
      await action();
      await (after ?? load)();
      setChanges((n) => n + 1);
    } catch (err) {
      setActionError(translate((err as Error).message));
    }
  }

  async function onLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setLogoError(null);
    if (file.size > LOGO_MAX_BYTES) {
      setLogoError('Le logo ne doit pas dépasser 512 Ko.');
      return;
    }
    try {
      await uploadLogo(organizationId, file);
      await load();
    } catch (err) {
      setLogoError(translate((err as Error).message));
    }
  }

  if (error) {
    return (
      <p role="alert" className="text-red-600">
        {error}
      </p>
    );
  }
  if (!organization) return <p>Chargement...</p>;

  const manager = organization.role === 'MANAGER';
  const iAmCreator = organization.members.some(
    (m) => m.user.id === user?.id && m.isCreator,
  );
  const hasCoManagers = organization.members.some(
    (m) =>
      m.role === 'MANAGER' && m.status === 'ACCEPTED' && m.user.id !== user?.id,
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-5">
        <OrganizationLogo
          organization={organization}
          className="size-24 text-3xl"
        />
        <div className="space-y-1">
          <h1 className="text-4xl font-bold">{organization.name}</h1>
          {organization.description && (
            <p className="text-gray-600">{organization.description}</p>
          )}
          <p className="text-sm text-gray-600">
            Votre rôle : {ROLE_LABELS[organization.role].toLowerCase()}
          </p>
          <p className="flex flex-wrap items-center gap-4 text-sm">
            <Link
              to={`/organizations/${organization.id}`}
              className="text-indigo-700 underline"
            >
              Voir la page publique
            </Link>
            {iAmCreator && hasCoManagers ? (
              <span className="text-gray-600">
                Retirez les co-gestionnaires pour pouvoir quitter l'organisation
              </span>
            ) : (
              <ConfirmButton
                label="Quitter l'organisation"
                question="Quitter cette organisation ?"
                onConfirm={() =>
                  run(
                    () => leaveOrganization(organizationId),
                    async () => {
                      await navigate('/organizations');
                    },
                  )
                }
              />
            )}
          </p>
        </div>
      </div>

      {actionError && (
        <p role="alert" className="text-red-600">
          {actionError}
        </p>
      )}

      {manager && (
        <section className="max-w-xl space-y-2">
          <label className="block space-y-1">
            <span className="text-sm font-medium">
              Logo (PNG, JPEG ou WebP, 512 Ko maximum)
            </span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => void onLogo(e)}
              className="block w-full text-sm"
            />
          </label>
          {logoError && (
            <p role="alert" className="text-red-600">
              {logoError}
            </p>
          )}
        </section>
      )}

      <section aria-labelledby="members" className="space-y-3">
        <h2 id="members" className="text-xl font-semibold">
          Membres
        </h2>
        <ul className="space-y-2">
          {organization.members.map(
            ({ id, role, status, expired, isCreator, user: member }) => (
              <li
                key={id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-3"
              >
                <span className="flex-1">
                  <span className="font-medium">{member.name}</span>
                  {member.email && (
                    <span className="ml-2 text-sm text-gray-600">
                      {member.email}
                    </span>
                  )}
                </span>
                <span className="text-sm">{ROLE_LABELS[role]}</span>
                {status !== 'ACCEPTED' && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                    {expired ? 'Invitation expirée' : STATUS_LABELS[status]}
                  </span>
                )}
                {manager &&
                  status === 'ACCEPTED' &&
                  member.id !== user?.id &&
                  !isCreator &&
                  (role !== 'MANAGER' || iAmCreator) && (
                    <ConfirmButton
                      label="Retirer"
                      ariaLabel={`Retirer ${member.name}`}
                      question={`Retirer ${member.name} ?`}
                      onConfirm={() =>
                        run(() => removeMember(organizationId, id))
                      }
                    />
                  )}
                {manager && status === 'PENDING' && (
                  <ConfirmButton
                    label="Annuler l'invitation"
                    ariaLabel={`Annuler l'invitation de ${member.name}`}
                    question="Annuler l'invitation ?"
                    onConfirm={() =>
                      run(() => cancelInvitation(organizationId, id))
                    }
                  />
                )}
              </li>
            ),
          )}
        </ul>
      </section>

      <MemberHours organizationId={organizationId} />

      {manager && (
        <InviteForm
          organizationId={organizationId}
          onInvited={async () => {
            await load();
            setChanges((n) => n + 1);
          }}
        />
      )}
      {manager && (
        <AuditLog organizationId={organizationId} refreshKey={changes} />
      )}
    </div>
  );
}
