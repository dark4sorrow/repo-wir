import os
import json
import duo_client
import time
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

# Resolve the .env file one directory up from the collectors folder
env_path = Path(__file__).resolve().parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

# --- CONFIGURATION ---
IKEY = os.getenv('DUO_IKEY')
SKEY = os.getenv('DUO_SKEY')
HOST = os.getenv('DUO_HOST')

def main():
    try:
        admin_api = duo_client.Admin(ikey=IKEY, skey=SKEY, host=HOST)

        # 1. Fetch User Summary
        users = admin_api.get_users()
        total_users = len(users)
        bypass_users = len([u for u in users if u.get('status') == 'bypass'])
        
        # 2. Fetch Authentication Summary (Last 24h)
        # Confirmed via debugger: Use SECONDS for mintime
        now_ts = int(time.time())
        one_day_ago = now_ts - 86400
        
        success_auths = 0
        total_auths = 0
        
        try:
            # Fetch logs using confirmed SECONDS format
            auth_logs = admin_api.get_authentication_log(mintime=one_day_ago)
            total_auths = len(auth_logs)
            success_auths = len([log for log in auth_logs if log.get('result') == 'SUCCESS'])
        except Exception:
            pass # Fallback to 0 if log access is restricted
        
        auth_rate = "0%"
        if total_auths > 0:
            auth_rate = f"{int((success_auths / total_auths) * 100)}%"

        output = {
            "summary": {
                "total_users": total_users,
                "bypass_count": bypass_users,
                "auth_success_rate": auth_rate,
                "trust_score": "High" if bypass_users < (total_users * 0.05) else "Warning"
            },
            "status": "success",
            "timestamp": datetime.now().isoformat()
        }
        print(json.dumps(output))

    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    main()
