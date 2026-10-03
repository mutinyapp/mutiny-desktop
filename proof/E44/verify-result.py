import hashlib, json, re, socket, subprocess
from pathlib import Path
root = Path(__file__).resolve().parents[2]
proof = Path(__file__).resolve().parent
base = "ec76ff76991bda4173bb8dcc4c35cfadc73b6bc1"
allowed = {"package.json", "pnpm-lock.yaml", "package-lock.json", "src/native/window.ts", "forge.config.ts", "tests/macosSigningContract.test.mjs"}
changed = subprocess.check_output(["git", "diff", "--name-only", base], cwd=root, text=True).splitlines()
untracked = subprocess.check_output(["git", "ls-files", "--others", "--exclude-standard"], cwd=root, text=True).splitlines()
assert all(file in allowed or file.startswith("proof/E44/") for file in changed + untracked)
def old(file):
    return subprocess.check_output(["git", "show", base+":"+file], cwd=root, text=True)
file = "tests/macosSigningContract.test.mjs"
assert (root/file).read_text() == old(file).replace('toBe("38.1.2")','toBe("44.5.1")').replace('toContain("electron@38.1.2:")','toContain("electron@44.5.1:")')
file = "src/native/window.ts"
assert (root/file).read_text() == old(file).replace('          clipboard.writeText(action.url);', '          void clipboard.writeText(action.url).catch((error) => {\n            console.error("Failed to copy link:", error);\n          });')
file = "forge.config.ts"
assert (root/file).read_text() == old(file).replace('      CFBundleURLTypes: [','      NSAudioCaptureUsageDescription:\n        "Mutiny needs system audio access for screen sharing.",\n      CFBundleURLTypes: [')
checks = ["G-D1-final", "G-D2-final", "G-D3-final", "native-probe-final", "unsigned-package-final", "lock-scope-final", "frozen-install", "npm10-ci", "npm-ABI"]
receipts = {name: json.loads((proof/"receipts"/(name+".json")).read_text()) for name in checks}
for name, value in receipts.items():
    assert value["exit"] == 0, name
    assert hashlib.sha256((proof/"receipts"/value["log"]).read_bytes()).hexdigest() == value["logSHA256"], name
baseline = json.loads((proof/"receipts/baseline-tests.json").read_text())
candidate = json.loads((proof/"receipts/candidate-tests-final.json").read_text())
assert baseline["numPassedTests"] == baseline["numTotalTests"] == 245
assert candidate["numPassedTests"] == candidate["numTotalTests"] == baseline["numTotalTests"] + 2 == 247
assert candidate["numFailedTests"] == candidate["numPendingTests"] == 0
for mode in ("sync", "deferred"):
    native = json.loads((proof/"receipts"/("engine-"+mode+".json")).read_text())
    assert native["electron"] == native["runtime"]["versions"]["electron"] == "44.5.1"
    assert native["current"]["detached"] is False and native["current"]["destroyed"] is False
package = json.loads((proof/"receipts/unsigned-forge.json").read_text())
assert package["exit"] == 0 and package["abi"] == "149"
assert package["signedByHarness"] is False and package["launched"] is False
assert not Path(package["output"]).exists()
ports = list(range(49270, 49280))
for port in ports:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", port))
added = "\n".join(line[1:] for line in subprocess.check_output(["git", "diff", base, "--", *sorted(allowed)], cwd=root, text=True).splitlines() if line.startswith("+") and not line.startswith("+++"))
assert not re.search(r"(?:api_key|password|passwd)\s*=\s*['\"][^'\"]{6,}", added, re.I)
assert not re.search(r"os\.system\(|shell\s*=\s*True|pickle\.loads?\(|\beval\(", added)
receipt = {"base":base,"productFiles":sorted(file for file in changed if file in allowed),"frozenProductScope":True,"baselineTests":245,"candidateTests":247,"addedTests":2,"requiredGateExits":{name:value["exit"] for name,value in receipts.items()},"nativeProbeModes":["sync","deferred"],"electron":"44.5.1","ABI":"149","packageDeleted":True,"ownedPortsFree":ports,"securityScan":"no secret/shell/eval findings in added product lines","host":{"macOS":subprocess.check_output(["sw_vers","-productVersion"],text=True).strip(),"machine":subprocess.check_output(["uname","-m"],text=True).strip(),"node":subprocess.check_output(["node","--version"],text=True).strip(),"pnpm":subprocess.check_output(["pnpm","--version"],text=True).strip()}}
(proof/"RESULTS.json").write_text(json.dumps(receipt,indent=2)+"\n")
print(json.dumps(receipt,indent=2))
