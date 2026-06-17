import os
import json
import logging
import hashlib
from datetime import datetime
import urllib.request
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup
from flask import Flask, jsonify, render_template

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)

CACHE_FILE = 'release_notes_cache.json'
FEED_URL = 'https://docs.cloud.google.com/feeds/bigquery-release-notes.xml'

def get_hash(text):
    """Generate a short unique ID from text content."""
    return hashlib.md5(text.encode('utf-8')).hexdigest()[:12]

def fetch_and_parse_feed():
    """Fetches the XML feed and parses it into a structured dictionary."""
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    
    req = urllib.request.Request(FEED_URL, headers=headers)
    
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            xml_data = response.read()
    except Exception as e:
        logger.error(f"Failed to fetch XML feed: {e}")
        raise RuntimeError(f"Network error: Unable to fetch feed. {str(e)}")
        
    try:
        root = ET.fromstring(xml_data)
    except Exception as e:
        logger.error(f"Failed to parse XML feed: {e}")
        raise ValueError(f"XML parsing error: Feed contains invalid XML. {str(e)}")
        
    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    entries = root.findall('atom:entry', ns)
    
    parsed_entries = []
    
    for idx, entry in enumerate(entries):
        title_el = entry.find('atom:title', ns)
        date_str = title_el.text.strip() if title_el is not None else "Unknown Date"
        
        updated_el = entry.find('atom:updated', ns)
        updated_str = updated_el.text.strip() if updated_el is not None else ""
        
        link_el = entry.find('atom:link', ns)
        link_url = link_el.attrib.get('href') if link_el is not None else "https://cloud.google.com/bigquery/docs/release-notes"
        
        content_el = entry.find('atom:content', ns)
        content_html = content_el.text if content_el is not None else ""
        
        soup = BeautifulSoup(content_html, 'html.parser')
        
        updates = []
        current_type = None
        current_content_parts = []
        
        # Iterate over HTML elements inside the entry content
        for child in soup.contents:
            if child.name == 'h3':
                # Save previous update if exists
                if current_type is not None:
                    raw_html = ''.join(current_content_parts).strip()
                    sub_soup = BeautifulSoup(raw_html, 'html.parser')
                    text_content = sub_soup.get_text().strip()
                    
                    update_id = get_hash(f"{date_str}_{current_type}_{text_content[:50]}")
                    updates.append({
                        'id': update_id,
                        'type': current_type,
                        'html': raw_html,
                        'text': text_content
                    })
                
                current_type = child.get_text().strip()
                current_content_parts = []
            else:
                current_content_parts.append(str(child))
                
        # Handle the last update block in the entry
        if current_type is not None:
            raw_html = ''.join(current_content_parts).strip()
            sub_soup = BeautifulSoup(raw_html, 'html.parser')
            text_content = sub_soup.get_text().strip()
            
            update_id = get_hash(f"{date_str}_{current_type}_{text_content[:50]}")
            updates.append({
                'id': update_id,
                'type': current_type,
                'html': raw_html,
                'text': text_content
            })
            
        parsed_entries.append({
            'date': date_str,
            'updated': updated_str,
            'link': link_url,
            'updates': updates
        })
        
    return parsed_entries

def load_cached_notes():
    """Load cached release notes from local file."""
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to read cache file: {e}")
    return None

def save_to_cache(data):
    """Save release notes to local file cache."""
    try:
        cache_data = {
            'last_fetched': datetime.now().isoformat(),
            'notes': data
        }
        with open(CACHE_FILE, 'w', encoding='utf-8') as f:
            json.dump(cache_data, f, indent=2, ensure_ascii=False)
        logger.info("Successfully updated local cache.")
    except Exception as e:
        logger.error(f"Failed to write to cache file: {e}")

@app.route('/')
def home():
    """Renders the main page."""
    return render_template('index.html')

@app.route('/api/notes')
def get_notes():
    """API endpoint to get release notes. Returns cache if fetch fails."""
    try:
        notes = fetch_and_parse_feed()
        save_to_cache(notes)
        return jsonify({
            'status': 'success',
            'cached': False,
            'last_fetched': datetime.now().isoformat(),
            'notes': notes
        })
    except Exception as e:
        logger.warning(f"Error fetching notes, falling back to cache: {e}")
        cached_data = load_cached_notes()
        if cached_data:
            return jsonify({
                'status': 'success',
                'cached': True,
                'last_fetched': cached_data.get('last_fetched'),
                'notes': cached_data.get('notes'),
                'warning': 'Using cached data due to a temporary network issue.'
            })
        else:
            return jsonify({
                'status': 'error',
                'message': f"Failed to retrieve data and no cache is available. Error: {str(e)}"
            }), 500

@app.route('/api/refresh', methods=['POST'])
def refresh_notes():
    """Force a refresh of the feed and update the cache."""
    try:
        notes = fetch_and_parse_feed()
        save_to_cache(notes)
        return jsonify({
            'status': 'success',
            'cached': False,
            'last_fetched': datetime.now().isoformat(),
            'notes': notes
        })
    except Exception as e:
        logger.error(f"Force refresh failed: {e}")
        # Return what's in cache if available, but with a flag that refresh failed
        cached_data = load_cached_notes()
        if cached_data:
            return jsonify({
                'status': 'error_fallback',
                'cached': True,
                'last_fetched': cached_data.get('last_fetched'),
                'notes': cached_data.get('notes'),
                'message': f"Refresh failed: {str(e)}. Displaying previously cached notes."
            })
        else:
            return jsonify({
                'status': 'error',
                'message': f"Refresh failed and no cache is available: {str(e)}"
            }), 500

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)
