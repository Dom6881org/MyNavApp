# test-data/

Outils et données locales pour tester MyNavApp.

## Simulateur NMEA 0183

`simulateur-nmea-0183.py` génère des phrases NMEA 0183 valides (GPRMC, GPGGA, GPGLL, IIHDT, IIVHW, IIVTG, WIMWV, SDDPT, SDDBT) pour tester l'application sans matériel — ou alimenter OpenCPN, qtVlm...

Deux modes :

- `--trace trace.gpx` : rejoue une trace GPX (positions interpolées, COG/SOG calculés entre points, vitesse réelle respectée sauf `--time-scale`) ;
- sans `--trace` : route synthétique (ligne droite) à partir de `--start`, `--heading`, `--speed`.

Données synthétisées : position, COG/SOG, heading (avec inertie optionnelle `--heading-lag`), vent vrai et apparent (TWD/TWS, AWA/AWS), profondeur avec bruit optionnel.

Transports : serveur TCP (défaut `127.0.0.1:2947`) et/ou broadcast UDP (`--udp 10111 --udp-host 192.168.1.255` pour alimenter le backend MyNavApp, cf. `NMEA_UDP_PORT`).

Exemples :

```
# Route synthétique cap 270 à 6.5 nds, vent du 40° à 14 nds :
python test-data/simulateur-nmea-0183.py --start 47.5,-4.5 --heading 270 --speed 6.5 \
  --wind-dir 40 --wind-speed 14 --depth 30 --hours 4

# Rejouer une trace GPX à vitesse réelle x5, vers le backend MyNavApp :
python test-data/simulateur-nmea-0183.py --trace test-data/ma-trace.gpx --time-scale 5 --udp 10111
```

Dépendances : aucune (stdlib Python 3.8+).

## Traces personnelles

Les fichiers de traces personnels (`*.gpx`, `*.geojson`, `navionics-track.json`) ne sont **pas** versionnés — voir `.gitignore`. Déposez-les dans ce dossier pour les rejouer avec `--trace`.
