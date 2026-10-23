import re
from datetime import datetime, timezone
from typing import Any


def _number(value: str | None) -> float | None:
    if not value:
        return None
    try:
        result = float(value)
    except ValueError:
        return None
    return result if result != float("inf") and result != float("-inf") and result == result else None


def _coordinate(value: str | None, hemisphere: str | None, latitude: bool) -> float | None:
    raw = _number(value)
    if raw is None or not hemisphere:
        return None
    degrees = int(raw // 100)
    minutes = raw - degrees * 100
    maximum = 90 if latitude else 180
    if minutes >= 60 or degrees > maximum or (degrees == maximum and minutes > 0):
        return None
    if (latitude and hemisphere not in ("N", "S")) or (not latitude and hemisphere not in ("E", "W")):
        return None
    result = degrees + minutes / 60
    return -result if hemisphere in ("S", "W") else result


def _gps_time(value: str | None, date_value: str | None = None) -> dict[str, str] | None:
    if not value or not re.fullmatch(r"\d{6}(?:\.\d+)?", value):
        return None
    hours, minutes, seconds = int(value[:2]), int(value[2:4]), int(value[4:6])
    if hours > 23 or minutes > 59 or seconds > 59:
        return None

    utc_moment = datetime.now(timezone.utc)
    if date_value and re.fullmatch(r"\d{6}", date_value):
        day, month, short_year = int(date_value[:2]), int(date_value[2:4]), int(date_value[4:6])
        year = short_year + (1900 if short_year >= 80 else 2000)
        try:
            utc_moment = utc_moment.replace(year=year, month=month, day=day)
        except ValueError:
            pass
    utc_moment = utc_moment.replace(hour=hours, minute=minutes, second=seconds, microsecond=0)
    moment = utc_moment.astimezone()
    return {
        "utcTime": utc_moment.strftime("%H:%M:%S"),
        "localTime": moment.strftime("%H:%M:%S"),
        "date": moment.strftime("%d/%m/%Y"),
    }


def _valid_checksum(sentence: str) -> bool:
    star = sentence.rfind("*")
    if star == -1:
        return sentence.startswith("$")
    if not sentence.startswith("$") or star != len(sentence) - 3:
        return False
    try:
        expected = int(sentence[star + 1 :], 16)
    except ValueError:
        return False
    checksum = 0
    for character in sentence[1:star]:
        checksum ^= ord(character)
    return checksum == expected


def _speed(sog: float | None) -> dict[str, float | None]:
    return {"speed": sog, "sog": sog, "stw": None, "maxSpeed": sog, "averageSpeed": sog}


def _normalize_degrees(degrees: float) -> float:
    return (degrees % 360 + 360) % 360


def parse_nmea_sentence(input_sentence: str) -> dict[str, Any] | None:
    sentence = input_sentence.strip()
    if not _valid_checksum(sentence):
        return None
    fields = sentence[1 : sentence.find("*") if "*" in sentence else None].split(",")
    kind = fields[0][-3:] if fields and fields[0] else ""
    if not kind:
        return None

    if kind == "RMC":
        if len(fields) <= 9 or fields[2] != "A":
            return None
        latitude = _coordinate(fields[3], fields[4], True)
        longitude = _coordinate(fields[5], fields[6], False)
        if latitude is None or longitude is None:
            return None
        sog, cog = _number(fields[7]), _number(fields[8])
        update: dict[str, Any] = {
            "position": {"latitude": latitude, "longitude": longitude},
            "speed": _speed(sog),
            "compass": {
                "heading": None,
                "cog": None if cog is None else _normalize_degrees(cog),
                "magneticHeading": None,
                "deviation": 0,
            },
        }
        gps_time = _gps_time(fields[1], fields[9])
        if gps_time:
            update["gpsTime"] = gps_time
        return update

    if kind == "GGA":
        if len(fields) <= 6 or (_number(fields[6]) or 0) <= 0:
            return None
        latitude = _coordinate(fields[2], fields[3], True)
        longitude = _coordinate(fields[4], fields[5], False)
        if latitude is None or longitude is None:
            return None
        update = {"position": {"latitude": latitude, "longitude": longitude}}
        gps_time = _gps_time(fields[1])
        if gps_time:
            update["gpsTime"] = gps_time
        return update

    if kind == "VTG":
        if len(fields) <= 5:
            return None
        cog, sog = _number(fields[1]), _number(fields[5])
        update = {}
        if sog is not None:
            update["speed"] = _speed(sog)
        if cog is not None:
            update["compass"] = {
                "heading": None,
                "cog": _normalize_degrees(cog),
                "magneticHeading": None,
                "deviation": 0,
            }
        return update or None

    if kind == "HDT":
        heading = _number(fields[1] if len(fields) > 1 else None)
        return None if heading is None else {
            "compass": {
                "heading": _normalize_degrees(heading),
                "cog": None,
                "magneticHeading": None,
                "deviation": 0,
            }
        }

    if kind == "HDG":
        heading = _number(fields[1] if len(fields) > 1 else None)
        if heading is None:
            return None
        deviation = _number(fields[2] if len(fields) > 2 else None)
        direction = fields[3] if len(fields) > 3 else ""
        return {
            "compass": {
                "heading": _normalize_degrees(heading),
                "cog": None,
                "magneticHeading": _normalize_degrees(heading),
                "deviation": (deviation or 0) * (-1 if direction == "W" else 1),
            }
        }

    if kind in ("DPT", "DBT"):
        index = 1 if kind == "DPT" else 3
        depth = _number(fields[index] if len(fields) > index else None)
        if depth is None or depth < 0:
            return None
        return {"depth": {"depth": depth, "temperature": 0, "alarm": False, "alarmDepth": 0}}

    if kind == "MWV":
        if len(fields) <= 5 or fields[2] != "R" or fields[5] != "A":
            return None
        angle, speed = _number(fields[1]), _number(fields[3])
        if angle is None or speed is None or speed < 0:
            return None
        unit = fields[4]
        speed_knots = speed if unit == "N" else speed * 3600 / 1852 if unit == "M" else speed / 1.852 if unit == "K" else None
        if speed_knots is None:
            return None
        return {"apparentWind": {"angleDegrees": _normalize_degrees(angle), "speedKnots": speed_knots}}

    return None
