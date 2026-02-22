import os
import subprocess
from datetime import datetime
from urllib.parse import urlparse


def read_database_url(env_path: str) -> str:
    with open(env_path, "r", encoding="utf-8", errors="ignore") as f:
        for line in f.read().splitlines():
            if not line.startswith("DATABASE_URL="):
                continue
            val = line.split("=", 1)[1].strip()
            if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
                val = val[1:-1]
            return val
    raise SystemExit("DATABASE_URL not found in " + env_path)


def run(cmd, env=None) -> str:
    r = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, env=env, universal_newlines=True)
    if r.returncode != 0:
        raise SystemExit("command failed: " + " ".join(cmd) + "\n" + r.stdout)
    return r.stdout


def mysql_cmd(u, dbname: str):
    host = u.hostname or "127.0.0.1"
    port = u.port or 3306
    user = u.username or "root"
    pwd = u.password or ""
    env = os.environ.copy()
    if pwd:
        env["MYSQL_PWD"] = pwd  # do not print
    base = ["mysql", "-h", host, "-P", str(port), "-u", user, dbname, "-e"]
    return base, env


def main():
    env_path = "/www/miaoji/server/.env"
    db_url = read_database_url(env_path)
    u = urlparse(db_url)
    dbname = (u.path or "").lstrip("/") or "miaoji"

    ts = datetime.now().strftime("%F_%H%M%S")
    backup = f"/root/backup_banner_{ts}.sql"

    # 0) Backup only Banner table (schema+data)
    host = u.hostname or "127.0.0.1"
    port = u.port or 3306
    user = u.username or "root"
    pwd = u.password or ""
    env = os.environ.copy()
    if pwd:
        env["MYSQL_PWD"] = pwd
    dump_cmd = ["mysqldump", "-h", host, "-P", str(port), "-u", user, dbname, "Banner"]
    with open(backup, "w", encoding="utf-8") as f:
        r = subprocess.run(dump_cmd, stdout=f, stderr=subprocess.PIPE, env=env, universal_newlines=True)
    if r.returncode != 0:
        raise SystemExit("mysqldump failed:\n" + (r.stderr or ""))

    print("BACKUP_FILE=" + backup)

    base, env2 = mysql_cmd(u, dbname)

    print("\n--- BEFORE: SHOW FULL COLUMNS FROM Banner ---")
    print(run(base + ["SHOW FULL COLUMNS FROM Banner;"], env=env2).rstrip())

    print("\n--- ALTER: targetId -> varchar(191) NULL ---")
    print(run(base + ["ALTER TABLE Banner MODIFY COLUMN targetId varchar(191) NULL;"], env=env2).rstrip())

    print("\n--- AFTER: SHOW FULL COLUMNS FROM Banner ---")
    print(run(base + ["SHOW FULL COLUMNS FROM Banner;"], env=env2).rstrip())


if __name__ == "__main__":
    main()

