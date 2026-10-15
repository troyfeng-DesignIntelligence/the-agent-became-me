"""Offline camera-ready materials. Never calls providers or reads credentials."""
from __future__ import annotations

import copy
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / 'experiments/hai-2026-camera-ready'

def dump(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')

def sha(data):
    return hashlib.sha256(data).hexdigest()

def state_and_wrapper(request):
    wrapper = copy.deepcopy(request)
    raw = wrapper.pop('input') if 'input' in wrapper else wrapper['messages'].pop()['content']
    retry = '\nPrevious output was invalid. Return only the required JSON object.'
    return json.loads(raw.removesuffix(retry)), wrapper, raw.endswith(retry)

def normalized(state):
    result = copy.deepcopy(state)
    result['candidates'] = sorted(result['candidates'], key=lambda c: c['candidateId'])
    return result

def main():
    result = {'mode': 'offline cached-request audit', 'providers': {}}
    for provider in ['deepseek', 'mimo']:
        public = ROOT / f'public/results/online-storefront-instrument-ablation-confirmatory/v1/{provider}'
        rows = json.loads((public / 'rows.json').read_text())['rows']
        cache = ROOT / f'artifacts/online-storefront-instrument-ablation-confirmatory/{provider}/responses'
        summary = {'servedUnits': 0, 'maskedUnits': 0, 'requestsChecked': 0, 'retryPrompts': 0,
                   'orderChangedUnits': 0, 'failures': [], 'examples': {}}
        for row in rows:
            mode = row['mode']
            if mode not in ['served-order', 'masked-control']:
                continue
            key = f"{row['category']}/{row['taskId']}/{row['modelFamily']}"
            requests, states, wrappers = {}, {}, {}
            for condition, cache_key in row['responseHashes'].items():
                entry = json.loads((cache / f'{cache_key}.json').read_text())
                request = entry['request']
                # Allowlist excludes raw responses, transport headers and credentials.
                permitted = {'model', 'instructions', 'input', 'messages', 'max_tokens', 'max_output_tokens',
                             'stream', 'thinking', 'reasoning', 'temperature', 'response_format', 'text'}
                assert set(request) <= permitted, 'Unexpected request field: inspect before exporting'
                state, wrapper, retried = state_and_wrapper(request)
                requests[condition] = request
                states[condition] = state
                wrappers[condition] = wrapper
                summary['requestsChecked'] += 1
                summary['retryPrompts'] += int(retried)
            anchor = 'immediate-a'
            if not all(w == wrappers[anchor] for w in wrappers.values()):
                summary['failures'].append(f'{key}/{mode}: wrapper differs')
            if not all(normalized(s) == normalized(states[anchor]) for s in states.values()):
                summary['failures'].append(f'{key}/{mode}: non-order input differs')
            if states['immediate-a'] != states['immediate-b'] or states['held-a'] != states['held-b']:
                summary['failures'].append(f'{key}/{mode}: repeated input differs')
            if mode == 'masked-control':
                summary['maskedUnits'] += 1
                if not all(r == requests[anchor] for r in requests.values()):
                    summary['failures'].append(f'{key}: masked payload not identical')
            else:
                summary['servedUnits'] += 1
                changed = states['immediate-a'] != states['held-a']
                summary['orderChangedUnits'] += int(changed)
                if 'served-order' not in summary['examples'] and changed:
                    # First lexicographically stored changed-order unit; not selected for output divergence.
                    example = {'unit': key, 'selectionRule': 'first served-order row with different candidate ordering; independent of outputs',
                               'sourceCacheKeys': row['responseHashes'], 'requests': requests}
                    dump(WORK / f'supplement/{provider}-served-order-requests.json', example)
                    summary['examples']['served-order'] = key
        dump(WORK / f'supplement/{provider}-summary-original.json', json.loads((public / 'summary.json').read_text()))
        result['providers'][provider] = summary
    result['passed'] = all(not s['failures'] for s in result['providers'].values())
    result['sourceCodeSha256'] = {p: sha((ROOT / p).read_bytes()) for p in [
        'scripts/run-online-storefront-cross-llm-pilot.py',
        'scripts/run-online-storefront-instrument-ablation.py',
        'scripts/run-online-storefront-feedback-action.py',
        'scripts/run-online-storefront-natural-language-policy.py']}
    dump(WORK / 'supplement/prompt-invariance-audit.json', result)
    print(json.dumps(result, indent=2))
    if not result['passed']:
        raise SystemExit(1)

if __name__ == '__main__':
    main()
