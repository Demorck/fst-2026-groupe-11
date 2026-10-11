import { useEffect } from 'react';

const APP = 'G-Event';

/** Names the browser tab after the page: "Mes billets · G-Event". */
export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · ${APP}` : APP;
    return () => {
      document.title = APP;
    };
  }, [title]);
}
