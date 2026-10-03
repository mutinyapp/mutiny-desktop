import argparse, datetime, hashlib, json, os, subprocess, sys, time
from pathlib import Path
parser = argparse.ArgumentParser()
parser.add_argument('name'); parser.add_argument('--cwd', default=str(Path(__file__).resolve().parents[2])); parser.add_argument('command', nargs=argparse.REMAINDER)
a = parser.parse_args(); cmd = a.command[1:] if a.command[:1] == ['--'] else a.command
proof = Path(__file__).resolve().parent / 'receipts'; proof.mkdir(exist_ok=True)
start = time.time(); run = subprocess.run(cmd, cwd=a.cwd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
log = proof / (a.name + '.log'); log.write_bytes(run.stdout)
receipt = {'name': a.name, 'argv': cmd, 'cwd': a.cwd, 'startedUTC': datetime.datetime.fromtimestamp(start, datetime.timezone.utc).isoformat(), 'elapsedSeconds': round(time.time()-start, 3), 'exit': run.returncode, 'log': log.name, 'logSHA256': hashlib.sha256(run.stdout).hexdigest(), 'env': {k:os.environ.get(k) for k in ['TMPDIR','NODE_OPTIONS','ELECTRON_CACHE','npm_config_cache','XDG_CACHE_HOME']}}
(proof / (a.name + '.json')).write_text(json.dumps(receipt, indent=2)+'\n'); print(json.dumps(receipt,indent=2)); print(run.stdout.decode(errors='replace')); sys.exit(run.returncode)
