# G-Event — Frontend

React + Vite + TypeScript, Tailwind CSS, React Router.

## Démarrage

```bash
npm install
npm run dev   # http://localhost:5173
```

En dev, les appels vers `/api` sont proxifiés vers le backend (`http://localhost:3000`), qui doit donc tourner.

## Structure

```
src/
├── main.tsx       point d'entrée (RouterProvider)
├── router.tsx     déclaration des routes
├── api/           client HTTP (apiFetch)
├── layouts/       layout commun (navigation + Outlet)
├── pages/         une page par route
├── components/    composants UI partagés
└── features/      composants, hooks et types par domaine
    ├── events/      événements
    ├── tickets/     billets et check-in
    ├── volunteers/  créneaux bénévoles
    ├── dashboard/   suivi
    └── ai/          prédiction d'affluence, génération de communication
```

## Routes

| Route | Page |
| --- | --- |
| `/` | Liste des événements |
| `/login` | Connexion |
| `/events/new` | Création d'un événement |
| `/events/:eventId` | Détail et réservation |
| `/events/:eventId/shifts` | Créneaux bénévoles |
| `/events/:eventId/checkin` | Check-in |
| `/dashboard` | Dashboard de suivi |
