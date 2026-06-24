import requests
import json
import os
from datetime import datetime, timedelta
from pathlib import Path
from dotenv import load_dotenv

# Resolve the .env file one directory up from the collectors folder
env_path = Path(__file__).resolve().parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

# CREDENTIALS PULLED SECURELY FROM .ENV
TDX_DOMAIN = os.getenv("TDX_DOMAIN")
TDX_BEID = os.getenv("TDX_BEID")
TDX_USERNAME = os.getenv("TDX_USERNAME")
TDX_PASSWORD = os.getenv("TDX_PASSWORD")
TDX_APP_ID = os.getenv("TDX_APP_ID")

def get_metrics():
    try:
        # 1. AUTHENTICATION
        auth_url = f"https://{TDX_DOMAIN}/TDWebApi/api/auth/login"
        auth_payload = {"UserName": TDX_USERNAME, "Password": TDX_PASSWORD}
        auth_headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "X-TD-BEID": TDX_BEID
        }
        
        auth_res = requests.post(auth_url, json=auth_payload, headers=auth_headers, timeout=15)
        auth_res.raise_for_status()
        token = auth_res.text.strip('"')

        # 2. DATA SEARCH HEADERS
        search_url = f"https://{TDX_DOMAIN}/TDWebApi/api/{TDX_APP_ID}/tickets/search"
        search_headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "X-TD-BEID": TDX_BEID
        }

        # 3. CALCULATE CLOSED COUNTS (24h, 7d, 30d)
        closed_payload = {
            "IsCreatedDateSearch": False,
            "IsModifiedDateSearch": False,
            "IsResolvedDateSearch": False,
            "IsCompletedDateSearch": False,
            "StatusClassNames": ["Completed", "Resolved", "Closed", "Cancelled"],
            "MaxResults": 10000
        }
        
        closed_res = requests.post(search_url, json=closed_payload, headers=search_headers, timeout=30)
        closed_res.raise_for_status()
        all_closed = closed_res.json()

        now = datetime.now()
        d1 = now - timedelta(days=1)
        d7 = now - timedelta(days=7)
        d30 = now - timedelta(days=30)
        
        c1, c7, c30 = 0, 0, 0

        def parse_date(d_str):
            if not d_str: return None
            try: return datetime.fromisoformat(d_str.replace('Z', ''))
            except: return None

        for t in all_closed:
            comp_date = parse_date(t.get('CompletedDate'))
            res_date = parse_date(t.get('ResolvedDate'))
            
            # Use whichever date is available/more recent
            check_date = comp_date or res_date
            if check_date:
                if check_date >= d1: c1 += 1
                if check_date >= d7: c7 += 1
                if check_date >= d30: c30 += 1

        # 4. GET GROUP DISTRIBUTION (OPEN TICKETS)
        group_counts = {}
        open_payload = {"IsClosed": False, "MaxResults": 500}
        open_res = requests.post(search_url, json=open_payload, headers=search_headers, timeout=15)
        
        if open_res.status_code == 200:
            for t in open_res.json():
                g_name = t.get('ResponsibleGroupName') or "Unassigned"
                group_counts[g_name] = group_counts.get(g_name, 0) + 1

        # 5. FINAL WIR PAYLOAD
        return {
            "summary": {
                "closed_24h": c1,
                "throughput_weekly": c7,
                "throughput_monthly": c30,
                "active_efficiency": f"{round(c1/8, 1)}/hr" if c1 > 0 else "0.0/hr"
            },
            "groups": group_counts,
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    print(json.dumps(get_metrics()))
