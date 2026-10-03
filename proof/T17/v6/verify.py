#!/usr/bin/env python3
"""Read-only delivered T17-v6 integrity and behavioral-receipt checks.

This verifies recorded execution, not a substitute for independent runtime reruns.
"""
import hashlib
import json
import os
from pathlib import Path
import tarfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]


def load(name):
    return json.loads((HERE / name).read_text())


def sha(data):
    return hashlib.sha256(data).hexdigest()


def object_id(kind, data):
    return hashlib.sha1(f"{kind} {len(data)}\0".encode() + data).hexdigest()


def working_bytes(path):
    file = ROOT / path
    return os.readlink(file).encode() if file.is_symlink() else file.read_bytes()


def manifest_tree(entries):
    trie = {}
    for path, entry in entries.items():
        node = trie
        components = path.split("/")
        for component in components[:-1]:
            node = node.setdefault(component, {})
        node[components[-1]] = (entry["mode"].lstrip("0"), entry["object"])

    def digest(node):
        rows = []
        for name in sorted(node, key=lambda n: n + ("/" if isinstance(node[n], dict) else "")):
            item = node[name]
            mode, oid = ("40000", digest(item)) if isinstance(item, dict) else item
            rows.append(f"{mode} {name}\0".encode() + bytes.fromhex(oid))
        return object_id("tree", b"".join(rows))

    return digest(trie)


def main():
    freeze = load("freeze.json")
    manifest = load("combined-tree-manifest.json")
    assert manifest_tree(manifest["entries"]) == manifest["tree"] == freeze["validatedSourceTree"]
    integrity = load("product-integrity.json")
    assert integrity["validatedCombinedSourceTree"] == manifest["tree"]
    assert integrity["immutableProductCount"] == len(integrity["product"])
    for path, receipt in integrity["product"].items():
        assert sha(working_bytes(path)) == receipt["candidateFrozenSHA256"] == receipt["candidateAfterSHA256"], path
        assert receipt["combinedReviewedSHA256"] == receipt["combinedAfterSHA256"], path
    assert integrity["immutableV5Count"] == len(integrity["v5SHA256"])
    for path, expected in {**integrity["v5SHA256"], **integrity["proofSourceSHA256"]}.items():
        assert sha(working_bytes(path)) == expected, path
    archive = load("archive-verification.json")
    assert sha((HERE / "combined-frozen-source.tar.gz").read_bytes()) == archive["archiveSHA256"]
    archived = set()
    with tarfile.open(HERE / "combined-frozen-source.tar.gz") as tar:
        for member in tar.getmembers():
            if not (member.isfile() or member.issym()):
                continue
            if member.issym():
                data = member.linkname.encode()
            else:
                stream = tar.extractfile(member)
                assert stream is not None
                data = stream.read()
            assert object_id("blob", data) == manifest["entries"][member.name]["object"], member.name
            archived.add(member.name)
    assert len(archived) == archive["verifiedFileCount"]
    assert archived == {path for path, entry in manifest["entries"].items() if entry["kind"] == "blob"}
    required_gates = ["install", "classifier-green", "typecheck", "units", "lint", "runtime14", "negative-controls", "emission", "native-sync", "native-deferred", "lock-scope"]
    for name in required_gates + ["lifetime-red-real", "classifier-red", "lifetime-red", "baseline38"]:
        receipt = load(name + ".json")
        assert sha((HERE / (name + ".log")).read_bytes()) == receipt["logSHA256"], name
        assert receipt["exit"] == (0 if name in required_gates else 1), name
    units = load("unit-results.json")
    assert units["numPassedTests"] == units["numTotalTests"] >= 367
    assert units["numFailedTests"] == units["numPendingTests"] == 0
    summary = load("runtime14/isolation-summary.json")
    scenarios = ["no-crash-no-cdp", "crash-only", "cdp-only", "full-v3", "crash-retry-hosted", "crash-native-os", "no-crash-retry-hosted"]
    expected = {(mode, scenario) for mode in ["darwin", "win32"] for scenario in scenarios}
    assert {(row["mode"], row["scenario"]) for row in summary["results"]} == expected
    assert summary["scenarioCount"] == summary["passCount"] == len(summary["results"]) == 14
    assert summary["failCount"] == summary["knownGapCount"] == 0
    attempts = 0
    for mode, scenario in sorted(expected):
        row = load(f"runtime14/{mode}-{scenario}-runtime.json")
        assert row["electron"] == "44.5.1" and row["modules"] == "149"
        assert row["result"] == "PASS" and row["exit"] == 0 and row["passed"]
        assert not row["hardFailures"] and not row["knownGaps"]
        actions = row["captionActions"]
        assert len(actions) == (8 if scenario == "crash-retry-hosted" else 4)
        assert [action["action"] for action in actions] == ["maximise", "maximise", "minimise", "close"] * (len(actions) // 4)
        for action in actions:
            assert action["delivered"] and action["native"] and not action["error"]
            auth = action["tuple"]
            assert auth["sameContents"] and auth["sameFrame"] and not auth["detached"]
            assert auth["hosted"] if action["document"] == "hosted-restored" else auth["offline"]
            if action["action"] == "close":
                assert "close" in action["nativeEvents"] and "closed" in action["nativeEvents"]
        configured = f"http://127.0.0.1:{row['port']}/app?configured=1"
        assert all(url.startswith("file:") or url == configured for url in row["requests"])
        if scenario in ["crash-retry-hosted", "crash-native-os"]:
            first, second = row["fixtures"]
            assert first["closedByCaption"] and first["id"] != second["id"]
            assert first["contentsId"] != second["contentsId"]
            assert second["purpose"] == scenario + "-independent-lifetime"
        if scenario in ["crash-retry-hosted", "no-crash-retry-hosted"]:
            retry = row["characterization"]["manualRetry"]
            assert retry["worked"] and retry["automaticRetryPaused"]
            assert retry["hitsAfter"] == retry["hitsBefore"] + 1
            assert retry["requests"] == [configured]
            assert row["characterization"]["hostedCaptionsAuthorized"]
        if scenario == "crash-native-os":
            native = row["characterization"]["nativeOS"]
            assert all(native[k] for k in ["minimize", "restore", "close", "closed", "ipcUnchanged"])
            assert all(event in native["events"] for event in ["minimize", "restore", "close", "closed"])
        attempts += len(actions)
    assert attempts == summary["captionAttemptCount"] == 64
    red = load("lifetime-red-real/isolation-summary.json")
    assert red["scenarioCount"] == red["failCount"] == 4 and red["knownGapCount"] == 0
    assert all(any("destroyed" in error for error in row["hardFailures"]) for row in red["results"])
    controls = load("negative-controls/results.json")
    assert controls["cleanExits"] == [0, 0, 0] and controls["mutantExits"] == [1, 1, 1]
    assert controls["sourceUnchanged"] and controls["protectedBefore"] == controls["protectedAfter"]
    for control in controls["results"]:
        for index, execution in enumerate(control["executions"]):
            label = control["name"] + ("-mutant" if index else "-clean")
            assert sha((HERE / "negative-controls" / (label + ".log")).read_bytes()) == execution["logSHA256"]
    emission = load("emission-controls.json")
    assert [row["assertionExit"] for row in emission["controls"]] == [0, 1, 1, 1]
    assert emission["sourceUnchanged"]
    for label in ["sync", "deferred"]:
        native = load(f"native-{label}/engine-{label}.json")
        assert native["electron"] == "44.5.1" and not native["current"]["detached"]
    cleanup = load("cleanup.json")
    assert cleanup["rootRemoved"] and cleanup["processesKilled"] == 0
    assert cleanup["ownedProcessesBefore"] == [] and cleanup["ownedProcessCountAfter"] == 0
    assert cleanup["portsBindBefore"] == cleanup["portsBindAfter"] == list(range(49270, 49280))
    results = load("RESULTS.json")
    assert results["units"]["passed"] == units["numPassedTests"]
    assert results["runtime"]["passCount"] == 14 and results["runtime"]["knownGapCount"] == 0
    print(json.dumps({"verified": True, "combinedTree": manifest["tree"], "runtimePASS": 14, "knownGaps": 0, "captionAttempts": attempts, "unitsPASS": units["numPassedTests"], "immutableProductPaths": len(integrity["product"]), "immutableV5Files": len(integrity["v5SHA256"]), "archiveFiles": len(archived)}))


if __name__ == "__main__":
    main()
