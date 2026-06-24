import os
import json
import duo_client
import time
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

env_path = Path(__file__).resolve().parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

IKEY = os.getenv('DUO_IKEY')
SKEY = os.getenv('DUO_SKEY')
HOST = os.getenv('DUO_HOST')

def main():
    # Initialize output container
    output = {
        "summary": {"total_users": 0, "bypass_count": 0, "auth_success_rate": "0%", "trust_score": "Unknown"},
        "status": "error",
        "timestamp": datetime.now().isoformat()
    }

    try:
        admin_api = duo_client.Admin(ikey=IKEY, skey=SKEY, host=HOST)

        # 1. Fetch Users
        users = admin_api.get_users()
        total_users = len(users)
        bypass_users = len([u for u in users if u.get('status') == 'bypass'])
        
        # 2. Fetch Auth Logs (v2 requires milliseconds)
        now_ms = int(time.time() * 1000)
        one_day_ago_ms = now_ms - 86400000
        
        success_auths = 0
        total_auths = 0
        
        try:
            # v2 call requires api_version=2
            response = admin_api.get_authentication_log(api_version=2, mintime=one_day_ago_ms)
            # Response is a dict: {'authlogs': [...], 'metadata': {...}}
            auth_logs = response.get('authlogs', [])
            total_auths = len(auth_logs)
            success_auths = len([log for log in auth_logs if log.get('result') == 'SUCCESS'])
        except Exception:
            pass # Keep defaults if logs fail
        
        auth_rate = "0%"
        if total_auths > 0:
            auth_rate = f"{int((success_auths / total_auths) * 100)}%"

        output["summary"] = {
            "total_users": total_users,
            "bypass_count": bypass_users,
            "auth_success_rate": auth_rate,
            "trust_score": "High" if bypass_users < (total_users * 0.05) else "Warning"
        }
        output["status"] = "success"

    except Exception as e:
        output["error"] = str(e)

    # FINAL GUARANTEE: Only print pure JSON
    print(json.dumps(output))

if __name__ == "__main__":
    main()