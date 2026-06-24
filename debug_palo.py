import os
import sys
import requests
import xml.etree.ElementTree as ET

FW_IP = "10.11.0.121"
USER = "svc_api_reader"
PASS = "CyberAdmin!2026"

print("=== PALO ALTO SESSION & THROUGHPUT DISCOVERY ===")

def run_session_diagnostic():
    auth_url = f"https://{FW_IP}/api/?type=keygen&user={USER}&password={PASS}"
    try:
        req = requests.get(auth_url, verify=False, timeout=10)
        if req.status_code != 200:
            print(f"[-] Auth failed: {req.status_code}")
            return
            
        root = ET.fromstring(req.content)
        api_key = root.find(".//key").text
        print("[+] Token obtained. Fetching Session & VPN Info blocks...\n")
        
        # 1. Test Session Info (Active Sessions & Throughput)
        print("=== RAW SESSION INFO XML PAYLOAD ===")
        cmd_session = "<show><session><info></info></session></show>"
        session_url = f"https://{FW_IP}/api/?type=op&cmd={cmd_session}&key={api_key}"
        session_res = requests.get(session_url, verify=False, timeout=10)
        
        # Print the XML to find the exact tags (e.g., <num-active>, <kbps>)
        print(session_res.text[:1500])
        
        # 2. Test VPN Users 
        print("\n=== RAW VPN USERS XML PAYLOAD ===")
        cmd_vpn = "<show><global-protect-gateway><current-user></current-user></global-protect-gateway></show>"
        vpn_url = f"https://{FW_IP}/api/?type=op&cmd={cmd_vpn}&key={api_key}"
        vpn_res = requests.get(vpn_url, verify=False, timeout=10)
        
        print(vpn_res.text[:1000])

    except Exception as e:
        print(f"[!] Diagnostics connection broke: {str(e)}")

if __name__ == "__main__":
    requests.packages.urllib3.disable_warnings()
    run_session_diagnostic()
