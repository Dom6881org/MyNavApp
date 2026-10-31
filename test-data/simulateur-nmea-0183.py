#!/usr/bin/env python3
"""
nmea_simulator.py — Simulateur NMEA 0183 pour tester MyNavApp (ou OpenCPN, qtVlm...).

Deux modes :
  1) --trace trace.gpx      : rejoue une trace GPX (export Navionics, etc.).
     Les positions sont interpolées ; COG/SOG calculés entre points consécutifs.
     Si le GPX contient des <time>, la vitesse réelle est respectée (sauf --time-scale).
     Sinon, la vitesse --speed est appliquée le long de la route.
  2) sans --trace          : génère une route synthétique (ligne droite)
     au départ de --start, cap --heading, vitesse --speed.

Données synthétisés en plus de la position :
  - COG / SOG (calculés depuis la trace, ou constants en mode synthétique)
  - Heading (suivi du COG, avec inertie optionnelle --heading-lag)
  - Vent vrai (TWD/TWS configurables, variations sinusoïdales optionnelles)
  - Vent apparent (AWA/AWS déduit du vent vrai et du mouvement du bateau)
  - Profondeur (--depth, avec bruit optionnel)

Sortie : phrases NMEA 0183 valides (checksum XOR) émises à 1 Hz :
  GPRMC, GPGGA, GPGLL, IIHDT, IIVHW, IIVTG, WIMWV (vent vrai), WIMWV (vent apparent), SDDPT, SDDBT

Transports :
  - serveur TCP (par défaut 127.0.0.1:2947, plusieurs clients possibles)
  - et/ou broadcast UDP (ex: --udp 10110 --udp-host 192.168.1.255)

Exemples :
  # Rejouer une trace Navionics à vitesse réelle x5 :
  python nmea_simulator.py --trace sortie_navionics.gpx --time-scale 5 --wind-dir 315 --wind-speed 18 --depth 25

  # Route synthétique cap 270, 6.5 nds :
  python nmea_simulator.py --start 47.5,-4.5 --heading 270 --speed 6.5 \
      --wind-dir 40 --wind-speed 14 --depth 30 --hours 4

Dépendances : aucune (stdlib uniquement). Python 3.8+.
"""

import argparse
import math
import re
import socket
import sys
import threading
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone

# ---------------------------------------------------------------------------
# Géométrie sphérique (formules classiques)
# ---------------------------------------------------------------------------

R_EARTH_NM = 3440.065  # rayon terrestre en milles nautiques


def norm180(a):
    """Normalise un angle dans [-180, 180)."""
    return (a + 180.0) % 360.0 - 180.0


def norm360(a):
    """Normalise un angle dans [0, 360)."""
    return a % 360.0


def dist_nm(lat1, lon1, lat2, lon2):
    """Distance en milles nautiques (haversine)."""
    la1, lo1, la2, lo2 = map(math.radians, (lat1, lon1, lat2, lon2))
    dla, dlo = la2 - la1, lo2 - lo1
    a = math.sin(dla / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin(dlo / 2) ** 2
    return 2 * R_EARTH_NM * math.asin(math.sqrt(a))


def bearing(lat1, lon1, lat2, lon2):
    """Cap initial (degrés vrais) de (lat1,lon1) vers (lat2,lon2)."""
    la1, lo1, la2, lo2 = map(math.radians, (lat1, lon1, lat2, lon2))
    dlo = lo2 - lo1
    y = math.sin(dlo) * math.cos(la2)
    x = math.cos(la1) * math.sin(la2) - math.sin(la1) * math.cos(la2) * math.cos(dlo)
    return norm360(math.degrees(math.atan2(y, x)))


def move(lat, lon, heading_deg, dist_nm):
    """Point d'arrivée depuis (lat, lon) au cap heading_deg pendant dist_nm milles."""
    la, lo, br = map(math.radians, (lat, lon, heading_deg))
    dr = dist_nm / R_EARTH_NM
    la2 = math.asin(math.sin(la) * math.cos(dr) + math.cos(la) * math.sin(dr) * math.cos(br))
    lo2 = lo + math.atan2(math.sin(br) * math.sin(dr) * math.cos(la),
                          math.cos(dr) - math.sin(la) * math.sin(la2))
    return math.degrees(la2), norm180(math.degrees(lo2))


# ---------------------------------------------------------------------------
# Traces
# ---------------------------------------------------------------------------

def load_gpx(path):
    """Retourne [(lat, lon, datetime|None), ...] dans l'ordre du fichier GPX."""
    tree = ET.parse(path)
    root = tree.getroot()
    ns = ""
    if root.tag.startswith("{"):
        ns = root.tag.split("}", 1)[0] + "}"
    pts = []
    for trkpt in root.iter(ns + "trkpt"):
        lat_s = trkpt.get("lat")
        lon_s = trkpt.get("lon")
        if lat_s is None or lon_s is None:
            continue
        try:
            lat = float(lat_s)
            lon = float(lon_s)
        except ValueError:
            continue
        ts = None
        time_el = trkpt.find(ns + "time")
        if time_el is not None and time_el.text:
            try:
                ts = datetime.fromisoformat(
                    time_el.text.strip().replace("Z", "+00:00"))
                if ts.tzinfo is None:
                    ts = ts.replace(tzinfo=timezone.utc)
            except ValueError:
                ts = None
        pts.append((lat, lon, ts))
    if len(pts) < 2:
        sys.exit("Erreur : moins de 2 points valides dans le GPX.")
    return pts


def load_csv(path):
    """CSV accepté : lat,lon[,ISO-time] par ligne (séparateur , ou ; ou tab)."""
    pts = []
    with open(path, encoding="utf-8-sig") as f:
        for line in f:
            line = line.strip()
            if not line or re.match(r"^\s*(lat|latitude)", line, re.I):
                continue
            parts = re.split(r"[,;\t]", line)
            if len(parts) < 2:
                continue
            try:
                lat = float(parts[0].replace(",", "."))
                lon = float(parts[1].replace(",", "."))
            except ValueError:
                continue
            ts = None
            if len(parts) >= 3:
                try:
                    ts = datetime.fromisoformat(
                        parts[2].strip().replace("Z", "+00:00"))
                    if ts.tzinfo is None:
                        ts = ts.replace(tzinfo=timezone.utc)
                except ValueError:
                    ts = None
            pts.append((lat, lon, ts))
    if len(pts) < 2:
        sys.exit("Erreur : moins de 2 points valides dans le CSV.")
    return pts


class Track:
    """Trace interpolable : position, COG et SOG à un instant t (secondes simulées)."""

    def __init__(self, points, speed_knots=None, time_scale=1.0, loop=False):
        self.loop = loop
        self.time_scale = time_scale
        segs = []
        cum = 0.0
        for (la1, lo1, t1), (la2, lo2, t2) in zip(points, points[1:]):
            d = dist_nm(la1, lo1, la2, lo2)
            if t1 is not None and t2 is not None:
                seg_seconds = max((t2 - t1).total_seconds(), 0.1)
            else:
                seg_seconds = d / max(speed_knots or 1.0, 0.1) * 3600.0 if d > 1e-9 else 1.0
            segs.append(dict(la1=la1, lo1=lo1, la2=la2, lo2=lo2,
                             nm=d, brg=bearing(la1, lo1, la2, lo2), secs=seg_seconds))
            cum += d
        self.segs = segs
        self.total_nm = cum
        self.total_seconds = sum(s["secs"] for s in segs)

    def _interp(self, elapsed):
        """Position/COG/SOG à elapsed secondes (temps simulé)."""
        if self.loop:
            elapsed = elapsed % max(self.total_seconds, 0.1)
        t = 0.0
        for i, s in enumerate(self.segs):
            last = (i == len(self.segs) - 1)
            if elapsed <= t + s["secs"] or last:
                frac = min(max((elapsed - t) / s["secs"], 0.0), 1.0)
                d = s["nm"] * frac
                if s["nm"] > 1e-9:
                    lat, lon = move(s["la1"], s["lo1"], s["brg"], d)
                else:
                    lat, lon = s["la1"], s["lo1"]
                cog = s["brg"]
                sog = s["nm"] / (s["secs"] / 3600.0) if s["nm"] > 1e-9 else 0.0
                return lat, lon, cog, sog
            t += s["secs"]
        s = self.segs[-1]
        return s["la2"], s["lo2"], s["brg"], 0.0

    def position_at(self, sim_seconds):
        return self._interp(sim_seconds * self.time_scale)


class SyntheticRoute:
    """Route synthétique : cap et vitesse constants."""

    def __init__(self, start_lat, start_lon, heading, speed_knots):
        self.lat = start_lat
        self.lon = start_lon
        self.heading = heading
        self.speed = speed_knots

    def position_at(self, sim_seconds):
        d = self.speed * (sim_seconds / 3600.0)
        self.lat, self.lon = move(self.lat, self.lon, self.heading, d)
        return self.lat, self.lon, self.heading, self.speed


# ---------------------------------------------------------------------------
# Phrases NMEA
# ---------------------------------------------------------------------------

def nmea_checksum(body):
    ck = 0
    for ch in body.encode("ascii"):
        ck ^= ch
    return "%02X" % ck


def fmt(body):
    return "$%s*%s\r\n" % (body, nmea_checksum(body))


def lat_nmea(lat):
    h = "N" if lat >= 0 else "S"
    lat = abs(lat)
    d = int(lat)
    m = (lat - d) * 60.0
    return "%02d%08.5f,%s" % (d, m, h)


def lon_nmea(lon):
    h = "E" if lon >= 0 else "W"
    lon = abs(lon)
    d = int(lon)
    m = (lon - d) * 60.0
    return "%03d%08.5f,%s" % (d, m, h)


def s_rmc(dt, lat, lon, sog, cog):
    return fmt("GPRMC,%s,A,%s,%s,%.1f,%.1f,%s,,," % (
        dt.strftime("%H%M%S"), lat_nmea(lat), lon_nmea(lon), sog, cog,
        dt.strftime("%d%m%y")))


def s_gga(dt, lat, lon):
    return fmt("GPGGA,%s,%s,%s,1,08,0.8,0.0,M,47.0,M,," % (
        dt.strftime("%H%M%S"), lat_nmea(lat), lon_nmea(lon)))


def s_gll(dt, lat, lon):
    return fmt("GPGLL,%s,%s,%s,A" % (lat_nmea(lat), lon_nmea(lon), dt.strftime("%H%M%S")))


def s_hdt(heading):
    return fmt("IIHDT,%.1f,T" % heading)


def s_vhw(heading, water_speed):
    return fmt("IIVHW,%.1f,T,%.1f,M,%.1f,N,%.1f,K" % (
        heading, heading, water_speed, water_speed * 1.852))


def s_vtg(cog, sog):
    return fmt("IIVTG,%.1f,T,%.1f,M,%.1f,N,%.1f,K" % (cog, cog, sog, sog * 1.852))


def s_mwv_true(twd_deg, tws):
    # NMEA 0183 : le drapeau 'T' signifie "relatif au nord vrai" -> TWD absolu.
    return fmt("WIMWV,%.1f,T,%.1f,N,A" % (norm360(twd_deg), tws))


def s_mwv_apparent(awa, aws):
    return fmt("WIMWV,%.1f,R,%.1f,N,A" % (norm360(awa), aws))


def s_dpt(depth, offset=0.0):
    return fmt("SDDPT,%.1f,%.1f" % (depth, offset))


def s_dbt(depth):
    return fmt("SDDBT,%.1f,f,%.1f,M,%.1f,F" % (depth * 3.28084, depth, depth * 0.546807))


# ---------------------------------------------------------------------------
# Physique du vent (vrai -> apparent)
# ---------------------------------------------------------------------------

def true_to_apparent(heading, sog_knots, twd_deg, tws_knots):
    """AWA (relatif au cap, 0-360) et AWS (nds) à partir du vent vrai et du mouvement.

    Vent apparent relatif = vecteur vent vrai - vecteur vitesse du bateau.
    """
    to_rad = math.radians
    v_wind_x = tws_knots * math.sin(to_rad(twd_deg + 180.0))
    v_wind_y = tws_knots * math.cos(to_rad(twd_deg + 180.0))
    v_boat_x = sog_knots * math.sin(to_rad(heading))
    v_boat_y = sog_knots * math.cos(to_rad(heading))
    ax = v_wind_x - v_boat_x
    ay = v_wind_y - v_boat_y
    aws = math.hypot(ax, ay)
    if aws < 1e-9:
        return 0.0, 0.0
    from_dir = norm360(math.degrees(math.atan2(ax, ay)) + 180.0)
    awa = norm360(from_dir - heading)
    return awa, aws


# ---------------------------------------------------------------------------
# Sortie TCP / UDP
# ---------------------------------------------------------------------------

class Broadcaster:
    """Serveur TCP multi-clients + broadcast UDP optionnel."""

    def __init__(self, tcp_host, tcp_port, udp_host=None, udp_port=None):
        self.lock = threading.Lock()
        self.clients = []
        self.udp = None
        self.udp_addr = None
        if tcp_port:
            self.srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self.srv.bind((tcp_host, tcp_port))
            self.srv.listen(5)
            threading.Thread(target=self._accept_loop, daemon=True).start()
        if udp_port:
            self.udp = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            self.udp.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
            self.udp_addr = (udp_host or "255.255.255.255", udp_port)

    def _accept_loop(self):
        while True:
            try:
                conn, addr = self.srv.accept()
                with self.lock:
                    self.clients.append(conn)
                print("[TCP] client connecté : %s:%d" % addr)
            except OSError:
                return

    def send(self, text):
        data = text.encode("ascii")
        with self.lock:
            dead = []
            for c in self.clients:
                try:
                    c.sendall(data)
                except OSError:
                    dead.append(c)
            for c in dead:
                try:
                    c.close()
                except OSError:
                    pass
                self.clients.remove(c)
        if self.udp and self.udp_addr:
            try:
                self.udp.sendto(data, self.udp_addr)
            except OSError:
                pass


# ---------------------------------------------------------------------------
# Boucle principale
# ---------------------------------------------------------------------------

def parse_args():
    p = argparse.ArgumentParser(
        description="Simulateur NMEA 0183 : rejoue une trace ou génère une route, "
                    "synthétise cap/vent/profondeur, émet sur TCP/UDP à 1 Hz.")
    p.add_argument("--trace", help="fichier GPX ou CSV (lat,lon[,time]) à rejouer")
    p.add_argument("--start", help="position de départ en mode synthétique : 'lat,lon' (ex: 47.5,-4.5)")
    p.add_argument("--heading", type=float, default=270.0, help="cap initial/constant (deg)")
    p.add_argument("--speed", type=float, default=6.0, help="vitesse en nds (si la trace n'a pas de timestamps)")
    p.add_argument("--time-scale", type=float, default=1.0, help="accélère le rejeu (ex: 5 = x5)")
    p.add_argument("--loop", action="store_true", help="rejoue la trace en boucle")
    p.add_argument("--hours", type=float, default=None, help="durée de simulation en heures (défaut : 2h)")
    p.add_argument("--wind-dir", type=float, default=315.0, help="direction du vent VRAI (deg, d'où il vient)")
    p.add_argument("--wind-speed", type=float, default=15.0, help="vitesse du vent vrai (nds)")
    p.add_argument("--wind-gust", type=float, default=0.0, help="variation sinusoïdale du TWS ± nds")
    p.add_argument("--wind-shift", type=float, default=0.0, help="variation sinusoïdale du TWD ± deg")
    p.add_argument("--depth", type=float, default=25.0, help="profondeur sous la quille (m)")
    p.add_argument("--depth-noise", type=float, default=0.0, help="bruit sur la profondeur ± m")
    p.add_argument("--heading-lag", action="store_true",
                   help="le cap suit le COG avec inertie (plus réaliste)")
    p.add_argument("--host", default="127.0.0.1", help="adresse d'écoute TCP (défaut : 127.0.0.1)")
    p.add_argument("--port", type=int, default=2947, help="port TCP (0 = désactivé, défaut : 2947)")
    p.add_argument("--udp", type=int, default=0, help="port de broadcast UDP (0 = désactivé)")
    p.add_argument("--udp-host", default=None, help="adresse de broadcast UDP (défaut : 255.255.255.255)")
    p.add_argument("--raw", action="store_true", help="affiche les phrases NMEA brutes dans la console")
    return p.parse_args()


def main():
    args = parse_args()

    # --- Source de mouvement
    if args.trace:
        if args.trace.lower().endswith(".gpx"):
            points = load_gpx(args.trace)
        else:
            points = load_csv(args.trace)
        has_time = points[0][2] is not None
        route = Track(points, speed_knots=args.speed,
                      time_scale=args.time_scale, loop=args.loop)
        kind = "trace GPX" if args.trace.lower().endswith(".gpx") else "trace CSV"
        print("[OK] %s : %d points, %.2f milles, durée %.1f h%s" % (
            kind, len(points), route.total_nm, route.total_seconds / 3600.0,
            (" (x%.1f)" % args.time_scale) if has_time and args.time_scale != 1 else ""))
        print("[OK] %s" % ("timestamps détectés -> vitesses réelles respectées"
                           if has_time else "pas de timestamps -> vitesse fixe %.1f nds" % args.speed))
    else:
        if not args.start:
            sys.exit("Donne soit --trace <fichier>, soit --start 'lat,lon' pour le mode synthétique.")
        try:
            lat_s, lon_s = args.start.split(",")
            start_lat, start_lon = float(lat_s), float(lon_s)
        except (ValueError, AttributeError):
            sys.exit("--start doit être au format 'lat,lon' (ex: 47.5,-4.5)")
        route = SyntheticRoute(start_lat, start_lon, args.heading, args.speed)
        print("[OK] route synthétique depuis %.5f,%.5f au cap %.0f à %.1f nds" % (
            start_lat, start_lon, args.heading, args.speed))

    total_hours = args.hours if args.hours is not None else 2.0
    tx = Broadcaster(args.host, args.port, args.udp_host, args.udp)
    if args.port:
        print("[OK] serveur TCP en écoute sur %s:%d" % (args.host, args.port))
    if args.udp:
        print("[OK] broadcast UDP sur %s:%d" % (args.udp_host or "255.255.255.255", args.udp))

    # --- État
    sim_secs = 0.0
    heading = args.heading
    dt0 = datetime.now(timezone.utc)
    prng_state = 12345  # petit PRNG déterministe pour le bruit

    def rand_pm1():
        nonlocal prng_state
        prng_state = (1103515245 * prng_state + 12345) % (2 ** 31)
        return (prng_state / 2 ** 30) - 1.0

    print("[i] Ctrl-C pour arrêter. Durée de simulation : %.1f h." % total_hours)

    try:
        while sim_secs / 3600.0 < total_hours:
            tick = time.time()

            lat, lon, cog, sog = route.position_at(sim_secs)

            # Cap : suit le COG (avec inertie optionnelle)
            if args.heading_lag:
                if sog > 0.3:
                    heading = norm360(heading + norm180(cog - heading) * 0.08)
            else:
                if sog > 0.3:
                    heading = cog

            # Vent vrai (variations sinusoïdales optionnelles)
            twd = norm360(args.wind_dir + args.wind_shift * math.sin(sim_secs / 240.0))
            tws = max(0.0, args.wind_speed + args.wind_gust * math.sin(sim_secs / 90.0))
            # Vent apparent déduit du mouvement
            awa, aws = true_to_apparent(heading, sog, twd, tws)

            # Profondeur (bruit optionnel)
            depth = max(0.0, args.depth + (args.depth_noise * rand_pm1() if args.depth_noise else 0.0))

            dt = dt0 + timedelta(seconds=sim_secs)

            burst = (
                s_rmc(dt, lat, lon, sog, cog) +
                s_gga(dt, lat, lon) +
                s_gll(dt, lat, lon) +
                s_hdt(heading) +
                s_vhw(heading, sog) +
                s_vtg(cog, sog) +
                s_mwv_true(twd, tws) +
                s_mwv_apparent(awa, aws) +
                s_dpt(depth) +
                s_dbt(depth)
            )
            tx.send(burst)

            if args.raw:
                sys.stdout.write(burst)
                sys.stdout.flush()
            else:
                print("\r[%s] lat %.5f lon %.5f | cap %5.1f COG %5.1f | SOG %.1f nds | "
                      "vent %3.0f°/%.0f nds (appr %3.0f°/%.0f) | prof %.1f m   " % (
                          dt.strftime("%H:%M:%S"), lat, lon, heading, cog, sog,
                          twd, tws, awa, aws, depth), end="", flush=True)

            sim_secs += 1.0
            delay = 1.0 - (time.time() - tick)
            if delay > 0:
                time.sleep(delay)
    except KeyboardInterrupt:
        print("\n[stop] interrompu.")

    print("[i] Fin de simulation (%.1f h écoulées)." % (sim_secs / 3600.0))


if __name__ == "__main__":
    main()