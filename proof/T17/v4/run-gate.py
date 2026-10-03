import json
from pathlib import Path
import subprocess
import sys
import time
root = Path(__file__).resolve().parents[3]
name = sys.argv[1]
command = sys.argv[2:]
start = time.monotonic()
result = subprocess.run(command, cwd=root, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
proof = root / "proof/T17/v4"
(proof / f"{name}.log").write_text(result.stdout)
receipt = {"command": command, "exit": result.returncode, "elapsedSeconds": round(time.monotonic() - start, 3)}
(proof / f"{name}.json").write_text(json.dumps(receipt, indent=2) + "\n")
print(result.stdout)
print(json.dumps(receipt))
sys.exit(result.returncode)
