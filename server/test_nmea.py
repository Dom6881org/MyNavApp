import unittest

from server.nmea import parse_nmea_sentence


def sentence(payload: str) -> str:
    checksum = 0
    for character in payload:
        checksum ^= ord(character)
    return f"${payload}*{checksum:02X}"


class NmeaParserTests(unittest.TestCase):
    def test_parses_active_rmc_position_speed_course_and_timestamp(self) -> None:
        result = parse_nmea_sentence(sentence(
            "GPRMC,123519,A,4807.038,N,01131.000,E,022.4,084.4,230394,003.1,W"
        ))
        self.assertIsNotNone(result)
        assert result is not None
        self.assertAlmostEqual(result["position"]["latitude"], 48.1173)
        self.assertAlmostEqual(result["position"]["longitude"], 11.516666666666667)
        self.assertEqual(result["speed"]["sog"], 22.4)
        self.assertAlmostEqual(result["compass"]["cog"], 84.4)
        self.assertEqual(result["gpsTime"]["utcTime"], "12:35:19")
        self.assertIn("23/03/1994", result["gpsTime"]["date"])

    def test_parses_heading_and_depth(self) -> None:
        heading = parse_nmea_sentence(sentence("GPHDT,123.4,T"))
        depth = parse_nmea_sentence(sentence("SDDPT,3.5,0.5"))
        self.assertAlmostEqual(heading["compass"]["heading"], 123.4)
        self.assertEqual(depth["depth"]["depth"], 3.5)

    def test_parses_relative_apparent_wind_and_converts_units(self) -> None:
        wind = parse_nmea_sentence(sentence("WIMWV,045,R,10.2,M,A"))
        self.assertEqual(wind["apparentWind"]["angleDegrees"], 45)
        self.assertAlmostEqual(wind["apparentWind"]["speedKnots"], 19.828, delta=0.001)
        self.assertIsNone(parse_nmea_sentence(sentence("WIMWV,045,T,10.2,N,A")))
        self.assertIsNone(parse_nmea_sentence(sentence("WIMWV,045,R,10.2,N,V")))

    def test_normalizes_degrees_and_rejects_invalid_sentences(self) -> None:
        wrapped = parse_nmea_sentence(sentence("GPVTG,361.0,T,,M,5.0,N,,K"))
        inactive = parse_nmea_sentence(sentence(
            "GPRMC,123519,V,4807.038,N,01131.000,E,022.4,084.4,230394,003.1,W"
        ))
        malformed = parse_nmea_sentence(sentence("GPGGA,123519,9160.000,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,"))
        self.assertEqual(wrapped["compass"]["cog"], 1)
        self.assertIsNone(parse_nmea_sentence("$GPHDT,123.4,T*00"))
        self.assertIsNone(inactive)
        self.assertIsNone(malformed)
        self.assertIsNone(parse_nmea_sentence(sentence("GPGSA,A,3,,,,,,,,,,,,,1.8,1.0,1.5")))


if __name__ == "__main__":
    unittest.main()
