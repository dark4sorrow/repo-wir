import os
import sys
import requests
import urllib3
import json

WUG_URL = "https://10.1.5.254:9644/api/v1"
CREDS = {
    "grant_type": "password",
    "username": "svc_dashboard_api",
    "password": "Pr3d2t0r"
}

print("=== WHATSUP GOLD PAGINATION & STATE AUDIT ===")

def run_wug_audit():
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    session = requests.Session()
    session.verify = False
    
    # 1. Fetch Auth Token
    print("[*] Retrieving access token from WUG gateway...")
    try:
        auth_res = session.post(f"{WUG_URL}/token", data=CREDS, timeout=10)
        if auth_res.status_code != 200:
            print(f"[-] Auth failed: {auth_res.text}")
            return
            
        token = auth_res.json().get("access_token")
        session.headers.update({"Authorization": f"Bearer {token}", "Accept": "application/json"})
        print("[+] Authentication verified.\n")
        
        # 2. Iterate through group -2 devices via pagination mapping loop
        print("[*] Pulling records from root group (-2) with pagination...")
        raw_devices = []
        next_page = "0"
        page_count = 0
        
        while next_page is not None:
            page_count += 1
            url = f"{WUG_URL}/device-groups/-2/devices?pageId={next_page}"
            res = session.get(url, timeout=15)
            
            if res.status_code != 200:
                print(f"   [!] Failed on page {page_count}: {res.status_code}")
                break
                
            payload = res.json()
            devices_chunk = payload.get("data", {}).get("devices", [])
            raw_devices.extend(devices_chunk)
            
            # Step to the next page marker token string
            next_page = payload.get("paging", {}).get("nextPageId")
            
        print(f"[+] Data collection complete. Visited {page_count} pages.")
        print(f"[+] Total raw network nodes recovered: {len(raw_devices)}")
        
        # 3. Calculate status distributions to match your screenshot
        up_count = len([d for d in raw_devices if d.get('bestState') == 'Up'])
        down_count = len([d for d in raw_devices if d.get('bestState') == 'Down'])
        maint_count = len([d for d in raw_devices if d.get('bestState') == 'Maintenance'])
        unknown_count = len([d for d in raw_devices if d.get('bestState') == 'Unknown'])
        
        print("\n=== VERIFIED SOURCE METRICS ===")
        print(f" UP DEVICES   : {up_count}")
        print(f" DOWN DEVICES : {down_count}")
        print(f" MAINTENANCE  : {maint_count}")
        print(f" UNKNOWN      : {unknown_count}")
        print(f" TOTAL NODES  : {len(raw_devices)}")

    except Exception as e:
        print(f"[!] Diagnostics path failure: {str(e)}")

if __name__ == "__main__":
    run_wug_audit()
