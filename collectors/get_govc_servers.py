import subprocess
import json
import os
from datetime import datetime

# Reverted to the original Docker volume map paths
GOVC_PATH = "/data/govc/govc"
ENV_PATH = "/data/govc/govc.env"
VM_JSON_PATH = "/data/govc/vms.json"

def get_govc_env():
    env_vars = os.environ.copy()
    try:
        with open(ENV_PATH, 'r') as f:
            for line in f:
                if line.startswith('export '):
                    key_val = line.replace('export ', '').strip().split('=')
                    if len(key_val) == 2:
                        env_vars[key_val[0]] = key_val[1].strip("'\"")
    except Exception:
        return None
    return env_vars

def run_govc_cmd(args, env):
    try:
        result = subprocess.run([GOVC_PATH] + args, env=env, capture_output=True, text=True, timeout=15)
        return result.stdout
    except Exception as e:
        return str(e)

def main():
    env = get_govc_env()
    
    raw_vms = ""
    if env and os.path.exists(GOVC_PATH):
        raw_vms = run_govc_cmd(["ls", "-json", "/SDC/vm"], env)
    
    try:
        with open(VM_JSON_PATH, "r") as f:
            vms = json.load(f)
    except:
        vms = []

    if not vms and not raw_vms:
         print(json.dumps({"error": f"No VM data found locally. Missing {VM_JSON_PATH}"}))
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
