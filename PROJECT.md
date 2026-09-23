## G-Event
* Pour qui : Les associations étudiantes et leurs bénévoles (avec, en périphérie, les participants qui réservent une place)
* Problème : Les associations gèrent aujourd'hui leurs événements avec différents outils, pas de vue centralisée sur les bénévoles et la rédaction de la communication (description, posts) est refaite manuellement à chaque événement.
* Parcours :
  1. L'organisateur crée un événement (infos, capacité, créneaux bénévoles nécessaires)
  2. Les participants consultent la liste des événements et réservent un billet (code unique affiché)
  3. Les bénévoles s'inscrivent sur les créneaux disponibles
  4. Le jour J, l'organisateur fait le check-in des participants (recherche + validation manuelle)
  5. L'organisateur consulte le dashboard de suivi (inscriptions, remplissage, couverture bénévoles)

* Données :
  - Comptes utilisateurs (rôles : organisateur, bénévole, participant)
  - Événements (titre, dité, catégorie)
  - Billets / inscriptions
  - Créneaux bénévoles et affectations
  - Historique des inscriptions passées (sert de base à la prédiction IA)

* Brique IA :
  - Prédiction d'affluence à la création d'un événement, à partir de l'historique des événements similaires (catégorie, saison, capacité)
  - Génération automatique de communication (description marketing, post réseau social) à partir des infos de l'événement, éditable avant publication

* Stack : TypeScript - React (Vite) - NestJS (API REST) - PostgreSQL + Prisma

* Hors périmètre :
  - Paiement en ligne réel (billetterie gratuite/simulée)
  - Scan QR par caméra (check-in manuel uniquement)
  - Application mobile native
  - Notifications email/push réelles (mock si besoin en démo)
  - Multi-organisation avec facturation/abonnement
