import subprocess
import json
import os
from datetime import datetime

# Pathing configuration for OpenShift volume space
BASE_DIR = "/data/govc"
GOVC_PATH = os.path.join(BASE_DIR, "govc")
VM_JSON_PATH = os.path.join(BASE_DIR, "vms.json")

def ensure_dir(file_path):
    directory = os.path.dirname(file_path)
    if not os.path.exists(directory):
        os.makedirs(directory)

def run_govc_cmd(args, env):
    try:
        # Executes the local govc binary using environment credentials
        result = subprocess.run([GOVC_PATH] + args, env=env, capture_output=True, text=True, timeout=15)
        if result.returncode == 0:
            return result.stdout
    except Exception:
        pass
    return ""

def main():
    ensure_dir(VM_JSON_PATH)
    
    # Securely inherit the bulk variables injected from the wir-env-secrets map
    env = os.environ.copy()
    
    raw_vms = ""
    if os.path.exists(GOVC_PATH):
        raw_vms = run_govc_cmd(["ls", "-json", "/SDC/vm"], env)
    
    vms = []
    
    # If we successfully pulled fresh data from vCenter, parse it and update the cache
    if raw_vms:
        try:
            live_data = json.loads(raw_vms)
            # Handle both a direct list or a nested elements structure if wrapped by govc output
            if isinstance(live_data, list):
                vms = live_data
            elif isinstance(live_data, dict) and "elements" in live_data:
                vms = live_data["elements"]
            
            # Rebuild and write the cache file from scratch
            with open(VM_JSON_PATH, "w") as f:
                json.dump(vms, f, indent=4)
        except Exception:
            pass

    # Fallback: If live data query failed, try loading from existing file cache
    if not vms:
        try:
            with open(VM_JSON_PATH, "r") as f:
                vms = json.load(f)
        except Exception:
            vms = []

    # If both live pull and cache fallback fail, return an explicit error
    if not vms:
        print(json.dumps({"error": f"No VM data available. Live query failed and missing {VM_JSON_PATH}"}))
        return

    total_vms = len(vms)
    powered_on = len([v for v in vms if v.get('power') == 'poweredOn'])
    legacy_nodes = [v['name'] for v in vms if "Solaris 10" in v.get('os', '') or "2008 R2" in v.get('os', '')]

    output = {
        "summary": {
            "total": total_vms,
            "powered_on": powered_on,
            "powered_off": total_vms - powered_on,
            "integrity_score": f"{round((powered_on / total_vms) * 100, 1)}%" if total_vms > 0 else "0%"
        },
        "risk_factors": {
            "legacy_os_count": len(legacy_nodes),
            "flagged_nodes": legacy_nodes[:5] 
        },
        "timestamp": datetime.now().isoformat()
    }

    print(json.dumps(output))

if __name__ == "__main__":
    main()