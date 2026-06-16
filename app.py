import xml.etree.ElementTree as ET
import re
import time
from flask import Flask, jsonify, render_template, request
import requests

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
CACHE_TIMEOUT = 600  # Cache for 10 minutes

# Simple in-memory cache
cache = {
    "data": None,
    "expiry": 0
}

def parse_release_notes_feed(xml_content):
    try:
        # Parse Atom XML feed
        root = ET.fromstring(xml_content)
        
        # Atom namespace
        ns = {'atom': 'http://www.w3.org/2005/Atom'}
        
        entries = []
        for entry in root.findall('atom:entry', ns):
            title = entry.find('atom:title', ns)
            title_text = title.text if title is not None else "Unknown Date"
            
            updated = entry.find('atom:updated', ns)
            updated_text = updated.text if updated is not None else ""
            
            link_el = entry.find('atom:link[@rel="alternate"]', ns)
            link_href = link_el.get('href') if link_el is not None else ""
            
            content_el = entry.find('atom:content', ns)
            content_html = content_el.text if content_el is not None else ""
            
            items = []
            if content_html:
                # Split content by <h3>Type</h3>
                # parts[0] is everything before the first <h3>
                # parts[1] is the first type, parts[2] is its content, etc.
                parts = re.split(r'<h3>(.*?)</h3>', content_html)
                if parts[0].strip():
                    items.append({
                        "type": "General",
                        "content": parts[0].strip()
                    })
                
                for i in range(1, len(parts), 2):
                    if i + 1 < len(parts):
                        item_type = parts[i].strip()
                        item_content = parts[i+1].strip()
                        items.append({
                            "type": item_type,
                            "content": item_content
                        })
            
            entries.append({
                "date": title_text,
                "updated": updated_text,
                "link": link_href,
                "items": items
            })
            
        return entries
    except Exception as e:
        print(f"Error parsing XML feed: {e}")
        return []

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def get_releases():
    global cache
    now = time.time()
    force_refresh = request.args.get('force') == 'true'
    
    # Return cached data if valid and force refresh is not requested
    if not force_refresh and cache["data"] is not None and now < cache["expiry"]:
        return jsonify({
            "status": "success",
            "source": "cache",
            "releases": cache["data"]
        })
        
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        response = requests.get(FEED_URL, headers=headers, timeout=10)
        response.raise_for_status()
        
        releases = parse_release_notes_feed(response.text)
        
        # Update cache
        cache["data"] = releases
        cache["expiry"] = now + CACHE_TIMEOUT
        
        return jsonify({
            "status": "success",
            "source": "network",
            "releases": releases
        })
    except Exception as e:
        # If network call fails but we have stale cache, return it as a fallback
        if cache["data"] is not None:
            return jsonify({
                "status": "success",
                "source": "stale_cache_fallback",
                "releases": cache["data"],
                "warning": f"Network error: {str(e)}. Displaying stale cache."
            })
            
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
