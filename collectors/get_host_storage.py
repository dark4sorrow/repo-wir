import json
import os
from datetime import datetime

# Reverted to the original Docker volume map path
HOSTS_DATA_PATH = "/data/host/output/hosts_data.json"

def main():
    if not os.path.exists(HOSTS_DATA_PATH):
        print(json.dumps({"error": f"Host data not found at {HOSTS_DATA_PATH}"}))
        return

    try:
        with open(HOSTS_DATA_PATH, 'r') as f:
            data = json.load(f)
            
        hosts = data.get("hosts", [])
        total = len(hosts)
        online = len([h for h in hosts if h.get("status") == "online"])
        offline = total - online
        
        missing_edr = len([h for h in hosts if h.get("edr") in ["Unknown", "nan", ""]])

        output = {
            "summary": {
                "total_assets": total,
                "online_status": f"{online} Online / {offline} Offline",
                "availability_pct": f"{round((online / total * 100), 1)}%" if total > 0 else "0%",
                "missing_edr_count": missing_edr
            },
            "risk_highlights": {
                "source_file": data.get("filename", "Unknown"),
                "last_scan": data.get("last_updated")
            },
            "timestamp": datetime.now().isoformat()
        }
        print(json.dumps(output))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    main()
