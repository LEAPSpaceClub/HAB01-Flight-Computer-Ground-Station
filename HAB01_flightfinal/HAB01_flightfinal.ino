/*
  ===========================================================================
   HAB01 — Arduino Nano Standalone Flight Computer / Sensor Payload
   (GPS removed — LoRa E32-433T30D provides the live downlink; SD card
    remains the full-resolution flight record)

   LoRa now runs on SoftwareSerial (D2/D3), NOT the hardware UART (D0/D1).
   Hardware Serial (D0/D1, i.e. the USB port) is free again for bench
   debugging over Tera Term — it no longer carries raw binary telemetry
   bytes, which is what caused garbled text after the boot lines when both
   were sharing one port. The whole project (this sketch's USB debug link,
   the E32<->E32 air link, and the Uno ground station's USB link) now uses
   ONE consistent baud rate: PROJECT_BAUD (9600), defined below.

   TX ACTIVITY INDICATOR:
     An LED on TX_LED_PIN toggles every time a telemetry frame is
     successfully handed to the E32 (LoRa_WaitReady() returned true and
     the frame has been written to its UART), giving a visible heartbeat
     that data is actually going out over the air — not just attempted.
     If the module's AUX pin never reports "ready" in time, the frame is
     skipped and the LED is NOT toggled, so a stuck link is visible on
     the bench without needing a receiver.

   *** PIN SWAP (this revision) ***
     GPS moved to SoftwareSerial on D2/D3.
     LoRa E32 moved to the Nano's HARDWARE UART, D0/D1 (the same pins the
     USB-Serial bridge uses).

     This reintroduces the exact conflict the earlier revision of this
     sketch deliberately avoided: D0/D1 cannot carry both the LoRa link
     and human-readable USB debug text at the same time. Two consequences:
       1) Programming the Nano now requires the E32 to be physically
          disconnected from D0/D1 first (standard Arduino Nano behavior
          any time something else is wired to the hardware UART).
       2) Serial.print() calls would inject garbage bytes into the binary
          telemetry stream Serial.write() sends to the E32 — or corrupt
          the frame outright — because they'd share the same wire.
          DebugPrintLine() is therefore compiled out unless DEBUG_ENABLED
          is set to 1 below, and it must ONLY be enabled with the E32
          disconnected from D0/D1 for bench sensor testing.
     GPS altitude now also serves as a fallback altitude source if the
     BMP180 disables itself mid-flight (see BMP180 altitude self-check
     below) — the earlier "no GPS fallback in this configuration" caveat
     no longer applies now that GPS is back.
  ===========================================================================
  Sensors:
    - BMP180    (I2C)          temperature + pressure + derived altitude
    - AHT10     (I2C)          temperature + humidity + dew point
    - MPU6050   (I2C)          accelerometer + gyroscope (no on-chip temp used)
    - DS18B20 x2 (OneWire)     one INSIDE the payload box, one OUTSIDE
    - GUVA-S12SD (analog)      UV index
    - Battery voltage          (analog, resistor divider)
    - SD card module (SPI)     full-resolution CSV logging (local record)
    - LoRa E32-433T30D (hardware UART, D0/D1) live compact binary telemetry downlink
    - GPS module (SoftwareSerial, D2/D3) NMEA-based lat/lon/altitude/speed/fix

  Derived / computed values:
    - Barometric altitude (AGL, referenced to ground pressure at boot)
    - BMP180 altitude self-check: if it becomes physically implausible for
      several cycles in a row, altitude output is disabled for the rest of
      the flight (temperature/pressure keep working; only derived altitude
      stops being trusted). Once disabled, GPS altitude (if a valid, fresh
      fix is available) takes over as the altitude source automatically.
    - Acceleration magnitude (vector sum of MPU6050 accel axes)
    - Temperature gradient (rate of change of outside temp, C/s)
    - Inside/outside temperature difference
    - Dew point (from AHT10 temp + humidity, Magnus-Tetens formula)
    - Flight phase state machine (PRELAUNCH/ASCENT/NEAR_APOGEE/DESCENT/LANDED)
    - Maximum altitude reached
    - Sensor health bitmask
    - TX success/skip status (new — see LoRa telemetry section)

  Libraries required (Library Manager):
    - OneWire        (Paul Stoffregen)
    - SD, SPI, Wire, SoftwareSerial (bundled with Arduino IDE)

  ===========================================================================
   WIRING
  ===========================================================================
  I2C bus (shared by BMP180, AHT10, MPU6050):
    SDA  -> Nano A4
    SCL  -> Nano A5
    VCC  -> 5V, GND -> GND

  DS18B20 #1 — INSIDE the payload box:
    DATA -> Nano D4  (+ 4.7k pull-up resistor from D4 to 5V)
    VCC  -> 5V, GND -> GND

  DS18B20 #2 — OUTSIDE, exposed to ambient air:
    DATA -> Nano D5  (+ 4.7k pull-up resistor from D5 to 5V)
    VCC  -> 5V, GND -> GND

  GUVA-S12SD (UV sensor, analog):
    OUT  -> Nano A0
    VCC  -> 5V, GND -> GND

  Battery voltage sense (resistor divider — never wire a battery straight
  into an analog pin):
    Battery+ -> R1 (100k) -> Nano A1 -> R2 (47k) -> GND
    (Sized for up to ~15.6V / 3S LiPo. Adjust BATTERY_R1_OHM/BATTERY_R2_OHM
     below if your battery is different.)

  LoRa E32-433T30D (now on the HARDWARE UART — D0/D1 — shared with USB):
    E32 TX  -> Nano D0 / RX0
    E32 RX  -> Nano D1 / TX0  -- add a voltage divider (e.g. 10k+20k) if
               your module's RX pin is rated strictly 3.3V; most E32 TTL
               pins tolerate 5V, but check your module.
    M0      -> GND   (tied low, together with M1, selects Mode 0 —
    M1      -> GND    Normal / transparent transmission — no Nano pins
                       or code needed to control operating mode)
    AUX     -> Nano D6  (busy/ready flag: HIGH = idle & safe to send,
                          LOW = module busy — code polls this before every
                          transmission so bytes aren't dropped)
    VCC     -> a supply that can handle this module's TX current spikes
               (several hundred mA at 1W output) — do NOT power it from the
               Nano's 5V pin alone; feed it from the main battery rail with
               a 100–470uF capacitor right at the module's VCC/GND.
    GND     -> common GND

    IMPORTANT: because LoRa is back on D0/D1, you MUST physically
    disconnect the E32 from D0/D1 before uploading a new sketch (same as
    disconnecting any device from the hardware UART), and DebugPrintLine()
    is disabled by default (see DEBUG_ENABLED) so bench USB output never
    corrupts the live telemetry stream.

  GPS module (now on SoftwareSerial — D2/D3):
    GPS TX  -> Nano D2  (SoftwareSerial RX)
    GPS RX  -> Nano D3  (SoftwareSerial TX) -- most GPS modules accept 5V
               on RX, but check yours; add a divider if it's 3.3V-only.
    VCC     -> 5V (or 3.3V per your module), GND -> GND
    PPS     -> not used by this sketch (leave unconnected, or wire to a
               spare pin later if you want hardware-timed fix pulses)

    Any u-blox/generic NMEA module outputting standard $..RMC and $..GGA
    sentences at GPS_BAUD (9600 by default) will work as-is.

  SD card module (hardware SPI):
    CS   -> Nano D10
    MOSI -> Nano D11
    MISO -> Nano D12
    SCK  -> Nano D13
    VCC  -> 5V, GND -> GND

  TX activity LED (new):
    LED anode -> 220-330 ohm resistor -> Nano D7
    LED cathode -> GND
    (Any Nano digital pin not already used works; D7 is free in this wiring.)

  Common GND across every module (including the battery divider) is mandatory.

  IMPORTANT CAVEAT FOR HIGH-ALTITUDE BALLOON USE:
    The BMP180 is only rated/accurate roughly 300-1100 hPa (~0-9000 m).
    Above that, or after a shock/vibration event, it can report physically
    impossible altitudes. This sketch guards against that (self-disabling
    altitude, see above) but WITHOUT GPS there is no fallback altitude
    source once it disables — max altitude and flight phase will simply
    stop updating past that point. Retune the thresholds below for your
    own flight profile.
  ===========================================================================
*/

#include <Wire.h>
#include <SPI.h>
#include <SD.h>
#include <OneWire.h>
#include <SoftwareSerial.h>
#include <math.h>

/* ---------------------------- Project-wide baud rate ---------------------
   Every serial link in this project — this sketch's USB debug output, the
   E32<->E32 air link (both ends), and the Uno ground station's USB output —
   uses this same baud rate. Change it in ONE place if you ever need to. */
#define PROJECT_BAUD   9600

/* ---------------------------- Pin definitions ---------------------------- */
#define ONEWIRE_IN_PIN   4   /* DS18B20 inside the box  */
#define ONEWIRE_OUT_PIN  5   /* DS18B20 outside the box */
#define UV_PIN           A0
#define BATTERY_PIN      A1
#define SD_CS_PIN        10
#define GPS_RX_PIN       2   /* Nano RX  <- GPS TX (SoftwareSerial) */
#define GPS_TX_PIN       3   /* Nano TX  -> GPS RX (SoftwareSerial) */
#define LORA_AUX_PIN     6   /* E32 AUX: HIGH = idle/ready, LOW = busy */
#define TX_LED_PIN       7   /* toggles on every successful LoRa transmission */
/* E32 M0/M1 are hard-wired to GND on the module — no Nano pins needed.
   LoRa now uses the hardware UART (D0/D1 = Serial) directly — no LoRa
   RX/TX pin #defines needed, Serial.write()/Serial.begin() are used. */

/* Set to 1 ONLY for bench sensor testing with the E32 physically
   disconnected from D0/D1. With the E32 connected, leave this at 0 —
   Serial.print() output would otherwise corrupt the binary telemetry
   frames sharing the same wire. */
#define DEBUG_ENABLED    0

/* GPS UART baud rate — most NEO-6M/NEO-M8N-class modules default to 9600. */
#define GPS_BAUD              9600
/* If no valid GPS fix has been parsed within this many ms, GPS altitude/
   position are treated as stale and are not used as an altitude source. */
#define GPS_FIX_STALE_MS      5000

/* ---------------------------- I2C addresses ------------------------------ */
#define BMP180_ADDR   0x77
#define AHT10_ADDR    0x38
#define MPU6050_ADDR  0x68

/* BMP180 registers */
#define BMP180_REG_CALIB_START  0xAA
#define BMP180_REG_CONTROL      0xF4
#define BMP180_REG_RESULT       0xF6
#define BMP180_CMD_TEMP         0x2E
#define BMP180_CMD_PRESS_OSS0   0x34

/* AHT10 commands */
#define AHT10_CMD_INIT       0xE1
#define AHT10_CMD_TRIGGER    0xAC

/* MPU6050 registers */
#define MPU6050_REG_PWR_MGMT_1  0x6B
#define MPU6050_REG_ACCEL_XOUT  0x3B
#define MPU6050_REG_GYRO_XOUT   0x43

/* DS18B20 commands */
#define DS18B20_CMD_SKIP_ROM     0xCC
#define DS18B20_CMD_CONVERT_T    0x44
#define DS18B20_CMD_READ_SCRATCH 0xBE

/* UV sensor */
#define UV_ADC_VREF      5.0f
#define UV_ADC_MAXCOUNT  1023.0f

/* Battery voltage divider — CHANGE THESE to match your actual resistors */
#define BATTERY_R1_OHM     100000.0f  /* battery+ side */
#define BATTERY_R2_OHM      47000.0f  /* GND side       */
#define ADC_REF_VOLTAGE         5.0f

/* Flight phase thresholds — TUNE THESE to your expected flight profile */
#define LAUNCH_CLIMB_THRESHOLD   1.0f    /* m/s climb rate to leave PRELAUNCH  */
#define APOGEE_CLIMB_THRESHOLD   0.5f    /* m/s |climb rate| considered "flat" */
#define APOGEE_ALT_WINDOW        50.0f   /* m below max-alt to still call it near-apogee */
#define DESCENT_THRESHOLD       -1.0f    /* m/s climb rate to declare DESCENT  */
#define LANDED_ALT_CHANGE        1.0f    /* m altitude change considered "still" */
#define LANDED_CONFIRM_CYCLES    5        /* consecutive still cycles -> LANDED */

/* BMP180 altitude sanity-check thresholds */
#define BMP_ALT_MIN_M          -500.0f   /* generous margin below sea level */
#define BMP_ALT_MAX_M          12000.0f  /* BMP180 rated to ~9000 m; margin above */
#define BMP_MAX_CLIMB_RATE_MPS   60.0f   /* physically implausible instantaneous rate */
#define BMP_FAIL_STREAK_LIMIT       5     /* consecutive bad readings -> disable BMP alt */

/* LoRa transmission */
#define LORA_UART_BAUD        PROJECT_BAUD   /* must match the E32 module's configured UART baud */
#define LORA_SYNC0            0xAA
#define LORA_SYNC1            0x55
#define LORA_AUX_TIMEOUT_MS     50

/* Flight phase enum */
enum FlightPhase { PRELAUNCH = 0, ASCENT = 1, NEAR_APOGEE = 2, DESCENT = 3, LANDED = 4 };
const char *PHASE_NAMES[5] = { "PRELAUNCH", "ASCENT", "NEAR_APOGEE", "DESCENT", "LANDED" };

/* Altitude source enum */
#define ALT_SRC_NONE 0
#define ALT_SRC_BMP  1
#define ALT_SRC_GPS  2

/* ---------------------------- Globals ------------------------------------ */
OneWire dsIn(ONEWIRE_IN_PIN);
OneWire dsOut(ONEWIRE_OUT_PIN);
SoftwareSerial gpsSerial(GPS_RX_PIN, GPS_TX_PIN);
File logFile;
/* LoRa now talks over the hardware UART directly (Serial.write /
   Serial.begin) — no separate SoftwareSerial object needed for it. */

/* BMP180 calibration coefficients */
int16_t  AC1, AC2, AC3, VB1, VB2, MB, MC, MD;
uint16_t AC4, AC5, AC6;
float groundPressure_Pa = 101325.0f; /* captured at boot, used as AGL reference */

/* Sensor data */
struct { float tempC; long pressPa; float altitude_m; bool altitudeValid; bool ok; } bmp;
struct { float ax_g, ay_g, az_g, gx_dps, gy_dps, gz_dps, accelMag_g; bool ok; } mpu;
struct { float tempC, humPct, dewPointC; bool ok; } aht;
struct { float tempC; bool ok; } dsIn_data;
struct { float tempC; bool ok; } dsOut_data;
struct { float voltage; bool ok; } battery;
float uv_index = 0.0f;

/* GPS data (parsed from $..RMC / $..GGA NMEA sentences) */
struct {
  float lat, lon;           /* decimal degrees, +N/+E */
  float altitude_m;         /* MSL altitude from GGA */
  float speedKmh;
  uint8_t satellites;
  uint8_t fixQuality;       /* GGA fix quality: 0 = no fix */
  bool  fixValid;           /* RMC status == 'A' */
  bool  hasAltitude;        /* a GGA altitude has been parsed at least once */
  bool  ok;                 /* at least one sentence parsed since boot */
  unsigned long lastFixMillis;
} gps;

/* GPS NMEA line accumulator — filled a byte at a time from GPS_Update(),
   called every loop() iteration (not gated by the 2s sensor cycle) so the
   SoftwareSerial RX buffer never overflows between cycles. */
char    gpsLineBuf[96];
uint8_t gpsLineLen = 0;

/* Derived values */
float tempDiff_C        = 0.0f;   /* inside - outside */
float tempGradient_Cps  = 0.0f;   /* outside temp rate of change, C/s */
float maxAltitude_m     = -100000.0f;
uint8_t flightPhase     = PRELAUNCH;
uint8_t sensorHealthMask = 0;

/* Altitude tracking (BMP-only in this configuration) */
uint8_t bmpImplausibleStreak = 0;
bool    bmpAltitudeDisabled  = false;
float   bestAltitude_m       = 0.0f;
uint8_t altitudeSource       = ALT_SRC_NONE;

/* LoRa TX status tracking (new) */
bool          txLedState        = false; /* current LED level, toggled on each successful send */
bool          lastTxSuccess     = false; /* did the most recent cycle actually transmit? */
unsigned long txSuccessCount    = 0;     /* total successful transmissions since boot */
unsigned long txSkipCount       = 0;     /* total skipped (AUX busy/timeout) since boot */

/* Health bitmask positions */
#define HEALTH_BMP180    0
#define HEALTH_MPU6050   1
#define HEALTH_AHT10     2
#define HEALTH_DS_IN     3
#define HEALTH_DS_OUT    4
#define HEALTH_SD_WRITE  5
#define HEALTH_BMP_ALT   6   /* BMP180 altitude currently trusted (not disabled/implausible) */
#define HEALTH_GPS       7   /* GPS has a valid, non-stale fix right now */

/* State tracking for derived calculations */
float   prevAltitude_m   = 0.0f;
float   prevOutsideTemp  = 0.0f;
unsigned long prevTime_ms = 0;
float   climbRate_mps    = 0.0f;
uint8_t landedConfirmCount = 0;
bool    firstCycle        = true;

unsigned long lastCycle = 0;
const unsigned long CYCLE_MS = 2000;

/* =========================================================================
   LoRa E32 compact binary telemetry frame
   ========================================================================= */
#pragma pack(push, 1)
struct TelemetryFrame {
  uint8_t  sync0, sync1;          /* frame sync bytes, let the receiver find frame boundaries */
  uint32_t millis_ms;
  int16_t  bmpTempC_x100;
  int32_t  bmpPress_Pa;
  int16_t  bmpAlt_m_x10;
  uint8_t  bmpFlags;              /* bit0=ok bit1=valid bit2=disabled */
  int16_t  ax_x1000, ay_x1000, az_x1000;
  uint16_t accelMag_x1000;
  int16_t  ahtTempC_x100;
  uint16_t ahtHum_x100;
  int16_t  dewPointC_x100;
  int16_t  dsInC_x100, dsOutC_x100;
  int16_t  tempDiffC_x100;
  int16_t  tempGrad_x1000;
  uint16_t uvIndex_x100;
  uint16_t battery_x100;
  uint8_t  flightPhase;
  int16_t  maxAlt_m_x10;
  uint8_t  healthMask;
  int32_t  gpsLat_x1e6;             /* decimal degrees * 1,000,000 */
  int32_t  gpsLon_x1e6;
  int16_t  gpsAlt_m_x10;
  uint16_t gpsSpeedKmh_x10;
  uint8_t  gpsSatellites;
  uint8_t  gpsFlags;                /* bit0=fixValid bit1=hasAltitude bit2=stale */
  uint8_t  checksum;               /* XOR of every byte between sync and checksum */
};
#pragma pack(pop)
/* sizeof(TelemetryFrame) is now 59 bytes with the GPS fields added. This
   is right at/over some E32 modules' documented ~58-byte practical
   transparent-mode limit — check your specific module's datasheet. If it
   won't take the full frame reliably, trim a field (e.g. drop dew point,
   or send gpsLat/gpsLon at reduced precision) to bring it back under. */

/* =========================================================================
   BMP180
   ========================================================================= */
bool BMP180_ReadCalibration()
{
  Wire.beginTransmission(BMP180_ADDR);
  Wire.write(BMP180_REG_CALIB_START);
  if (Wire.endTransmission(false) != 0) return false;
  Wire.requestFrom(BMP180_ADDR, 22);
  if (Wire.available() < 22) return false;

  uint8_t b[22];
  for (int i = 0; i < 22; i++) b[i] = Wire.read();

  AC1 = (int16_t)((b[0] << 8) | b[1]);
  AC2 = (int16_t)((b[2] << 8) | b[3]);
  AC3 = (int16_t)((b[4] << 8) | b[5]);
  AC4 = (uint16_t)((b[6] << 8) | b[7]);
  AC5 = (uint16_t)((b[8] << 8) | b[9]);
  AC6 = (uint16_t)((b[10] << 8) | b[11]);
  VB1 = (int16_t)((b[12] << 8) | b[13]);
  VB2 = (int16_t)((b[14] << 8) | b[15]);
  MB  = (int16_t)((b[16] << 8) | b[17]);
  MC  = (int16_t)((b[18] << 8) | b[19]);
  MD  = (int16_t)((b[20] << 8) | b[21]);
  return true;
}

bool BMP180_ReadRaw(long *rawTemp, long *rawPress)
{
  Wire.beginTransmission(BMP180_ADDR);
  Wire.write(BMP180_REG_CONTROL);
  Wire.write(BMP180_CMD_TEMP);
  if (Wire.endTransmission() != 0) return false;
  delay(5);

  Wire.beginTransmission(BMP180_ADDR);
  Wire.write(BMP180_REG_RESULT);
  if (Wire.endTransmission(false) != 0) return false;
  Wire.requestFrom(BMP180_ADDR, 2);
  if (Wire.available() < 2) return false;
  *rawTemp = ((long)Wire.read() << 8) | Wire.read();

  Wire.beginTransmission(BMP180_ADDR);
  Wire.write(BMP180_REG_CONTROL);
  Wire.write(BMP180_CMD_PRESS_OSS0);
  if (Wire.endTransmission() != 0) return false;
  delay(5);

  Wire.beginTransmission(BMP180_ADDR);
  Wire.write(BMP180_REG_RESULT);
  if (Wire.endTransmission(false) != 0) return false;
  Wire.requestFrom(BMP180_ADDR, 3);
  if (Wire.available() < 3) return false;
  uint8_t p0 = Wire.read(), p1 = Wire.read(), p2 = Wire.read();
  *rawPress = (((long)p0 << 16) | ((long)p1 << 8) | p2) >> 8;
  return true;
}

bool BMP180_AltitudeInRange(float alt)
{
  return (alt >= BMP_ALT_MIN_M && alt <= BMP_ALT_MAX_M);
}

bool BMP180_ReadData()
{
  long UT, UP, X1, X2, X3, B3, B5, B6, p;
  unsigned long B4, B7;

  if (!BMP180_ReadRaw(&UT, &UP)) { bmp.ok = false; return false; }

  X1 = ((UT - (long)AC6) * (long)AC5) >> 15;
  X2 = ((long)MC << 11) / (X1 + MD);
  B5 = X1 + X2;
  bmp.tempC = ((B5 + 8) >> 4) / 10.0f;

  B6 = B5 - 4000;
  X1 = (VB2 * (B6 * B6 >> 12)) >> 11;
  X2 = (AC2 * B6) >> 11;
  X3 = X1 + X2;
  B3 = ((((long)AC1 * 4 + X3)) + 2) >> 2;
  X1 = (AC3 * B6) >> 13;
  X2 = (VB1 * (B6 * B6 >> 12)) >> 16;
  X3 = ((X1 + X2) + 2) >> 2;
  B4 = (AC4 * (unsigned long)(X3 + 32768)) >> 15;
  B7 = ((unsigned long)UP - B3) * 50000;

  if (B7 < 0x80000000UL) p = (B7 * 2) / B4;
  else p = (B7 / B4) * 2;

  X1 = (p >> 8) * (p >> 8);
  X1 = (X1 * 3038) >> 16;
  X2 = (-7357 * p) >> 16;
  p = p + ((X1 + X2 + 3791) >> 4);

  bmp.pressPa = p;
  bmp.altitude_m = 44330.0f * (1.0f - pow((float)p / groundPressure_Pa, 0.1903f));
  bmp.altitudeValid = BMP180_AltitudeInRange(bmp.altitude_m) && !bmpAltitudeDisabled;
  bmp.ok = true;
  return true;
}

/* =========================================================================
   AHT10
   ========================================================================= */
float ComputeDewPointC(float tempC, float humPct)
{
  const float a = 17.27f;
  const float b = 237.7f;
  if (humPct <= 0.0f) humPct = 0.01f;
  float alpha = ((a * tempC) / (b + tempC)) + log(humPct / 100.0f);
  return (b * alpha) / (a - alpha);
}

bool AHT10_Init()
{
  Wire.beginTransmission(AHT10_ADDR);
  Wire.write(AHT10_CMD_INIT);
  Wire.write((uint8_t)0x08);
  Wire.write((uint8_t)0x00);
  bool ok = (Wire.endTransmission() == 0);
  delay(20);
  return ok;
}

bool AHT10_ReadData()
{
  Wire.beginTransmission(AHT10_ADDR);
  Wire.write(AHT10_CMD_TRIGGER);
  Wire.write((uint8_t)0x33);
  Wire.write((uint8_t)0x00);
  if (Wire.endTransmission() != 0) { aht.ok = false; return false; }

  delay(80);
  Wire.requestFrom(AHT10_ADDR, 6);
  if (Wire.available() < 6) { aht.ok = false; return false; }

  uint8_t d[6];
  for (int i = 0; i < 6; i++) d[i] = Wire.read();

  uint32_t rawHum  = ((uint32_t)d[1] << 12) | ((uint32_t)d[2] << 4) | (d[3] >> 4);
  uint32_t rawTemp = ((uint32_t)(d[3] & 0x0F) << 16) | ((uint32_t)d[4] << 8) | d[5];

  aht.humPct = ((float)rawHum / 1048576.0f) * 100.0f;
  aht.tempC  = ((float)rawTemp / 1048576.0f) * 200.0f - 50.0f;
  aht.dewPointC = ComputeDewPointC(aht.tempC, aht.humPct);
  aht.ok = true;
  return true;
}

/* =========================================================================
   MPU6050  (accel + gyro only)
   ========================================================================= */
bool MPU6050_Init()
{
  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(MPU6050_REG_PWR_MGMT_1);
  Wire.write((uint8_t)0x00);
  return (Wire.endTransmission() == 0);
}

bool MPU6050_ReadData()
{
  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(MPU6050_REG_ACCEL_XOUT);
  if (Wire.endTransmission(false) != 0) { mpu.ok = false; return false; }
  Wire.requestFrom(MPU6050_ADDR, 6);
  if (Wire.available() < 6) { mpu.ok = false; return false; }
  int16_t rawAX = (Wire.read() << 8) | Wire.read();
  int16_t rawAY = (Wire.read() << 8) | Wire.read();
  int16_t rawAZ = (Wire.read() << 8) | Wire.read();

  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(MPU6050_REG_GYRO_XOUT);
  if (Wire.endTransmission(false) != 0) { mpu.ok = false; return false; }
  Wire.requestFrom(MPU6050_ADDR, 6);
  if (Wire.available() < 6) { mpu.ok = false; return false; }
  int16_t rawGX = (Wire.read() << 8) | Wire.read();
  int16_t rawGY = (Wire.read() << 8) | Wire.read();
  int16_t rawGZ = (Wire.read() << 8) | Wire.read();

  mpu.ax_g   = rawAX / 16384.0f;
  mpu.ay_g   = rawAY / 16384.0f;
  mpu.az_g   = rawAZ / 16384.0f;
  mpu.gx_dps = rawGX / 131.0f;
  mpu.gy_dps = rawGY / 131.0f;
  mpu.gz_dps = rawGZ / 131.0f;
  mpu.accelMag_g = sqrt(mpu.ax_g * mpu.ax_g + mpu.ay_g * mpu.ay_g + mpu.az_g * mpu.az_g);
  mpu.ok = true;
  return true;
}

/* =========================================================================
   DS18B20
   ========================================================================= */
bool DS18B20_ReadTemperature(OneWire &bus, float *tempC)
{
  if (!bus.reset()) return false;
  bus.skip();
  bus.write(DS18B20_CMD_CONVERT_T);
  delay(750);

  if (!bus.reset()) return false;
  bus.skip();
  bus.write(DS18B20_CMD_READ_SCRATCH);

  uint8_t lsb = bus.read();
  uint8_t msb = bus.read();
  int16_t raw = (int16_t)((msb << 8) | lsb);
  *tempC = (float)raw / 16.0f;
  return true;
}

/* =========================================================================
   UV sensor
   ========================================================================= */
float ADC_ReadUVIndex()
{
  int adcVal = analogRead(UV_PIN);
  float voltage = (adcVal / UV_ADC_MAXCOUNT) * UV_ADC_VREF;
  return voltage / 0.1f;
}

/* =========================================================================
   Battery voltage
   ========================================================================= */
void Battery_Read()
{
  int raw = analogRead(BATTERY_PIN);
  float vAtPin = (raw / 1023.0f) * ADC_REF_VOLTAGE;
  battery.voltage = vAtPin * ((BATTERY_R1_OHM + BATTERY_R2_OHM) / BATTERY_R2_OHM);
  battery.ok = true;
}

/* =========================================================================
   GPS (NMEA over SoftwareSerial)
   ========================================================================= */
/* ddmm.mmmm / dddmm.mmmm -> decimal degrees. Works for both lat and lon:
   dividing by 100 always splits off the last two integer digits as the
   minutes portion regardless of whether the degree part is 2 or 3 digits. */
float NMEA_ToDecimalDegrees(const char *raw, char hemisphere)
{
  float val = atof(raw);
  int deg = (int)(val / 100);
  float minutes = val - (deg * 100);
  float dec = deg + (minutes / 60.0f);
  if (hemisphere == 'S' || hemisphere == 'W') dec = -dec;
  return dec;
}

void GPS_ParseSentence(char *line)
{
  bool isRMC = (strncmp(line, "$GPRMC", 6) == 0) || (strncmp(line, "$GNRMC", 6) == 0);
  bool isGGA = (strncmp(line, "$GPGGA", 6) == 0) || (strncmp(line, "$GNGGA", 6) == 0);
  if (!isRMC && !isGGA) return;

  char latRaw[12] = {0}, lonRaw[12] = {0};
  char latHemi = 0, lonHemi = 0;
  uint8_t idx = 0;
  char *tok = strtok(line, ",");

  if (isRMC)
  {
    while (tok != NULL)
    {
      switch (idx)
      {
        case 2: gps.fixValid = (tok[0] == 'A'); break;
        case 3: strncpy(latRaw, tok, sizeof(latRaw) - 1); break;
        case 4: latHemi = tok[0]; break;
        case 5: strncpy(lonRaw, tok, sizeof(lonRaw) - 1); break;
        case 6: lonHemi = tok[0]; break;
        case 7: gps.speedKmh = atof(tok) * 1.852f; break; /* knots -> km/h */
      }
      tok = strtok(NULL, ",");
      idx++;
    }
    if (gps.fixValid && latRaw[0] != 0 && lonRaw[0] != 0)
    {
      gps.lat = NMEA_ToDecimalDegrees(latRaw, latHemi);
      gps.lon = NMEA_ToDecimalDegrees(lonRaw, lonHemi);
      gps.lastFixMillis = millis();
    }
  }
  else /* GGA */
  {
    while (tok != NULL)
    {
      switch (idx)
      {
        case 6: gps.fixQuality = atoi(tok); break;   /* 0 = no fix */
        case 7: gps.satellites = atoi(tok); break;
        case 9: gps.altitude_m = atof(tok); break;    /* MSL altitude, meters */
      }
      tok = strtok(NULL, ",");
      idx++;
    }
    gps.hasAltitude = (gps.fixQuality > 0);
    if (gps.fixQuality > 0) gps.lastFixMillis = millis();
  }

  gps.ok = true;
}

/* Called every loop() iteration (NOT gated by the 2s sensor cycle) so the
   SoftwareSerial RX buffer is drained continuously and no NMEA sentences
   are lost between sensor-read cycles. */
void GPS_Update()
{
  while (gpsSerial.available())
  {
    char c = gpsSerial.read();
    if (c == '\n')
    {
      gpsLineBuf[gpsLineLen] = '\0';
      GPS_ParseSentence(gpsLineBuf);
      gpsLineLen = 0;
    }
    else if (c != '\r')
    {
      if (gpsLineLen < sizeof(gpsLineBuf) - 1) gpsLineBuf[gpsLineLen++] = c;
      else gpsLineLen = 0; /* overflow guard: discard and resync on next line */
    }
  }
}

bool GPS_FixIsFresh()
{
  return gps.ok && gps.fixValid && (millis() - gps.lastFixMillis < GPS_FIX_STALE_MS);
}

/* =========================================================================
   Derived calculations: altitude self-check, climb rate, gradient, diffs,
   max altitude, flight phase
   ========================================================================= */
void UpdateDerivedValues()
{
  unsigned long now = millis();
  float dt_s = firstCycle ? (CYCLE_MS / 1000.0f) : (now - prevTime_ms) / 1000.0f;
  if (dt_s <= 0.0f) dt_s = CYCLE_MS / 1000.0f;

  if (bmp.ok && bmp.altitudeValid && !firstCycle)
  {
    float impliedRate = fabs(bmp.altitude_m - prevAltitude_m) / dt_s;
    if (impliedRate > BMP_MAX_CLIMB_RATE_MPS) bmp.altitudeValid = false;
  }

  if (bmp.ok && !bmp.altitudeValid)
  {
    bmpImplausibleStreak++;
    if (bmpImplausibleStreak >= BMP_FAIL_STREAK_LIMIT) bmpAltitudeDisabled = true;
  }
  else if (bmp.ok && bmp.altitudeValid)
  {
    bmpImplausibleStreak = 0;
  }

  if (bmp.ok && bmp.altitudeValid && !bmpAltitudeDisabled)
  {
    bestAltitude_m = bmp.altitude_m;
    altitudeSource = ALT_SRC_BMP;
  }
  else if (GPS_FixIsFresh() && gps.hasAltitude)
  {
    bestAltitude_m = gps.altitude_m;
    altitudeSource = ALT_SRC_GPS;
  }
  else
  {
    altitudeSource = ALT_SRC_NONE;
  }

  if (altitudeSource != ALT_SRC_NONE)
  {
    climbRate_mps = firstCycle ? 0.0f : (bestAltitude_m - prevAltitude_m) / dt_s;
    if (bestAltitude_m > maxAltitude_m) maxAltitude_m = bestAltitude_m;
  }

  if (dsOut_data.ok)
  {
    tempGradient_Cps = firstCycle ? 0.0f : (dsOut_data.tempC - prevOutsideTemp) / dt_s;
  }

  if (dsIn_data.ok && dsOut_data.ok)
  {
    tempDiff_C = dsIn_data.tempC - dsOut_data.tempC;
  }

  if (altitudeSource != ALT_SRC_NONE)
  {
    switch (flightPhase)
    {
      case PRELAUNCH:
        if (climbRate_mps > LAUNCH_CLIMB_THRESHOLD) flightPhase = ASCENT;
        break;
      case ASCENT:
        if (climbRate_mps < DESCENT_THRESHOLD) flightPhase = DESCENT;
        else if (fabs(climbRate_mps) < APOGEE_CLIMB_THRESHOLD &&
                 bestAltitude_m > (maxAltitude_m - APOGEE_ALT_WINDOW)) flightPhase = NEAR_APOGEE;
        break;
      case NEAR_APOGEE:
        if (climbRate_mps < DESCENT_THRESHOLD) flightPhase = DESCENT;
        else if (climbRate_mps > LAUNCH_CLIMB_THRESHOLD) flightPhase = ASCENT;
        break;
      case DESCENT:
        if (fabs(bestAltitude_m - prevAltitude_m) < LANDED_ALT_CHANGE)
        {
          landedConfirmCount++;
          if (landedConfirmCount >= LANDED_CONFIRM_CYCLES) flightPhase = LANDED;
        }
        else landedConfirmCount = 0;
        break;
      case LANDED:
        break;
    }
  }

  if (altitudeSource != ALT_SRC_NONE) prevAltitude_m = bestAltitude_m;
  if (dsOut_data.ok) prevOutsideTemp = dsOut_data.tempC;
  prevTime_ms = now;
  firstCycle = false;
}

/* =========================================================================
   Sensor health bitmask
   ========================================================================= */
void UpdateSensorHealth()
{
  sensorHealthMask = 0;
  if (bmp.ok)        sensorHealthMask |= (1 << HEALTH_BMP180);
  if (mpu.ok)         sensorHealthMask |= (1 << HEALTH_MPU6050);
  if (aht.ok)         sensorHealthMask |= (1 << HEALTH_AHT10);
  if (dsIn_data.ok)   sensorHealthMask |= (1 << HEALTH_DS_IN);
  if (dsOut_data.ok)  sensorHealthMask |= (1 << HEALTH_DS_OUT);
  if (bmp.ok && bmp.altitudeValid && !bmpAltitudeDisabled) sensorHealthMask |= (1 << HEALTH_BMP_ALT);
  if (GPS_FixIsFresh()) sensorHealthMask |= (1 << HEALTH_GPS);
}

/* =========================================================================
   SD logging — full-resolution local record (unchanged cadence)
   ========================================================================= */
bool SD_WriteHeaderIfNew()
{
  if (!SD.exists("HABLOG.CSV"))
  {
    File f = SD.open("HABLOG.CSV", FILE_WRITE);
    if (!f) return false;
    f.println(F("millis,bmp_tempC,bmp_pressPa,bmp_altitude_m,bmp_altitude_valid,bmp_altitude_disabled,"
                 "mpu_ax,mpu_ay,mpu_az,mpu_gx,mpu_gy,mpu_gz,accel_mag_g,"
                 "aht_tempC,aht_humPct,dew_point_C,ds_in_tempC,ds_out_tempC,temp_diff_C,temp_gradient_Cps,"
                 "uv_index,battery_voltage,flight_phase,max_altitude_m,best_altitude_m,altitude_source,"
                 "gps_lat,gps_lon,gps_alt_m,gps_speed_kmh,gps_satellites,gps_fix_valid,"
                 "sensor_health_hex,tx_success,tx_skip_total"));
    f.close();
  }
  return true;
}

void SD_LogRow()
{
  logFile = SD.open("HABLOG.CSV", FILE_WRITE);
  if (!logFile) return;

  logFile.print(millis()); logFile.print(',');

  if (bmp.ok) {
    logFile.print(bmp.tempC, 2); logFile.print(',');
    logFile.print(bmp.pressPa); logFile.print(',');
    logFile.print(bmp.altitude_m, 1); logFile.print(',');
    logFile.print(bmp.altitudeValid ? 1 : 0); logFile.print(',');
    logFile.print(bmpAltitudeDisabled ? 1 : 0);
  } else { logFile.print(F("NA,NA,NA,NA,")); logFile.print(bmpAltitudeDisabled ? 1 : 0); }
  logFile.print(',');

  if (mpu.ok) {
    logFile.print(mpu.ax_g, 3); logFile.print(',');
    logFile.print(mpu.ay_g, 3); logFile.print(',');
    logFile.print(mpu.az_g, 3); logFile.print(',');
    logFile.print(mpu.gx_dps, 2); logFile.print(',');
    logFile.print(mpu.gy_dps, 2); logFile.print(',');
    logFile.print(mpu.gz_dps, 2); logFile.print(',');
    logFile.print(mpu.accelMag_g, 3);
  } else { logFile.print(F("NA,NA,NA,NA,NA,NA,NA")); }
  logFile.print(',');

  if (aht.ok) { logFile.print(aht.tempC, 2); logFile.print(','); logFile.print(aht.humPct, 2); logFile.print(','); logFile.print(aht.dewPointC, 2); }
  else        { logFile.print(F("NA,NA,NA")); }
  logFile.print(',');

  if (dsIn_data.ok)  logFile.print(dsIn_data.tempC, 2);  else logFile.print(F("NA"));
  logFile.print(',');
  if (dsOut_data.ok) logFile.print(dsOut_data.tempC, 2); else logFile.print(F("NA"));
  logFile.print(',');

  if (dsIn_data.ok && dsOut_data.ok) logFile.print(tempDiff_C, 2); else logFile.print(F("NA"));
  logFile.print(',');
  if (dsOut_data.ok) logFile.print(tempGradient_Cps, 4); else logFile.print(F("NA"));
  logFile.print(',');

  logFile.print(uv_index, 2); logFile.print(',');
  if (battery.ok) logFile.print(battery.voltage, 2); else logFile.print(F("NA"));
  logFile.print(',');
  logFile.print(flightPhase); logFile.print(',');
  logFile.print(maxAltitude_m, 1); logFile.print(',');
  logFile.print(bestAltitude_m, 1); logFile.print(',');
  logFile.print(altitudeSource); logFile.print(',');

  if (gps.ok) {
    logFile.print(gps.lat, 6); logFile.print(',');
    logFile.print(gps.lon, 6); logFile.print(',');
    logFile.print(gps.hasAltitude ? gps.altitude_m : 0.0f, 1); logFile.print(',');
    logFile.print(gps.speedKmh, 1); logFile.print(',');
    logFile.print(gps.satellites); logFile.print(',');
    logFile.print(GPS_FixIsFresh() ? 1 : 0);
  } else {
    logFile.print(F("NA,NA,NA,NA,NA,0"));
  }
  logFile.print(',');

  logFile.print(F("0x")); logFile.print(sensorHealthMask, HEX); logFile.print(',');
  logFile.print(lastTxSuccess ? 1 : 0); logFile.print(',');
  logFile.println(txSkipCount);

  logFile.close();
  sensorHealthMask |= (1 << HEALTH_SD_WRITE);
}

/* =========================================================================
   LoRa E32 telemetry (SoftwareSerial = the module's UART)
   ========================================================================= */
uint8_t LoRa_Checksum(const uint8_t *data, size_t len)
{
  uint8_t sum = 0;
  for (size_t i = 0; i < len; i++) sum ^= data[i];
  return sum;
}

bool LoRa_WaitReady(uint16_t timeout_ms)
{
  unsigned long start = millis();
  while (digitalRead(LORA_AUX_PIN) == LOW)
  {
    if (millis() - start > timeout_ms) return false;
  }
  return true;
}

void LoRa_SendTelemetry()
{
  TelemetryFrame f;
  f.sync0 = LORA_SYNC0;
  f.sync1 = LORA_SYNC1;
  f.millis_ms = millis();

  f.bmpTempC_x100 = bmp.ok ? (int16_t)(bmp.tempC * 100.0f) : -32768;
  f.bmpPress_Pa   = bmp.ok ? (int32_t)bmp.pressPa : -1;
  f.bmpAlt_m_x10  = bmp.ok ? (int16_t)(bmp.altitude_m * 10.0f) : -32768;
  f.bmpFlags = 0;
  if (bmp.ok)               f.bmpFlags |= 0x01;
  if (bmp.altitudeValid)    f.bmpFlags |= 0x02;
  if (bmpAltitudeDisabled)  f.bmpFlags |= 0x04;

  f.ax_x1000 = mpu.ok ? (int16_t)(mpu.ax_g * 1000.0f) : 0;
  f.ay_x1000 = mpu.ok ? (int16_t)(mpu.ay_g * 1000.0f) : 0;
  f.az_x1000 = mpu.ok ? (int16_t)(mpu.az_g * 1000.0f) : 0;
  f.accelMag_x1000 = mpu.ok ? (uint16_t)(mpu.accelMag_g * 1000.0f) : 0;

  f.ahtTempC_x100 = aht.ok ? (int16_t)(aht.tempC * 100.0f) : -32768;
  f.ahtHum_x100   = aht.ok ? (uint16_t)(aht.humPct * 100.0f) : 0;
  f.dewPointC_x100= aht.ok ? (int16_t)(aht.dewPointC * 100.0f) : -32768;

  f.dsInC_x100  = dsIn_data.ok  ? (int16_t)(dsIn_data.tempC * 100.0f)  : -32768;
  f.dsOutC_x100 = dsOut_data.ok ? (int16_t)(dsOut_data.tempC * 100.0f) : -32768;
  f.tempDiffC_x100 = (dsIn_data.ok && dsOut_data.ok) ? (int16_t)(tempDiff_C * 100.0f) : -32768;
  f.tempGrad_x1000 = dsOut_data.ok ? (int16_t)(tempGradient_Cps * 1000.0f) : 0;

  f.uvIndex_x100 = (uint16_t)(uv_index * 100.0f);
  f.battery_x100 = battery.ok ? (uint16_t)(battery.voltage * 100.0f) : 0;

  f.flightPhase  = flightPhase;
  f.maxAlt_m_x10 = (int16_t)(maxAltitude_m * 10.0f);
  f.healthMask   = sensorHealthMask;

  bool gpsFresh = GPS_FixIsFresh();
  f.gpsLat_x1e6      = gps.ok ? (int32_t)(gps.lat * 1000000.0f) : 0;
  f.gpsLon_x1e6      = gps.ok ? (int32_t)(gps.lon * 1000000.0f) : 0;
  f.gpsAlt_m_x10     = (gps.ok && gps.hasAltitude) ? (int16_t)(gps.altitude_m * 10.0f) : -32768;
  f.gpsSpeedKmh_x10  = gps.ok ? (uint16_t)(gps.speedKmh * 10.0f) : 0;
  f.gpsSatellites    = gps.satellites;
  f.gpsFlags = 0;
  if (gps.fixValid)    f.gpsFlags |= 0x01;
  if (gps.hasAltitude) f.gpsFlags |= 0x02;
  if (!gpsFresh)        f.gpsFlags |= 0x04;

  /* checksum covers everything between the sync bytes and the checksum itself */
  f.checksum = LoRa_Checksum(((uint8_t *)&f) + 2, sizeof(TelemetryFrame) - 3);

  if (LoRa_WaitReady(LORA_AUX_TIMEOUT_MS))
  {
    /* LoRa is now on the hardware UART — write the frame directly to
       Serial. With DEBUG_ENABLED at 0 (the default), nothing else ever
       writes to Serial, so the binary stream stays uncontaminated. */
    Serial.write((uint8_t *)&f, sizeof(TelemetryFrame));

    /* TX activity indicator: toggle the LED on every successful frame
       (not just set HIGH) so the physical light visibly blinks once per
       cycle rather than latching solid — that blink is your "data is
       actually transmitting" confirmation, on the bench or under the
       balloon, with no ground station required. */
    txLedState = !txLedState;
    digitalWrite(TX_LED_PIN, txLedState ? HIGH : LOW);

    lastTxSuccess = true;
    txSuccessCount++;
  }
  else
  {
    /* AUX never went ready in time — frame is skipped rather than risking
       a corrupted/overlapping transmission. LED is deliberately left
       exactly as it was (not toggled, not forced off) so a stall shows up
       as the LED going quiet/stuck instead of blinking on schedule. */
    lastTxSuccess = false;
    txSkipCount++;
  }
}

/* =========================================================================
   Debug (USB / Tera Term) — DISABLED BY DEFAULT.
   LoRa now owns the hardware UART (D0/D1), so writing debug text to
   Serial here would corrupt the binary telemetry stream it also carries.
   Set DEBUG_ENABLED to 1 above ONLY with the E32 physically disconnected
   from D0/D1 (bench sensor testing without live telemetry).
   ========================================================================= */
void DebugPrintLine()
{
#if DEBUG_ENABLED
  Serial.print(F("t=")); Serial.print(millis());
  Serial.print(F(" | BMP T=")); Serial.print(bmp.ok ? bmp.tempC : 0, 1);
  Serial.print(F("C P=")); Serial.print(bmp.ok ? bmp.pressPa : 0);
  Serial.print(F("Pa Alt=")); Serial.print(bmp.altitude_m, 1);
  Serial.print(bmpAltitudeDisabled ? F("m[DISABLED]") : (bmp.altitudeValid ? F("m[ok]") : F("m[rej]")));
  Serial.print(F(" | AltSrc="));
  Serial.print(altitudeSource == ALT_SRC_BMP ? F("BMP") : (altitudeSource == ALT_SRC_GPS ? F("GPS") : F("NONE")));
  Serial.print(F(" Best=")); Serial.print(bestAltitude_m, 1);
  Serial.print(F(" | Phase=")); Serial.print(PHASE_NAMES[flightPhase]);
  Serial.print(F(" MaxAlt=")); Serial.print(maxAltitude_m, 1);
  Serial.print(F(" | GPS "));
  if (gps.ok) {
    Serial.print(GPS_FixIsFresh() ? F("fix ") : F("stale "));
    Serial.print(gps.lat, 5); Serial.print(F(",")); Serial.print(gps.lon, 5);
    Serial.print(F(" sats=")); Serial.print(gps.satellites);
  } else {
    Serial.print(F("no data"));
  }
  Serial.print(F(" | Batt=")); Serial.print(battery.voltage, 2);
  Serial.print(F("V | Health=0x")); Serial.print(sensorHealthMask, HEX);
  Serial.print(F(" | TX="));
  if (lastTxSuccess) { Serial.print(F("SENT #")); Serial.print(txSuccessCount); }
  else               { Serial.print(F("SKIPPED(BUSY) total_skips=")); Serial.print(txSkipCount); }
  Serial.println();
#endif
}

/* =========================================================================
   Setup / Loop
   ========================================================================= */
void setup()
{
  /* Serial (D0/D1) is now the LoRa E32 link. It's begun at PROJECT_BAUD
     either way; boot-time human-readable prints below are compiled out
     unless DEBUG_ENABLED=1 (E32 disconnected from D0/D1). */
  Serial.begin(PROJECT_BAUD);
  gpsSerial.begin(GPS_BAUD);
  pinMode(LORA_AUX_PIN, INPUT);
  pinMode(TX_LED_PIN, OUTPUT);
  digitalWrite(TX_LED_PIN, LOW);
  Wire.begin();

#if DEBUG_ENABLED
  Serial.println(F("\r\n===== HAB01 Nano Payload Boot ====="));
#endif

  bool bmpCalOk = BMP180_ReadCalibration();
  bool mpuOk    = MPU6050_Init();
  bool ahtOk    = AHT10_Init();
  bool sdOk     = SD.begin(SD_CS_PIN);
  if (sdOk) SD_WriteHeaderIfNew();

#if DEBUG_ENABLED
  Serial.print(F("BMP180=")); Serial.print(bmpCalOk ? F("OK") : F("FAIL"));
  Serial.print(F(" MPU6050=")); Serial.print(mpuOk ? F("OK") : F("FAIL"));
  Serial.print(F(" AHT10=")); Serial.print(ahtOk ? F("OK") : F("FAIL"));
  Serial.print(F(" SD=")); Serial.println(sdOk ? F("OK") : F("FAIL"));
#else
  (void)bmpCalOk; (void)mpuOk; (void)ahtOk; (void)sdOk; /* silence unused warnings */
#endif

  if (bmpCalOk)
  {
    long sumPa = 0; uint8_t n = 0;
    for (uint8_t i = 0; i < 5; i++)
    {
      if (BMP180_ReadData()) { sumPa += bmp.pressPa; n++; }
      delay(100);
    }
    if (n > 0)
    {
      groundPressure_Pa = (float)sumPa / n;
#if DEBUG_ENABLED
      Serial.print(F("Ground pressure reference: "));
      Serial.print(groundPressure_Pa, 1);
      Serial.println(F(" Pa"));
#endif
    }
  }

  lastCycle = millis();
  prevTime_ms = millis();
}

void loop()
{
  /* Drain the GPS SoftwareSerial buffer every iteration, not just once
     per 2s cycle — NMEA sentences arrive continuously and the buffer is
     small, so this must run every pass through loop() or bytes are lost. */
  GPS_Update();

  if (millis() - lastCycle >= CYCLE_MS)
  {
    lastCycle = millis();

    BMP180_ReadData();
    MPU6050_ReadData();
    AHT10_ReadData();
    dsIn_data.ok  = DS18B20_ReadTemperature(dsIn, &dsIn_data.tempC);
    dsOut_data.ok = DS18B20_ReadTemperature(dsOut, &dsOut_data.tempC);
    uv_index = ADC_ReadUVIndex();
    Battery_Read();

    UpdateDerivedValues();
    UpdateSensorHealth();

    SD_LogRow();
    LoRa_SendTelemetry();
    DebugPrintLine();
  }
}
