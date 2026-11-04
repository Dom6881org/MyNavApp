#!/usr/bin/env python3
"""Feeder NMEA pour la CI visuelle (captures d'écran Playwright).

Envoie en boucle des phrases NMEA 0183 valides (checksums corrects) en UDP
vers le serveur MyNavApp, pour que les instruments affichent des données
réalistes au moment des captures :

  position 42°30'N 003°06'E, SOG 5.0 kn, COG 137°, HDG 132°,
  profondeur 24.6 m, vent vrai 320°/12 kn, vent apparent 315°/14 kn.

Utilisation : python tools/visual_feed.py [port] (défaut NMEA_UDP_PORT ou 10111).
Stdlib uniquement — aucun paquet tiers.
"""

import os
import socket
import time
from typing import List


def checksum(payload: str) -> str:
    value = 0
    for char in payload:
        value ^= ord(char)
    return f"{value:02X}"


def sentence(payload: str) -> str:
    return f"${payload}*{checksum(payload)}\r\n"


def build_sentences() -> List[str]:
    # RMC : position + SOG + COG + date/heure GPS
    rmc = sentence(
        "GPRMC,120000.00,A,4230.000,N,00306.000,E,5.0,137.0,041126,,,A"
    )
    # GGA : position + fix
    gga = sentence("GPGGA,120000.00,4230.0000,N,00306.0000,E,1,08,0.9,0.0,M,0.0,M,,")
    # VTG : COG + SOG
    vtg = sentence("GPVTG,137.0,T,,M,5.0,N,9.26,K,A")
    # HDT : cap compas
    hdt = sentence("HCHDT,132.0,T")
    # DBT : profondeur en mètres (champ 3, unité M)
    dbt = sentence("SDDBT,80.71,f,24.6,M,,")
    # MWV vent apparent (relatif au bateau) puis vrai
    mwv_app = sentence("IIMWV,315.0,R,14.0,N,A")
    mwv_true = sentence("IIMWV,320.0,T,12.0,N,A")
    return [rmc, gga, vtg, hdt, dbt, mwv_app, mwv_true]


def main() -> None:
    port = int(os.sys.argv[1]) if len(os.sys.argv) > 1 else int(
        os.environ.get("NMEA_UDP_PORT", "10111")
    )
    sentences = build_sentences()
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    target = ("127.0.0.1", port)
    print(f"visual_feed: envoi NMEA vers {target} toutes les 1 s", flush=True)
    while True:
        for s in sentences:
            sock.sendto(s.encode("ascii"), target)
        time.sleep(1.0)


if __name__ == "__main__":
    main()
