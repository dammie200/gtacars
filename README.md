# GTA Online Garage Tracker

Een statische webtool om je GTA Online auto's, garages en wensenlijst lokaal bij te houden. Open `index.html` in je browser en alles wordt opgeslagen in `localStorage`, dus er is geen backend nodig.

## Features
- Overzicht van auto's met filtering op garage en vrije zoekterm.
- Formulier om nieuwe auto's toe te voegen: kies garage/verdieping/plek en typ een model (met suggesties uit eerder gebruikte modellen); merk, type en afbeeldingen worden automatisch opgehaald van GTABase.
- Wensenlijst waarin je alleen het model invult (met dezelfde suggesties); merk en type worden automatisch opgehaald van GTABase.
- Virtuele plattegrond: kies een garage en verdieping en koppel auto's aan parkeerplekken.
- Import/Export: laad een JSON/CSV-bestand (bijv. vanuit Excel) of exporteer je huidige data naar JSON.
- Voorbeelddata: knop om snel met sample garages te starten.
- Suggestielijst voor garages (onthoudt eerder ingevoerde namen) en een model-datalist gevuld uit je eigen data; bij het typen zoekt de tool live op GTABase en vult merk, type en afbeeldingen in.
- Alle afbeeldingen hebben inline placeholders als GTABase niets oplevert of niet bereikbaar is, zodat er geen kapotte links verschijnen.

## CSV-structuur
Gebruik de volgende kolomnamen voor CSV-import: `garage,floor,slot,brand,model,class,tags,logo,image,notes`.

## Ontwikkelen
Er is geen build-stap; open `index.html` direct in de browser of start een simpele webserver:

```bash
python -m http.server 8000
```
