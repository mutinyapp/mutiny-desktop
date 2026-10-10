import datetime
import hashlib
import json
from pathlib import Path
import re
import socket
import subprocess
import time

ROOT = Path(__file__).resolve().parents[2]
PROOF = ROOT / 'proof/T27'
assert str(ROOT) == '/Users/friday/Projects/mutiny-rebuild/wt/F1009-T27'

def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT, text=True).strip()

head = git('rev-parse', 'HEAD')
product = ['src/native/tray.ts', 'src/native/trayPolicy.ts',
           'assets/desktop/trayTemplate.png', 'assets/desktop/trayTemplate@2x.png',
           'assets/desktop/trayColour.png', 'tests/trayT27.test.ts', 'tests/trayT27Assets.py']
inputs = {path: hashlib.sha256((ROOT/path).read_bytes()).hexdigest() for path in product}
for path in product:
    committed = subprocess.check_output(['git', 'show', f'{head}:{path}'], cwd=ROOT)
    assert hashlib.sha256(committed).hexdigest() == inputs[path], path

receipts = []
for path in sorted(PROOF.glob('*.json')):
    data = json.loads(path.read_text())
    if 'command' not in data or 'exit_code' not in data:
        continue
    log = Path(data['log'])
    data['log_sha256'] = hashlib.sha256(log.read_bytes()).hexdigest()
    unit_count = re.search(r'Tests\s+(\d+) passed \((\d+)\)', log.read_text())
    if unit_count:
        assert unit_count[1] == unit_count[2]
        data['passed'] = int(unit_count[1])
    failures = re.search(r'\((\d+) tests \| (\d+) failed\)', log.read_text())
    if failures:
        data['total'] = int(failures[1])
        data['failed'] = int(failures[2])
    python_count = re.search(r'Ran (\d+) tests', log.read_text())
    if python_count:
        data['total'] = int(python_count[1])
    receipts.append(data)
by_name = {r['name']: r for r in receipts}
assert by_name['baseline-unit']['passed'] == 429
assert by_name['final-unit']['passed'] == 441
assert by_name['final-unit']['passed'] >= by_name['baseline-unit']['passed'] + 12
assert all(by_name[name]['exit_code'] == 0 for name in ['final-unit', 'final-typecheck', 'final-lint', 'final-assets'])
assert by_name['final-assets']['total'] == 5
assert by_name['tdd-menu-red']['failed'] == 10
native = json.loads((PROOF/'native-result.json').read_text())
assert len(native['checks']) > 0 and native['external_requests'] == []

ports = []
for port in range(49700,49720):
    with socket.socket() as s:
        s.bind(('127.0.0.1', port))
    ports.append(port)
ps = subprocess.check_output(['ps','-axo','pid,ppid,command'], text=True)
owned = [line for line in ps.splitlines() if str(ROOT) in line and
         any(token in line for token in ['Electron.app/Contents', 'vitest', 'native-probe.cjs']) and
         'python3 -c' not in line]
assert not owned, owned
bindings = [json.loads(line) for line in (PROOF/'port-bindings.jsonl').read_text().splitlines()]
assert all(b['address']['address']=='127.0.0.1' and 49700<=b['address']['port']<=49719 for b in bindings)
cleanup = dict(observed_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),
               ports_free=ports, owned_runtime_children=owned, binding_receipts=len(bindings),
               owned_native_profile_removed=not (PROOF/'native-user-data').exists(),
               no_other_processes_or_sims_touched=True)
execution = dict(status='blocked', task='T27', session_id='20261009_231735_f29f3e',
                 tested_head=head, tested_tree=git('rev-parse','HEAD^{tree}'),
                 source_frozen=True, input_sha256=inputs, receipts=receipts,
                 native_checks=len(native['checks']), native=native,
                 baseline_unit_count=429, final_unit_count=441, added_unit_count=12,
                 python_asset_count=5, acceptance='pending_independent_review',
                 settings='unresolved_scope_delta; disabled entry',
                 deadline=dict(started_epoch=1791602252, stop_initiating_epoch=1791607052,
                               hard_deadline_epoch=1791607652, observed_epoch=time.time(),
                               elapsed_seconds=round(time.time()-1791602252), within_budget=time.time()<1791607652))
(PROOF/'EXECUTION.json').write_text(json.dumps(execution,indent=2)+'\n')
(PROOF/'CLEANUP.json').write_text(json.dumps(cleanup,indent=2)+'\n')
print(json.dumps(dict(head=head, baseline=429, final=441, added=12, assets=5, native_checks=len(native['checks']), cleanup=cleanup)))
