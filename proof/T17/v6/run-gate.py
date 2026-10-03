#!/usr/bin/env python3
"""Bounded local evidence runner; never launches the product entry point."""
import os, sys, json, time, pathlib, subprocess, hashlib
root = pathlib.Path('/Users/friday/.hermes/profiles/friday/cache/scratch/T17-v6')
evidence = pathlib.Path('/Users/friday/Projects/mutiny-rebuild/wt/T17/proof/T17/v6')
root.mkdir(parents=True, exist_ok=True)
env = os.environ.copy()
for key, value in {'TMPDIR':root/'tmp','XDG_CACHE_HOME':root/'cache','npm_config_cache':root/'cache/npm','ELECTRON_CACHE':root/'cache/electron','NODE_COMPILE_CACHE':root/'cache/node','T17_SCRATCH':root/'tmp'}.items():
    pathlib.Path(value).mkdir(parents=True, exist_ok=True); env[key]=str(value)
name,cwd,*argv=sys.argv[1:]
extra=json.loads(env.pop('GATE_ENV','{}')); env.update({k:str(v) for k,v in extra.items()})
start=time.time()
with (evidence/(name+'.log')).open('wb') as log:
    p=subprocess.run(argv,cwd=cwd,env=env,stdout=log,stderr=subprocess.STDOUT,timeout=600)
data={'argv':argv,'cwd':cwd,'environment':{k:env[k] for k in ['TMPDIR','XDG_CACHE_HOME','npm_config_cache','ELECTRON_CACHE','NODE_COMPILE_CACHE','T17_SCRATCH']},'overrides':extra,'exit':p.returncode,'started':start,'elapsedSeconds':time.time()-start,'logSHA256':hashlib.sha256((evidence/(name+'.log')).read_bytes()).hexdigest()}
(evidence/(name+'.json')).write_text(json.dumps(data,indent=2)+'\n')
print(json.dumps(data)); sys.exit(p.returncode)
