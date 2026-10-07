// The logo can weigh 512 KB: it is never loaded with the other fields, `hasLogo` tells whether to fetch it
export const omitLogo = { logo: true } as const;

/** Public fields of an organization, as sent in lists and on events. */
export const toPublic = <T extends { logoContentType: string | null }>({
  logoContentType,
  ...organization
}: T) => ({ ...organization, hasLogo: logoContentType !== null });
