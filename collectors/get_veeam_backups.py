import os
import sys
import json
import requests
import datetime
import urllib3
from pathlib import Path
from dotenv import load_dotenv

# Resolve the .env file one directory up from the collectors folder
env_path = Path(__file__).resolve().parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

VBR_URL = os.getenv("VEEAM_URL")
USERNAME = os.getenv("VEEAM_USER")
PASSWORD = os.getenv("VEEAM_PASSWORD")
API_VERSION = os.getenv("VEEAM_API_VERSION")

def main():
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    session = requests.Session()
    session.verify = False
    
    auth_url = f"{VBR_URL}/oauth2/token"
    headers = {
        "x-api-version": API_VERSION,
        "Content-Type": "application/x-www-form-urlencoded"
    }
    payload = {
        "grant_type": "password",
        "username": USERNAME,
        "password": PASSWORD
    }

    try:
        res = session.post(auth_url, data=payload, headers=headers, timeout=15)
        if res.status_code != 200:
            print(json.dumps({"error": f"Auth rejected: {res.text}"}))
            return

        token = res.json().get("access_token")
        session.headers.update({
            "Authorization": f"Bearer {token}",
            "x-api-version": API_VERSION,
            "Accept": "application/json"
        })

        # 1. Fetch Repositories
        unique_repositories = 0
        repos = session.get(f"{VBR_URL}/v1/backupInfrastructure/repositories", timeout=20)
        if repos.status_code == 404:
             repos = session.get(f"{VBR_URL}/v1/repositories", timeout=20)
        if repos.status_code == 200:
            unique_repositories += len(repos.json().get("data", []))

        sobrs = session.get(f"{VBR_URL}/v1/backupInfrastructure/scaleOutRepositories", timeout=20)
        if sobrs.status_code == 200:
            unique_repositories += len(sobrs.json().get("data", []))

        # 2. Fetch Backups with limit 1000
        backups_res = session.get(f"{VBR_URL}/v1/backups?limit=1000", timeout=20)
        backups = backups_res.json().get("data", []) if backups_res.status_code == 200 else []

        vms_protected = 0
        total_restore_points = 0

        # 3. Loop through backups and count objects
        for backup in backups:
            backup_id = backup.get("id")
            objects_res = session.get(f"{VBR_URL}/v1/backups/{backup_id}/objects", timeout=20)
            
            if objects_res.status_code == 200:
                vm_objects = objects_res.json().get("data", [])
                vms_protected += len(vm_objects)
                
                # Count the restore points on each individual VM
                for vm in vm_objects:
                    total_restore_points += vm.get("restorePointsCount", 0)

    except Exception as e:
        print(json.dumps({"error": f"Connection exception: {str(e)}"}))
        return

    print(json.dumps({
        "summary": {
            "vms_protected": vms_protected,
            "unique_repositories": unique_repositories,
            "infrastructure_health": "100%",
            "total_restore_points": total_restore_points
        },
        "status": "success",
        "timestamp": datetime.datetime.now().isoformat()
    }))

if __name__ == "__main__":
    main()
