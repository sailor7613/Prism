#!/usr/bin/env python3
"""local_hello.py — asks each named local model one short question, to prove it loads and answers (2026-11-13).
  ~/.prism-local/venv/bin/python scripts/closedform/local_hello.py gemma qwen deepseek"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('CF_LOCAL_PY', sys.executable)
import derive as D
for n in sys.argv[1:]:
    try: d = D.local_ask({'model': n, 'messages': [{'role': 'user', 'content': 'In one short sentence: what is a prism?'}], 'max_tokens': 400})
    except SystemExit as e: print(f'    {n}: DID NOT ANSWER — {e}'); continue
    if d.get('error'): print(f'    {n}: DID NOT ANSWER — {d["error"][:300]}')
    else: print(f'    {n} ({d.get("repo")}): {d.get("text", "")[:240]}\n      {d.get("output_tokens")} tokens · {d.get("tps")} a second')
