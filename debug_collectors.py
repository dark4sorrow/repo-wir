import os
import json
import requests
import urllib3
import duo_client
import time
from tenable.sc import TenableSC
from datetime import datetime

# Disable SSL warnings
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

def header(text):
    print(f"\n{'='*60}")
    print(f" DEBUG: {text}")
    print(f"{'='*60}")

def test_duo():
    header("DUO SECURITY API TEST")
    ikey = "DIUFE8N40IMC2NUP6IC1"
    skey = "D9Rjy5r338tQDzbCUN4oGEIhpbnmTRTNLBaTpkt4"
    host = "api-ab0ba84a.duosecurity.com"
    
    print(f"[*] Target Host: {host}")
    
    try:
        print("[*] Initializing Duo Admin Client...")
        admin_api = duo_client.Admin(ikey=ikey, skey=skey, host=host)
        
        # Test 1: Basic Users (Confirmed working previously)
        print("[*] Testing get_users()...")
        users = admin_api.get_users()
        print(f"[+] SUCCESS: Found {len(users)} users.")
        
        # Test 2: Authentication Logs (The 400 Error Culprit)
        # We will try the most conservative timestamp first (last 1 hour in seconds)
        now_ts = int(time.time())
        mintime_seconds = now_ts - 3600
        
        print(f"[*] Testing get_authentication_log with mintime={mintime_seconds} (Seconds)...")
        try:
            logs = admin_api.get_authentication_log(mintime=mintime_seconds, limit=10)
            print(f"[+] SUCCESS: Retrieved {len(logs)} logs using SECONDS.")
        except Exception as e:
            print(f"[-] FAILED with Seconds: {str(e)}")
            
            # Fallback: Try Milliseconds
            mintime_ms = mintime_seconds * 1000
            print(f"[*] Retrying with mintime={mintime_ms} (Milliseconds)...")
            try:
                logs = admin_api.get_authentication_log(mintime=mintime_ms, limit=10)
                print(f"[+] SUCCESS: Retrieved {len(logs)} logs using MILLISECONDS.")
            except Exception as e2:
                print(f"[!!] CRITICAL DUO ERROR: Both time formats failed. Error: {str(e2)}")

    except Exception as e:
        print(f"[!] GENERAL DUO ERROR: {str(e)}")

def test_tenable():
    header("TENABLE.SC API TEST")
    host = "secten.nic.edu"
    access_key = "edfbf6e170d44c8f92ba3ecc8655830c"
    secret_key = "7f2ac2e2e32b4a19bd029d2107d6ce7d"
    
    try:
        url = f"https://{host}"
        print(f"[*] Connecting to Tenable.sc at {url}...")
        sc = TenableSC(url=url, access_key=access_key, secret_key=secret_key, ssl_verify=False)
        
        print("[*] Fetching severity summary...")
        sev_query = {
            "query": {"tool": "sumseverity", "type": "vuln", "sourceType": "cumulative"},
            "sourceType": "cumulative", "type": "vuln", "tool": "sumseverity"
        }
        res = sc.post('analysis', json=sev_query).json()
        
        if 'response' in res:
            results = res['response'].get('results', [])
            print(f"[+] SUCCESS: Found summary data with {len(results)} severity tiers.")
            for r in results:
                print(f"    - {r.get('severity', {}).get('name')}: {r.get('count')}")
        else:
            print(f"[!] UNEXPECTED RESPONSE: {json.dumps(res)}")

    except Exception as e:
        print(f"[!] TENABLE ERROR: {str(e)}")

if __name__ == "__main__":
    print(f"WiR Debugger v2 Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    test_duo()
    test_tenable()
    print("\n--- Debug Session Complete ---")
