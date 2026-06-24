import os
import requests
import json
import csv
import io
import datetime
import openpyxl
from pathlib import Path
from dotenv import load_dotenv

# Resolve the .env file one directory up from the collectors folder
env_path = Path(__file__).resolve().parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

DOMAIN = os.getenv('VARONIS_DOMAIN')
API_KEY = os.getenv('VARONIS_API_KEY')

def get_access_token():
    url = f"https://{DOMAIN}/api/authentication/api_keys/token"
    headers = {"x-api-key": API_KEY, "Content-Type": "application/x-www-form-urlencoded"}
    body = {"grant_type": "varonis_custom"}
    try:
        res = requests.post(url, headers=headers, data=body, timeout=15)
        return res.json().get("access_token") if res.status_code == 200 else None
    except Exception as e:
        return None

def get_data_from_url(url, token):
    headers = {"Authorization": f"Bearer {token}"}
    try:
        res = requests.get(url, headers=headers, timeout=30)
        if res.status_code != 200:
            return []
        
        # Check if Excel (XLSX)
        if res.content.startswith(b'\x50\x4b\x03\x04'):
            wb = openpyxl.load_workbook(io.BytesIO(res.content))
            sheet = wb.active
            rows = list(sheet.values)
            if not rows:
                return []
            h = rows[0]
            return [dict(zip(h, row)) for row in rows[1:]]
        # Otherwise treat as CSV
        else:
            content = res.content.decode('utf-8-sig', errors='replace')
            return list(csv.DictReader(io.StringIO(content)))
    except Exception as e:
        return []

def main():
    token = get_access_token()
    if not token:
        print(json.dumps({"error": "Authentication failed"})); return

    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    query = {"query": "query { scheduledSearchExecutions(scheduledSearchIds: [1, 4]) { status time scheduledSearch { id } results { containsData dataUrl } } }"}

    try:
        res = requests.post(f"https://{DOMAIN}/api/graphql", headers=headers, json=query, timeout=20)
        data = res.json()
        executions = data.get('data', {}).get('scheduledSearchExecutions', [])
        
        def get_latest(sid):
            runs = [e for e in executions if e['scheduledSearch']['id'] == str(sid) and e['status'] == 'SUCCESS']
            if not runs: return None
            return sorted(runs, key=lambda x: x['time'], reverse=True)[0]

        hi, closed, fti, cid, exp = 0, 0, 0, 0, 0

        # Process Search ID 1 (Alerts)
        run1 = get_latest(1)
        if run1:
            alerts = []
            for r in run1['results']:
                alerts.extend(get_data_from_url(r['dataUrl'], token))
            hi = len([a for a in alerts if str(a.get('Alert severity')) == 'High'])
            closed = len([a for a in alerts if str(a.get('Status')) == 'Closed'])

        # Process Search ID 4 (Sensitive Data)
        run4 = get_latest(4)
        if run4:
            files = []
            for r in run4['results']:
                files.extend(get_data_from_url(r['dataUrl'], token))
            
            triggers = ['Tax', 'FTI', 'GLBA', '1040', 'FAFSA', 'SSN', 'Credit Card', 'PCI', 'Income']
            fti = len([f for f in files if any(w in str(f.get('Classification results')) for w in triggers)])
            cid = len([f for f in files if 'Colleague ID' in str(f.get('Classification results'))])
            exp = len([f for f in files if 'Organization-wide' in str(f.get('Exposure level'))])

        # VELOCITY CALCULATION
        velocity = "0%"
        if hi > 0:
            calc = (closed / hi) * 100
            velocity = f"{round(calc, 1)}%"

        print(json.dumps({
            "summary": {
                "high_alerts": hi,
                "exposed_files": exp,
                "fti_risks": fti,
                "cid_risks": cid,
                "resolved_cases": closed,
                "closure_velocity": velocity
            },
            "status": "success",
            "timestamp": datetime.datetime.now().isoformat()
        }))

    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    main()
