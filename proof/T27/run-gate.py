import datetime
import json
import os
from pathlib import Path
import subprocess
import sys
import time

root = Path(__file__).resolve().parent
name, *command = sys.argv[1:]
env = os.environ.copy()
env['PATH'] = '/Users/friday/.hermes/profiles/friday/node/bin:' + env['PATH']
env['NODE_OPTIONS'] = (env.get('NODE_OPTIONS', '') + ' --require=' + str(root / 'port-guard.cjs')).strip()
started = time.time()
if started >= 1791607052:
    raise SystemExit('80-minute initiation cutoff reached')
with (root / (name + '.log')).open('w') as log:
    result = subprocess.run(command, cwd=root.parents[1], env=env, stdout=log, stderr=subprocess.STDOUT)
receipt = dict(name=name, command=command, exit_code=result.returncode, started_at=datetime.datetime.fromtimestamp(started, datetime.timezone.utc).isoformat(), ended_at=datetime.datetime.now(datetime.timezone.utc).isoformat(), elapsed_seconds=round(time.time()-started, 3), log=str(root / (name + '.log')))
(root / (name + '.json')).write_text(json.dumps(receipt, indent=2)+'\n')
print(json.dumps(receipt))
sys.exit(result.returncode)
