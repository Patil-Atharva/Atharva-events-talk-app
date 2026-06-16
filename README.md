# BigQuery Release Notes Explorer

A modern, fast, and responsive web application dashboard built with **Python Flask** and **Vanilla HTML, CSS, and JavaScript**. It fetches, parses, and structures live release notes from the Google Cloud BigQuery RSS feed, providing developers and data teams with a clean interface to search, filter, export, and share release updates.

---

## 🚀 Key Features

1. **Structured Feed Parsing**: Converts Google's unstructured feed HTML contents into nested, clean JSON structures categorizing updates by type (e.g., Features, Changes, Issues, Breaking, Announcements).
2. **Dashboard Analytics (KPIs)**: Summarizes data metrics dynamically, showing total release updates, new features added, and critical breaking issues.
3. **Dual-Criteria Client-side Filters**: Combines real-time search terms with categorical filter chips to find updates instantly.
4. **Manual Refresh & Caching**: Integrates a 10-minute server-side in-memory cache to prevent feed exhaustion, alongside a manual refresh button with an animated spinner to force live network syncs (`?force=true`).
5. **Aesthetic Light & Dark Modes**: Responsive, Zinc-inspired styling that adapts to your screen and persists your choice using browser `localStorage`.
6. **Utility Copy & Export**:
   * **Copy to Clipboard**: One-click card copy which extracts raw content and formats it cleanly.
   * **Export to CSV**: Dynamically builds and downloads a CSV spreadsheet reflecting the currently filtered timeline view.
7. **One-Click Share Intent**: Automatically formats and truncates updates to compose X (formerly Twitter) posts featuring official deep-links.
8. **Hash Deep-linking**: Automatically generates anchor links for specific dates that scroll to and highlight the corresponding card.

---

## 🛠️ Tech Stack

- **Backend**: Python 3.x, Flask, Requests, XML ElementTree (Standard Library).
- **Frontend**: Vanilla HTML5, CSS3 Custom Properties (Variables), Vanilla JavaScript (ES6+).
- **CSS Layout**: Flexbox, CSS Grid, custom transitions, hardware-accelerated animations.

---

## 📁 Project Structure

```text
bigquery-release-notes-app/
├── .venv/                  # Python virtual environment
├── static/
│   ├── css/
│   │   └── style.css       # Custom styles, theme tokens, spinner animations
│   └── js/
│       └── app.js          # App state, DOM listeners, search/filter/share logic
├── templates/
│   └── index.html          # Semantic HTML dashboard template
├── .gitignore              # Git ignore configuration
├── app.py                  # Flask web server, XML parser, and caching logic
├── README.md               # Project documentation
└── requirements.txt        # Python package dependencies
```

---

## ⚙️ Installation & Setup

### Prerequisites
Make sure you have **Python 3.x** and **Git** installed on your system.

### 1. Clone the Repository
```bash
git clone https://github.com/Patil-Atharva/Atharva-events-talk-app.git
cd Atharva-events-talk-app
```

### 2. Set Up Virtual Environment
Create and activate a virtual environment to manage dependencies locally:

**On Windows (Command Prompt/PowerShell):**
```powershell
python -m venv .venv
.\.venv\Scripts\activate
```

**On macOS / Linux:**
```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Run the Application
Start the Flask development server:
```bash
python app.py
```

### 5. Open in Browser
Navigate to the local dev URL:
```text
http://127.0.0.1:5000/
```

---

## 📖 How It Works (Sample Request Flow)

1. **Request**: Browser requests `/api/releases`.
2. **Server Logic**:
   * Checks local memory cache. If under 10 minutes old, returns cached JSON.
   * If cache is expired or the request contains `?force=true`, the server calls Google Cloud's RSS XML endpoint.
   * Parses the XML feed using `ElementTree` and partitions items using regex markers (`<h3>`).
3. **Response**: Flask returns a structured JSON payload.
4. **Client Render**: JavaScript receives the JSON, updates stats, runs active filter arrays, structures the timeline DOM elements, and prompts toast notifications.
