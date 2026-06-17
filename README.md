# BigQuery Release Pulse 📊🐦

A modern, responsive web application that aggregates Google BigQuery release notes and makes them easy to read, filter, search, and share directly to Twitter (X) with a built-in tweet editor.

## 🚀 Live Preview & Aesthetics

The application features a sleek dark developer-workspace aesthetic utilizing glassmorphism cards, glowing active states, and custom micro-animations (skeleton loading shimmers, circular character progress ring, and toast alerts).

---

## ✨ Key Features

1.  **Automated Feed Scraper & Parser**:
    *   Fetches the official XML Atom feed from Google Cloud.
    *   Parses HTML content strings and automatically segments them into distinct update items by date and classification category.
2.  **Category Tagging & Filtering**:
    *   Updates are categorized into standard types: `Feature`, `Announcement`, `Issue`, and `Deprecation`.
    *   Filter by categories with interactive color-coded badges, or use the keyword search bar.
3.  **Smart Tweet Composer**:
    *   Clicking any update card generates an optimized tweet draft automatically.
    *   **Twitter URL Calculation**: Accurately counts any URL as exactly 23 characters (conforming to Twitter's link-wrapping standard).
    *   **Circular Progress Ring**: Tracks character constraints visually (colors change from blue to amber at 250+ characters, and red at 280+ characters).
    *   **Sandbox Live Preview**: Simulates a rendered tweet card in real-time.
4.  **Resilient Local Cache**:
    *   Updates are stored in `release_notes_cache.json` on successful fetches.
    *   If the cloud feed becomes temporarily unreachable, the server falls back to the cache and displays a subtle warning badge on the dashboard.

---

## 🛠️ Technology Stack

*   **Backend**: Python Flask, requests, BeautifulSoup4, XML Parser.
*   **Frontend**: Vanilla HTML5, CSS3 (Custom Properties, Flexbox, CSS Grid), Vanilla JavaScript (ES6).
*   **Version Control**: Git, GitHub CLI.

---

## 💻 How to Get Started

### 1. Setup Environment
Initialize the Python virtual environment and install the required dependencies:
```bash
# Clone the repository
git clone https://github.com/Saichand222/ragolu-sai-chand-event-talks-app.git
cd ragolu-sai-chand-event-talks-app

# Create virtual environment
python -m venv .venv

# Activate virtual environment
# On Windows (PowerShell):
.venv\Scripts\Activate.ps1
# On macOS/Linux:
source .venv/bin/activate

# Install requirements
pip install -r requirements.txt
```

### 2. Run the App
Launch the Flask development server:
```bash
python app.py
```
Open your web browser and navigate to: **[http://127.0.0.1:5000](http://127.0.0.1:5000)**

---

## 📂 Project Architecture

*   `app.py` – Flask server routes, XML/HTML parser, caching layer.
*   `templates/index.html` – Modern dashboard layout and panels.
*   `static/css/style.css` – Design system styles, glassmorphic layout, transitions.
*   `static/js/app.js` – State machine, search filters, URL character counter.
*   `requirements.txt` – List of Python packages.
*   `.gitignore` – Excludes `.venv`, cached JSONs, and cache files from git.
