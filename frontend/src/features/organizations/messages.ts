// The API answers in English, the interface speaks French
const MESSAGES: Record<string, string> = {
  'Organization name already used': 'Ce nom d’organisation est déjà utilisé.',
  'Already a member': 'Cette personne est déjà membre.',
  'Already invited': 'Cette personne a déjà une invitation en attente.',
  'No account with this email': 'Aucun compte ne correspond à cet e-mail.',
  'Participants cannot join an organization':
    'Les participants ne peuvent pas rejoindre une organisation.',
  'Invitation already answered': 'Cette invitation a déjà reçu une réponse.',
  'Invitation not found': 'Invitation introuvable.',
  'Not a manager of this organization':
    'Seuls les gestionnaires peuvent faire cela.',
  'Not a member of this organization':
    'Vous n’êtes pas membre de cette organisation.',
  'Organization not found': 'Organisation introuvable.',
  'Invitation expired': 'Cette invitation a expiré (7 jours).',
  'Last manager of the organization':
    'Vous êtes le dernier gestionnaire : nommez-en un autre avant de partir.',
  'Not a pending invitation': 'Cette invitation n’est plus en attente.',
  'Member not found': 'Membre introuvable.',
  'Use leave to quit an organization':
    'Pour partir, utilisez « Quitter l’organisation ».',
  'Logo must be a PNG, JPEG or WebP image':
    'Le logo doit être une image PNG, JPEG ou WebP.',
};

export const translate = (message: string) => MESSAGES[message] ?? message;
