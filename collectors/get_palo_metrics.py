import os
import sys
import json
import requests
import xml.etree.ElementTree as ET
import datetime
from pathlib import Path
from dotenv import load_dotenv

# Resolve the .env file one directory up from the collectors folder
env_path = Path(__file__).resolve().parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

FW_IP = os.getenv('PAN_IP')
USER = os.getenv('PAN_USER')
PASS = os.getenv('PAN_PASS')

def get_api_key():
    auth_url = f"https://{FW_IP}/api/?type=keygen&user={USER}&password={PASS}"
    try:
        res = requests.get(auth_url, verify=False, timeout=10)
        if res.status_code == 200:
            root = ET.fromstring(res.content)
            key_node = root.find(".//key")
            if key_node is not None:
                return key_node.text
    except Exception as e:
        sys.stderr.write(f"Auth failed: {str(e)}\n")
    return None

def fetch_command_xml(cmd, api_key):
    url = f"https://{FW_IP}/api/?type=op&cmd={cmd}&key={api_key}"
    try:
        res = requests.get(url, verify=False, timeout=10)
        if res.status_code == 200:
            return ET.fromstring(res.content)
    except Exception as e:
        sys.stderr.write(f"Command error {cmd}: {str(e)}\n")
    return None

def main():
    api_key = get_api_key()
    if not api_key:
        print(json.dumps({"error": "Failed to authenticate with Firewall Management"}))
        return

    # Base baseline values
    sessions = 0
    throughput = "0"
    vpn_users = 0
    threats = 0  # Threat queries require heavy log parsing; defaulting to 0 for performance
    log_disk = "0%"
    ha_state = "N/A"

    # Query 1: Session Info (Active Sessions & Throughput)
    session_root = fetch_command_xml("<show><session><info></info></session></show>", api_key)
    if session_root is not None:
        active_node = session_root.find(".//num-active")
        if active_node is not None and active_node.text:
            sessions = int(active_node.text)
            
        kbps_node = session_root.find(".//kbps")
        if kbps_node is not None and kbps_node.text:
            # Convert Kbps to Mbps for the dashboard display
            throughput = str(int(kbps_node.text) // 1000)

    # Query 2: High Availability State
    ha_root = fetch_command_xml("<show><high-availability><state></state></high-availability></show>", api_key)
    if ha_root is not None:
        state_node = ha_root.find(".//group/local-info/state")
        if state_node is not None and state_node.text:
            ha_state = state_node.text.upper()

    # Query 3: Disk Space (Requires CDATA terminal parsing)
    disk_root = fetch_command_xml("<show><system><disk-space></disk-space></system></show>", api_key)
    if disk_root is not None:
        result_text = disk_root.find(".//result")
        if result_text is not None and result_text.text:
            # Parse the CDATA Linux output line by line looking for panlogs
            for line in result_text.text.strip().split("\n"):
                if "/opt/panlogs" in line:
                    parts = line.split()
                    if len(parts) >= 5:
                        log_disk = parts[4]

    # Query 4: GlobalProtect VPN Users
    vpn_root = fetch_command_xml("<show><global-protect-gateway><current-user></current-user></global-protect-gateway></show>", api_key)
    if vpn_root is not None:
        result_node = vpn_root.find(".//result")
        if result_node is not None:
            # If users exist, they are listed as <entry> elements. 
            # If the result block is completely empty, it means 0 users.
            entries = result_node.findall(".//entry")
            if entries:
                vpn_users = len(entries)

    print(json.dumps({
        "summary": {
            "active_sessions": sessions,
            "throughput_mbps": throughput,
            "vpn_users": vpn_users,
            "threat_events": threats,
            "log_disk": log_disk,
            "ha_status": ha_state
        },
        "status": "success",
        "timestamp": datetime.datetime.now().isoformat()
    }))

if __name__ == "__main__":
    # Suppress insecure HTTPS warnings for local internal IPs
    requests.packages.urllib3.disable_warnings()
    main()
