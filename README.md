# HAB01 Ground Station Dashboard

A real-time mission control dashboard for the HAB01 High Altitude Balloon ground station. Ingests telemetry from the Arduino Uno receiver over USB serial, stores it durably, and displays it live during flight and for review afterward.

## Architecture

```
[Flight Computer] --LoRa--> [Ground Station Uno] --USB Serial (CSV)--> [Serial Bridge]
                                                                            |
                                                                    POST /ingest
                                                                            |
                                                                    [Backend API + SQLite]
                                                                            |
                                                                    WebSocket push
                                                                            |
                                                                    [Frontend Dashboard]
```

## Quick Start

### Prerequisites
- **Python 3.10+** with pip
- **Node.js 18+** with npm

### Option 1: One-Click Demo (no hardware needed)
```
start_demo.bat
```
This starts the backend, a flight simulator, and the frontend. Open **http://localhost:5173** to see a simulated HAB flight.

### Option 2: Manual Setup

**1. Install dependencies:**
```bash
pip install -r backend/requirements.txt
pip install -r bridge/requirements.txt
cd frontend && npm install && cd ..
```

**2. Start the backend API:**
```bash
cd backend
python run.py
```

**3. Start the frontend:**
```bash
cd frontend
npm run dev
```

**4a. Connect to real hardware:**
```bash
cd bridge
python serial_bridge.py --port COM3
```

**4b. Or run the flight simulator:**
```bash
cd bridge
python simulate_flight.py
```

**5. Open the dashboard:** http://localhost:5173

## Project Structure

```
Dashboard/
├── backend/           # FastAPI server (REST + WebSocket)
│   ├── main.py        # API endpoints and WebSocket handler
│   ├── database.py    # SQLite schema and queries
│   ├── models.py      # Pydantic request/response models
│   ├── config.py      # Environment configuration
│   └── run.py         # Server entry point
├── bridge/            # Serial bridge & simulator
│   ├── serial_bridge.py    # USB Serial → API bridge
│   └── simulate_flight.py  # Fake flight data generator
├── frontend/          # React + Vite + TypeScript dashboard
│   └── src/
│       ├── components/     # UI components (charts, map, etc.)
│       ├── contexts/       # WebSocket context provider
│       ├── api/            # API client and React Query hooks
│       ├── types/          # TypeScript type definitions
│       └── pages/          # Dashboard page layout
├── data/              # SQLite database (auto-created)
├── start.bat          # Full launcher with serial port selection
└── start_demo.bat     # Demo mode launcher
```

## Dashboard Features

- **Live Map** — Current position marker + flight path polyline (OpenStreetMap/CartoDB dark tiles)
- **Status Header** — Flight phase badge, sensor health indicators, link quality, staleness warning
- **Time-Series Charts** — Altitude (BMP + GPS), temperature, pressure, humidity, UV, battery, acceleration, climb rate
- **Data Table** — Raw telemetry log with the latest frames
- **Flight Timeline** — Visual stepper showing phase transitions with timestamps
- **Flight Selector** — Switch between live and historical flights
- **CSV Export** — Download full telemetry for any flight

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | System health + bridge connection status |
| GET | `/flights` | List all flight sessions |
| GET | `/flights/{id}` | Single flight metadata |
| POST | `/flights` | Create new flight session |
| PATCH | `/flights/{id}` | Update flight name/notes |
| GET | `/flights/{id}/frames` | Paginated telemetry frames |
| GET | `/flights/{id}/frames/latest` | Most recent frame |
| GET | `/flights/{id}/export` | CSV download |
| POST | `/ingest` | Receive telemetry from bridge |
| WS | `/live` | Real-time frame broadcast |

## Configuration

**Serial Bridge** (env vars or CLI args):
- `SERIAL_PORT` — COM port (default: auto-detect)
- `BAUD_RATE` — Serial baud rate (default: 9600)
- `API_URL` — Backend URL (default: http://localhost:8000)

**Backend** (env vars):
- `HOST` — Server bind address (default: 0.0.0.0)
- `PORT` — Server port (default: 8000)
- `DATABASE_PATH` — SQLite file path (default: ../data/hab_telemetry.db)
