# fst-2026-groupe-11

Groupe: 11:
* Membre 1 : ANTOINE Maximilien
* Membre 2 : BASUALDO Lautaro
* Membre 3 : COLLIN Alex

---

4. Plateforme de gestion d'événements étudiants/associatifs

Concept : outil pour créer et gérer des événements (soirées, conférences, tournois asso) avec billetterie simple et gestion des bénévoles.

Fonctionnalités cœur (non-IA)
- Création d'événement (date, lieu, capacité, description, tarifs)
- Billetterie interne (réservation, QR code d'entrée, liste des inscrits)
- Gestion des bénévoles (créneaux, affectation, pointage)
- Planning logistique (checklist, matériel, budget simple)

Feature IA
- Prédiction d'affluence : à partir des events passés (type d'event, jour, saison, historique d'inscriptions) → estime le nombre de participants probable, alerte si sur/sous-booking.
- Génération de communication : à partir des infos de l'event, génère automatiquement une description marketing, un post réseaux social, une affiche texte (titre + accroche), avec régénération/variantes.
- (optionnel) Assistant de planning bénévoles : suggère une affectation des bénévoles selon dispo/préférences déclarées.

Modèle de données : Event(date, location, capacity), Ticket(status, type), Volunteer, Shift, RegistrationHistory (pour entraîner/nourrir la prédiction).

Stack suggérée : React/Vue + API REST ou GraphQL (Node/NestJS ou FastAPI), Postgres, un job/cron pour le digest hebdo, appel LLM (OpenAI/Claude API) isolé dans un service ai-insights séparé du reste — bon pour montrer une archi propre en soutenance + un module data léger pour la prédiction (peut être un simple modèle de régression scikit-learn entraîné sur données synthétiques/historiques, pas besoin de deep learning) + appel LLM pour la génération de texte marketing.

Point fort pour le jury : mélange joliment IA "classique" (prédiction, ML léger) et IA générative (LLM pour le texte) — montre une palette de compétences plus large qu'un simple wrapper GPT.
