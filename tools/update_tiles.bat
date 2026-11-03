@echo off
rem update_tiles.bat — rafraichissement quotidien du cache de tuiles MyNavApp.
rem A planifier une fois par jour (voir README, section Offline charts) :
rem   schtasks /Create /TN "MyNavApp tiles" /TR "C:\chemin\vers\MyNavApp\tools\update_tiles.bat" /SC DAILY /ST 08:00
rem Comportement : exit 0 silencieux si deja fait aujourd'hui ou si hors ligne ;
rem les tuiles recentes (< 30 jours) sont ignorees sans requete reseau ;
rem plafond de 45 minutes par run, reprise automatique au run suivant ;
rem delai 1 s par tuile (politique d'usage OSM) ; en cas de blocage serveur
rem 403/429 : arret immediat (exit 3) et le marqueur du jour n'est PAS pose.
cd /d "%~dp0.."
py -3 tools\download_tiles.py --zones config\tile_zones.json --once-a-day --refresh-days 30 --max-minutes 45
