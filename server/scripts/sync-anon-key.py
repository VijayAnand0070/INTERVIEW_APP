from pathlib import Path

server_env = Path(__file__).resolve().parents[1] / ".env"
client_env = Path(__file__).resolve().parents[2] / "client" / ".env"


def read_env(path):
    data = {}
    if not path.exists():
        return data
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        data[key.strip()] = value.strip()
    return data


client = read_env(client_env)
anon = client.get("VITE_SUPABASE_ANON_KEY")
if not anon:
    raise SystemExit("client/.env missing VITE_SUPABASE_ANON_KEY")

text = server_env.read_text(encoding="utf-8") if server_env.exists() else ""
if "SUPABASE_ANON_KEY=" in text:
  print("SUPABASE_ANON_KEY already present")
  raise SystemExit(0)

if text and not text.endswith("\n"):
    text += "\n"
text += f"SUPABASE_ANON_KEY={anon}\n"
server_env.write_text(text, encoding="utf-8")
print("Added SUPABASE_ANON_KEY to server/.env")
