import os
import requests
from requests.auth import HTTPBasicAuth
import json
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

# Resolve the .env file one directory up from the collectors folder
env_path = Path(__file__).resolve().parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

# --- CONFIGURATION ---
API_KEY = os.getenv("UMBRELLA_API_KEY")
API_SECRET = os.getenv("UMBRELLA_API_SECRET")

def get_umbrella_token():
    url = "https://api.umbrella.com/auth/v2/token"
    try:
        response = requests.post(
            url,
            auth=HTTPBasicAuth(API_KEY, API_SECRET),
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=10
        )
        response.raise_for_status()
        return response.json().get("access_token")
    except Exception:
        return None

def get_umbrella_metrics(token):
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
    
    # 1. Fetch 24h Blocked Data
    url_dns = "https://api.umbrella.com/reports/v2/activity/dns"
    params = {"from": "-1days", "to": "now", "verdict": "blocked", "limit": 1000}
    
    total_blocks = 0
    try:
        resp = requests.get(url_dns, headers=headers, params=params, timeout=15)
        total_blocks = len(resp.json().get("data", []))
    except Exception:
        pass

    # 2. Fetch Deployment Health (Networks & VAs)
    health = {"networks": 0, "vas": 0}
    try:
        net_resp = requests.get("https://api.umbrella.com/deployments/v2/networks", headers=headers, timeout=10)
        if net_resp.status_code == 200:
            health["networks"] = sum(1 for n in net_resp.json() if n.get("status", "").upper() == "ACTIVE")
            
        va_resp = requests.get("https://api.umbrella.com/deployments/v2/virtualappliances", headers=headers, timeout=10)
        if va_resp.status_code == 200:
            health["vas"] = sum(1 for v in va_resp.json() if v.get("health", "").lower() == "okay")
    except Exception:
        pass

    return {
        "summary": {
            "total_blocks": total_blocks,
            "active_networks": health["networks"],
            "healthy_vas": health["vas"],
            "security_posture": "Optimal" if total_blocks < 5000 else "High Activity"
        },
        "status": "success",
        "timestamp": datetime.now().isoformat()
    }

def main():
    if not API_KEY or not API_SECRET:
        print(json.dumps({"error": "Credentials missing"}))
        return
        
    token = get_umbrella_token()
    if not token:
        print(json.dumps({"error": "Auth failed"}))
        return
        
    metrics = get_umbrella_metrics(token)
    print(json.dumps(metrics))

if __name__ == "__main__":
    main()
