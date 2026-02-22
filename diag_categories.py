import os
import re
import subprocess
from urllib.parse import urlparse


def read_database_url(env_path: str) -> str:
    with open(env_path, "r", encoding="utf-8", errors="ignore") as f:
        for line in f.read().splitlines():
            if not line.startswith("DATABASE_URL="):
                continue
            val = line.split("=", 1)[1].strip()
            # Strip wrapping quotes if present.
            if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
                val = val[1:-1]
            return val
    raise SystemExit("DATABASE_URL not found in " + env_path)


def run_mysql(host: str, port: int, user: str, password: str, db: str, sql: str) -> str:
    env = os.environ.copy()
    if password:
        # Avoid printing password; mysql reads from env.
        env["MYSQL_PWD"] = password
    cmd = ["mysql", "-h", host, "-P", str(port), "-u", user, "-D", db, "-e", sql]
    # Python 3.6 compatibility: use universal_newlines instead of text=
    r = subprocess.run(cmd, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, universal_newlines=True)
    return r.stdout


def main() -> None:
    env_path = "/www/miaoji/server/.env"
    db_url = read_database_url(env_path)
    u = urlparse(db_url)
    host = u.hostname or ""
    port = u.port or 3306
    user = u.username or ""
    password = u.password or ""
    db = (u.path or "").lstrip("/")

    print("## Part 2: DATABASE_URL evidence (masked)")
    print("host=" + host)
    print("port=" + str(port))
    print("db=" + db)
    print("")

    print("## Part 3: SQL evidence (read-only)")
    sql = (
        "SELECT DATABASE() AS db, @@hostname AS mysqlHost, @@port AS mysqlPort;\n"
        "SHOW TABLES LIKE '%category%';\n"
        "SHOW TABLES LIKE '%config%';\n"
        "SELECT COUNT(*) AS Category_exists FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='Category';\n"
        "SELECT COUNT(*) AS Config_exists FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='Config';\n"
    )
    print(run_mysql(host, port, user, password, db, sql).rstrip())
    print("")

    # Category details
    sql_cat = (
        "SELECT COUNT(*) AS cnt FROM Category;\n"
        "SELECT * FROM Category ORDER BY updatedAt DESC LIMIT 3;\n"
    )
    cat_out = run_mysql(host, port, user, password, db, sql_cat).rstrip()
    if "ERROR 1146" in cat_out or "doesn't exist" in cat_out:
        print("## Category table: NOT EXISTS")
    else:
        print("## Category table: count + latest 3")
        # crude masking for huge JSON-ish fields in row output
        cat_out = re.sub(r"\t\{.{200,}", "\t{...masked...}", cat_out)
        print(cat_out)
    print("")

    # Config details
    sql_cfg = (
        "SELECT COUNT(*) AS cnt FROM Config;\n"
        "SELECT * FROM Config ORDER BY updatedAt DESC LIMIT 3;\n"
    )
    cfg_out = run_mysql(host, port, user, password, db, sql_cfg).rstrip()
    if "ERROR 1146" in cfg_out or "doesn't exist" in cfg_out:
        print("## Config table: NOT EXISTS")
    else:
        print("## Config table: count + latest 3")
        cfg_out = re.sub(r"\t\{.{200,}", "\t{...masked...}", cfg_out)
        print(cfg_out)


if __name__ == "__main__":
    main()

