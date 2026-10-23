import math
import time
from typing import Any

from pyais import decode
from pyais.exceptions import AISBaseException


class LocalAISDecoder:
    def __init__(self) -> None:
        self._fragments: dict[tuple[str, str], dict[str, Any]] = {}

    def decode_line(self, line: str) -> dict[str, Any] | None:
        if not line.startswith(("!AIVDM,", "!AIVDO,")):
            return None
        fields = line.split("*", 1)[0].split(",")
        if len(fields) < 7:
            return None
        try:
            total = int(fields[1])
            fragment_number = int(fields[2])
        except ValueError:
            return None
        if total < 1 or total > 9 or fragment_number < 1 or fragment_number > total:
            return None
        sequence_id, channel = fields[3], fields[4]
        key = (sequence_id, channel) if sequence_id else ("", channel)
        if fragment_number == 1:
            self._fragments[key] = {"total": total, "parts": {1: line}, "receivedAt": time.monotonic()}
        else:
            pending = self._fragments.get(key)
            if pending is None or pending["total"] != total:
                return None
            pending["parts"][fragment_number] = line
        pending = self._fragments.get(key)
        self._expire_fragments()
        if pending is None or len(pending["parts"]) != total:
            return None
        self._fragments.pop(key, None)
        try:
            message = decode(*(pending["parts"][index] for index in range(1, total + 1)),
                             error_if_checksum_invalid=True).asdict()
        except (AISBaseException, ValueError, TypeError, KeyError):
            return None
        return _target_update(message, "local")

    def _expire_fragments(self) -> None:
        timeout = time.monotonic() - 15
        self._fragments = {
            key: value for key, value in self._fragments.items()
            if value["receivedAt"] >= timeout
        }


def parse_internet_message(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict) or value.get("MessageType") not in (
        "PositionReport",
        "StandardClassBPositionReport",
        "ExtendedClassBPositionReport",
        "LongRangeAisBroadcastMessage",
        "ShipStaticData",
        "StaticDataReport",
    ):
        return None
    metadata = value.get("MetaData")
    message = value.get("Message")
    if not isinstance(metadata, dict) or not isinstance(message, dict):
        return None
    payload = message.get(value["MessageType"])
    if not isinstance(payload, dict):
        return None
    if payload.get("Valid") is False:
        return None
    merged = {**metadata, **payload}
    update = _target_update(merged, "internet")
    if update is None:
        return None
    if value["MessageType"] not in ("ShipStaticData", "StaticDataReport") and "latitude" not in update:
        return None
    return update


def _target_update(message: dict[str, Any], source: str) -> dict[str, Any] | None:
    mmsi = message.get("mmsi", message.get("MMSI", message.get("UserID")))
    if mmsi is None:
        return None
    mmsi = str(mmsi)
    if len(mmsi) != 9 or not mmsi.isdecimal():
        return None
    position = message.get("lat", message.get("Latitude"))
    longitude = message.get("lon", message.get("Longitude"))
    if not _valid_coordinate(position, -90, 90) or not _valid_coordinate(longitude, -180, 180):
        position = longitude = None
    sog = _finite_number(message.get("sog", message.get("Sog", message.get("speed"))))
    if sog is not None and not 0 <= sog < 102.3:
        sog = None
    cog = _finite_number(message.get("cog", message.get("Cog", message.get("course"))))
    if cog is not None and not 0 <= cog < 360:
        cog = None
    heading = _finite_number(message.get("heading", message.get("TrueHeading")))
    status = _finite_number(message.get("status", message.get("NavigationalStatus")))
    name = message.get("shipname") or message.get("ShipName") or message.get("Name")
    if isinstance(name, str):
        name = name.strip().rstrip("@").strip() or None
    else:
        name = None
    update = {
        "mmsi": mmsi,
        "updatedAt": int(time.time() * 1000),
        "source": source,
    }
    if name:
        update["name"] = name
    if position is not None and longitude is not None:
        update["latitude"] = float(position)
        update["longitude"] = float(longitude)
    for key, field in (
        ("sog", sog),
        ("cog", cog),
        ("heading", heading if heading is not None and heading < 360 else None),
        ("navigationalStatus", status),
    ):
        if field is not None:
            update[key] = field
    return update


def _valid_coordinate(value: Any, minimum: float, maximum: float) -> bool:
    number = _finite_number(value)
    return number is not None and minimum <= number <= maximum


def _finite_number(value: Any) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        return None
    return float(value)
