import os
import sys
import requests
import json

VBR_URL = "https://10.1.32.195:9419/api"
USERNAME = r"NIC\svc_veeam_report"
PASSWORD = "Gvm@thnf0"
API_VERSION = "1.2-rev0"

print("=== VEEAM PAGINATION & DATA AUDIT ===")

def fetch_all_pages(session, endpoint):
    all_data = []
    limit = 100
    skip = 0
    
    while True:
        url = f"{VBR_URL}{endpoint}?limit={limit}&skip={skip}"
        res = session.get(url, timeout=15)
        if res.status_code != 200:
            print(f"   [!] Error fetching {url}: {res.status_code}")
            break
        
        payload = res.json()
        data_chunk = payload.get("data", [])
        all_data.extend(data_chunk)
        
        # Check Veeam's pagination metadata
        meta = payload.get("meta", {})
        paging = meta.get("pagingInfo", {})
        total = paging.get("total", len(all_data))
        
        # If we've pulled all records, or the chunk is empty, break the loop
        if len(all_data) >= total or not data_chunk:
            break
            
        skip += limit
        
    return all_data

def run_deep_audit():
    session = requests.Session()
    session.verify = False

    auth_url = f"{VBR_URL}/oauth2/token"
    headers = {
        "x-api-version": API_VERSION,
        "Content-Type": "application/x-www-form-urlencoded"
    }
    payload = {"grant_type": "password", "username": USERNAME, "password": PASSWORD}

    try:
        res = session.post(auth_url, data=payload, headers=headers, timeout=10)
        if res.status_code != 200:
            print(f"[-] Auth failed: {res.text}")
            return

        token = res.json().get("access_token")
        session.headers.update({
            "Authorization": f"Bearer {token}",
            "x-api-version": API_VERSION,
            "Accept": "application/json"
        })
        
        print("[+] Token secured. Fetching full paginated datasets...\n")

        # 1. Fetch ALL Backup Objects
        print("-> Fetching /v1/backupObjects (Handling Pagination)...")
        all_objects = fetch_all_pages(session, "/v1/backupObjects")
        
        vms_protected = len(all_objects)
        total_restore_points = sum(obj.get("restorePointsCount", 0) for obj in all_objects)
        
        # Breakdown by platform to map against your screenshot
        platforms = {}
        for obj in all_objects:
            plat = obj.get("platformName", "Unknown")
            platforms[plat] = platforms.get(plat, 0) + 1

        print(f"   [OK] Total Objects Pulled: {vms_protected}")
        print(f"   [OK] Platform Breakdown: {platforms}")

        # 2. Fetch ALL Backups
        print("\n-> Fetching /v1/backups (Handling Pagination)...")
        all_backups = fetch_all_pages(session, "/v1/backups")
        
        repo_ids = set(b.get("repositoryId") for b in all_backups if b.get("repositoryId"))
        unique_repositories = len(repo_ids)
        
        print(f"   [OK] Total Backups Pulled: {len(all_backups)}")
        print(f"   [OK] Unique Repositories: {unique_repositories}")

        print("\n=== RECALCULATED DASHBOARD METRICS ===")
        print(f" VMS PROTECTED    : {vms_protected}")
        print(f" REPOSITORIES     : {unique_repositories}")
        print(f" RESTORE POINTS   : {total_restore_points}")

    except Exception as e:
        print(f"[!] Diagnostics connection broke: {str(e)}")

if __name__ == "__main__":
    requests.packages.urllib3.disable_warnings()
    run_deep_audit()
