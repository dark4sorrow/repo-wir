import os
import json
import requests
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

# Resolve the .env file one directory up from the collectors folder
env_path = Path(__file__).resolve().parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

# --- CONFIGURATION ---
API_KEY = os.getenv('KB4_API_KEY')
BASE_URL = os.getenv('KB4_BASE_URL', 'https://us.api.knowbe4.com/v1').rstrip('/')
HEADERS = {'Authorization': f'Bearer {API_KEY}', 'Accept': 'application/json'}

def fetch_active_users():
    users = []
    page = 1
    # We'll pull a significant sample for the executive summary
    while page <= 3:
        r = requests.get(f"{BASE_URL}/users?per_page=500&page={page}&status=active", headers=HEADERS, timeout=15)
        if r.status_code != 200:
            break
        data = r.json()
        if not data:
            break
        users.extend(data)
        page += 1
    return users

def main():
    try:
        active_users = fetch_active_users()
        if not active_users:
            print(json.dumps({"error": "No active users found or API failure"}))
            return

        # Calculate Averages
        scores = [u['current_risk_score'] for u in active_users if u.get('current_risk_score') is not None]
        avg_risk = sum(scores) / len(scores) if scores else 0
        
        phish_rates = [u['phish_prone_percentage'] for u in active_users if u.get('phish_prone_percentage') is not None]
        avg_phish = sum(phish_rates) / len(phish_rates) if phish_rates else 0
        
        high_risk_count = len([u for u in active_users if (u.get('current_risk_score') or 0) > 60])

        output = {
            "summary": {
                "avg_risk_score": round(avg_risk, 1),
                "phish_prone_pct": f"{round(avg_phish, 1)}%",
                "high_risk_users": high_risk_count,
                "active_seats": len(active_users)
            },
            "status": "success",
            "timestamp": datetime.now().isoformat()
        }
        print(json.dumps(output))

    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    main()
