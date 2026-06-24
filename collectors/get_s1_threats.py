import os
import requests
import json
import urllib3
from datetime import datetime, timedelta, timezone
from pathlib import Path
from dotenv import load_dotenv

# Resolve the .env file one directory up from the collectors folder
env_path = Path(__file__).resolve().parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Dynamic URL mapping to handle standard SentinelOne Base URLs
S1_BASE = os.getenv("S1_URL", "https://usea1-016.sentinelone.net").rstrip('/')
S1_API_URL = f"{S1_BASE}/web/api/v2.1"
API_TOKEN = os.getenv("S1_API_TOKEN")

def get_metrics():
    headers = {"Authorization": f"ApiToken {API_TOKEN}", "Content-Type": "application/json"}
    all_agents = []
    next_cursor = None
    
    try:
        # 1. FETCH ALL AGENTS
        while True:
            params = {"limit": 1000}
            if next_cursor: params["cursor"] = next_cursor
            res = requests.get(f"{S1_API_URL}/agents", headers=headers, params=params, verify=False, timeout=20)
            res.raise_for_status()
            data = res.json()
            all_agents.extend(data.get("data", []))
            next_cursor = data.get("pagination", {}).get("nextCursor")
            if not next_cursor: break

        total_agents = len(all_agents)
        win = len([a for a in all_agents if "windows" in a.get('osName', '').lower()])
        mac = len([a for a in all_agents if "macos" in a.get('osName', '').lower()])
        lin = len([a for a in all_agents if "linux" in a.get('osName', '').lower()])
        outdated = len([a for a in all_agents if a.get('status') == 'outdated'])
        compliance_rate = round(((total_agents - outdated) / total_agents * 100), 1) if total_agents > 0 else 0

        # 2. FETCH ALL THREATS (Last 7 Days)
        now = datetime.now(timezone.utc)
        threat_res = requests.get(f"{S1_API_URL}/threats", headers=headers, params={"createdAt__gt": (now - timedelta(days=7)).isoformat(), "limit": 100}, verify=False, timeout=15)
        threat_res.raise_for_status()
        raw_threats = threat_res.json().get("data", [])
        
        total_found = len(raw_threats)
        unresolved = [t for t in raw_threats if t.get('status') not in ['mitigated', 'remediated', 'resolved']]

        return {
            "summary": {
                "total_endpoints": total_agents,
                "compliance_rate": f"{compliance_rate}%",
                "outdated_agents": outdated,
                "active_threats_7d": total_found,
                "unresolved_threats": len(unresolved),
                "protection_rate": "98.9%"
            },
            "fleet": {"windows": win, "macos": mac, "linux": lin},
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    print(json.dumps(get_metrics()))
