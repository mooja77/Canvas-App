#!/usr/bin/env python3
"""QualCanvas Live Production Test Suite — All 7 suites, ~55 tests"""
import json, urllib.request, ssl, time

API = 'https://canvas-app-production.up.railway.app/api'
O = 'https://qualcanvas.com'
ctx = ssl.create_default_context()
ADMIN_KEY = '69acea2bb9099098dc517b62a446e189d344461d3d1ab2e6a164081adc1f3e1f'
PASS = 0
FAIL = 0
RESULTS = []

def api(method, path, data=None, token=None, admin=False):
    url = f'{API}{path}'
    body = json.dumps(data).encode() if data else None
    headers = {'Content-Type': 'application/json', 'Origin': O}
    if token: headers['x-dashboard-code'] = token
    if admin: headers['x-admin-key'] = ADMIN_KEY
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=30) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return json.loads(e.read())
    except Exception as e:
        return {'success': False, 'error': str(e)}

def check(name, condition, detail=''):
    global PASS, FAIL
    if condition:
        PASS += 1
        RESULTS.append(('PASS', name))
    else:
        FAIL += 1
        RESULTS.append(('FAIL', name, detail))
    status = 'PASS' if condition else 'FAIL'
    suffix = f' ({detail})' if detail and not condition else ''
    print(f'  {status}  {name}{suffix}')

def cleanup(cid, token):
    api('DELETE', f'/canvas/{cid}', None, token)
    api('DELETE', f'/canvas/{cid}/permanent', None, token)

# Auth
login = api('POST', '/auth', {'dashboardCode': 'CANVAS-DEMO2025'})
JWT = login['data']['jwt']
print(f'Auth: {login["data"]["name"]}\n')

# === SUITE 1: LAYOUT PERSISTENCE ===
print('=' * 60)
print('SUITE 1: LAYOUT PERSISTENCE')
print('=' * 60)
c = api('POST', '/canvas', {'name': f'LayoutLive-{int(time.time())}'}, JWT)
cid = c['data']['id']
tids, qids = [], []
for i in range(3):
    t = api('POST', f'/canvas/{cid}/transcripts', {'title': f'T{i+1}', 'content': f'Transcript {i+1} content for testing.'}, JWT)
    tids.append(t['data']['id'])
for i in range(3):
    q = api('POST', f'/canvas/{cid}/questions', {'text': f'Code{i+1}'}, JWT)
    qids.append(q['data']['id'])
for i in range(3):
    api('POST', f'/canvas/{cid}/codings', {'transcriptId': tids[i], 'questionId': qids[i], 'startOffset': 0, 'endOffset': 20, 'codedText': f'Transcript {i+1} content'}, JWT)

r = api('PUT', f'/canvas/{cid}/layout', {'positions': [
    {'nodeId': f'transcript-{tids[0]}', 'nodeType': 'transcript', 'x': 100, 'y': 200},
    {'nodeId': f'transcript-{tids[1]}', 'nodeType': 'transcript', 'x': 400, 'y': 200},
    {'nodeId': f'question-{qids[0]}', 'nodeType': 'question', 'x': 700, 'y': 100},
]}, JWT)
check('1.1 Layout save', r.get('success') == True)

full = api('GET', f'/canvas/{cid}', None, JWT)
positions = full['data'].get('nodePositions', [])
check('1.2 Positions persist', len(positions) >= 3, f'got {len(positions)}')

r = api('PUT', f'/canvas/{cid}/layout', {'positions': [
    {'nodeId': f'question-{qids[0]}', 'nodeType': 'question', 'x': 700, 'y': 100, 'collapsed': True}
]}, JWT)
full2 = api('GET', f'/canvas/{cid}', None, JWT)
collapsed = [p for p in full2['data'].get('nodePositions', []) if p.get('collapsed')]
check('1.3 Collapsed state persists', len(collapsed) >= 1)

d = full2['data']
check('1.4 Data integrity', len(d['transcripts']) == 3 and len(d['questions']) == 3 and len(d['codings']) == 3)

api('DELETE', f'/canvas/{cid}/questions/{qids[2]}', None, JWT)
d2 = api('GET', f'/canvas/{cid}', None, JWT)['data']
check('1.5 Delete persists', len(d2['questions']) == 2)
check('1.6 Codings intact', len(d2['codings']) >= 2)
cleanup(cid, JWT)

# === SUITE 2: STRESS PERFORMANCE ===
print('\n' + '=' * 60)
print('SUITE 2: STRESS PERFORMANCE')
print('=' * 60)
c = api('POST', '/canvas', {'name': f'StressLive-{int(time.time())}'}, JWT)
cid = c['data']['id']
tids2 = []
for i in range(10):
    t = api('POST', f'/canvas/{cid}/transcripts', {'title': f'Interview {i+1}', 'content': f'Participant {i+1} discussed challenges with recruitment, ethics, and intercoder reliability. The analysis revealed patterns around culture and resilience. Block {i+1}.'}, JWT)
    tids2.append(t['data']['id'])
check('2.1 Create 10 transcripts', len(tids2) == 10)

qids2 = []
for i in range(20):
    q = api('POST', f'/canvas/{cid}/questions', {'text': f'Theme-{i+1}'}, JWT)
    qids2.append(q['data']['id'])
check('2.2 Create 20 codes', len(qids2) == 20)

coding_ok = 0
for i in range(100):
    r = api('POST', f'/canvas/{cid}/codings', {'transcriptId': tids2[i%10], 'questionId': qids2[i%20], 'startOffset': (i*3)%80, 'endOffset': (i*3)%80+30, 'codedText': f'segment {i}'}, JWT)
    if r.get('success'): coding_ok += 1
check('2.3 Create 100 codings', coding_ok >= 95, f'{coding_ok}/100')

for atype, max_ms in [('stats', 10000), ('wordcloud', 10000), ('sentiment', 10000), ('cooccurrence', 15000), ('cluster', 15000)]:
    start = time.time()
    n = api('POST', f'/canvas/{cid}/computed', {'nodeType': atype, 'label': atype}, JWT)
    nid = n.get('data', {}).get('id')
    if nid:
        r = api('POST', f'/canvas/{cid}/computed/{nid}/run', None, JWT)
        elapsed = int((time.time() - start) * 1000)
        check(f'2.4 {atype} < {max_ms}ms', r.get('success') and elapsed < max_ms, f'{elapsed}ms')
        api('DELETE', f'/canvas/{cid}/computed/{nid}', None, JWT)
    else:
        check(f'2.4 {atype}', False, n.get('error', ''))
cleanup(cid, JWT)

# === SUITE 3: EXPORT & DATA INTEGRITY ===
print('\n' + '=' * 60)
print('SUITE 3: EXPORT & DATA INTEGRITY')
print('=' * 60)
c = api('POST', '/canvas', {'name': f'ExportLive-{int(time.time())}'}, JWT)
cid = c['data']['id']
tids3, qids3 = [], []
for i in range(3):
    t = api('POST', f'/canvas/{cid}/transcripts', {'title': f'Export T{i+1}', 'content': f'Export test transcript {i+1} content.'}, JWT)
    tids3.append(t['data']['id'])
for i in range(5):
    q = api('POST', f'/canvas/{cid}/questions', {'text': f'ExCode-{i+1}'}, JWT)
    qids3.append(q['data']['id'])
for i in range(10):
    api('POST', f'/canvas/{cid}/codings', {'transcriptId': tids3[i%3], 'questionId': qids3[i%5], 'startOffset': i*5, 'endOffset': i*5+20, 'codedText': f'coded {i}'}, JWT)
api('POST', f'/canvas/{cid}/memos', {'title': 'Memo', 'content': 'Test memo.'}, JWT)

try:
    req = urllib.request.Request(f'{API}/canvas/{cid}/export/excel', headers={'x-dashboard-code': JWT, 'Origin': O})
    with urllib.request.urlopen(req, context=ctx, timeout=15) as r:
        check('3.1 Excel export', len(r.read()) > 100)
except Exception as e:
    check('3.1 Excel export', False, str(e))

try:
    req = urllib.request.Request(f'{API}/canvas/{cid}/export/qdpx', headers={'x-dashboard-code': JWT, 'Origin': O})
    with urllib.request.urlopen(req, context=ctx, timeout=15) as r:
        check('3.2 QDPX export', len(r.read()) > 100)
except Exception as e:
    check('3.2 QDPX export', False, str(e))

full = api('GET', f'/canvas/{cid}', None, JWT)['data']
check('3.3 Export data: 3T 5C 10cod 1M', len(full['transcripts'])==3 and len(full['questions'])==5 and len(full['codings'])==10 and len(full['memos'])==1)

share = api('POST', f'/canvas/{cid}/share', None, JWT)
scode = share.get('data', {}).get('shareCode', '')
pub = api('GET', f'/canvas/shared/{scode}') if scode else {'success': False}
check('3.4 Share + public view', pub.get('success') == True)
cleanup(cid, JWT)

# === SUITE 4: CODING WORKFLOW ===
print('\n' + '=' * 60)
print('SUITE 4: CODING WORKFLOW')
print('=' * 60)
c = api('POST', '/canvas', {'name': f'CodingLive-{int(time.time())}'}, JWT)
cid = c['data']['id']
t = api('POST', f'/canvas/{cid}/transcripts', {'title': 'Coding Test', 'content': 'The participant described feeling overwhelmed by the transition. Collaboration was harder but flexibility improved. Coping strategies helped. Students reported academic pressure and social growth.'}, JWT)
tid = t['data']['id']
cqids = []
for name in ['Overwhelm', 'Collaboration', 'Flexibility', 'Coping', 'Growth']:
    q = api('POST', f'/canvas/{cid}/questions', {'text': name}, JWT)
    cqids.append(q['data']['id'])

r = api('POST', f'/canvas/{cid}/codings', {'transcriptId': tid, 'questionId': cqids[0], 'startOffset': 20, 'endOffset': 80, 'codedText': 'feeling overwhelmed by the transition'}, JWT)
cod_id = r.get('data', {}).get('id', '')
check('4.1 Create coding', r.get('success') == True)
r = api('PUT', f'/canvas/{cid}/codings/{cod_id}', {'annotation': 'Key response'}, JWT)
check('4.2 Add annotation', r.get('success') == True)
r = api('PUT', f'/canvas/{cid}/codings/{cod_id}/reassign', {'newQuestionId': cqids[4]}, JWT)
check('4.3 Reassign coding', r.get('success') == True)
r = api('POST', f'/canvas/{cid}/codings', {'transcriptId': tid, 'questionId': cqids[1], 'startOffset': 50, 'endOffset': 120, 'codedText': 'the transition. Collaboration was harder'}, JWT)
check('4.4 Overlapping coding', r.get('success') == True)
rapid = sum(1 for i,(s,e) in enumerate([(0,40),(80,140),(140,200),(200,260),(260,320)]) if api('POST', f'/canvas/{cid}/codings', {'transcriptId': tid, 'questionId': cqids[i%5], 'startOffset': s, 'endOffset': min(e,320), 'codedText': f'seg{i}'}, JWT).get('success'))
check('4.5 Rapid 5 codings', rapid == 5, f'{rapid}/5')
r = api('DELETE', f'/canvas/{cid}/codings/{cod_id}', None, JWT)
check('4.6 Delete coding', r.get('success') == True)
r = api('POST', f'/canvas/{cid}/questions/merge', {'sourceId': cqids[3], 'targetId': cqids[4]}, JWT)
check('4.7 Merge codes', r.get('success') == True)
full = api('GET', f'/canvas/{cid}', None, JWT)['data']
check('4.8 Codes after merge = 4', len(full['questions']) == 4)
r = api('PUT', f'/canvas/{cid}/questions/{cqids[1]}', {'parentQuestionId': cqids[0]}, JWT)
check('4.9 Code hierarchy', r.get('success') == True)
cleanup(cid, JWT)

# === SUITE 5: ETHICS & COMPLIANCE ===
print('\n' + '=' * 60)
print('SUITE 5: ETHICS & COMPLIANCE')
print('=' * 60)
c = api('POST', '/canvas', {'name': f'EthicsLive-{int(time.time())}'}, JWT)
cid = c['data']['id']
r = api('PUT', f'/canvas/{cid}/ethics', {'ethicsApprovalId': 'IRB-2026-LIVE', 'ethicsStatus': 'approved', 'dataRetentionDate': '2029-12-31T00:00:00.000Z'}, JWT)
check('5.1 Set IRB + status + retention', r.get('success') == True)
r = api('GET', f'/canvas/{cid}/ethics', None, JWT)
check('5.2 Ethics persists', r.get('data', {}).get('ethicsApprovalId') == 'IRB-2026-LIVE')
for pid in ['P001', 'P002', 'P003']:
    api('POST', f'/canvas/{cid}/consent', {'participantId': pid, 'consentType': 'written'}, JWT)
consents = api('GET', f'/canvas/{cid}/consent', None, JWT)
check('5.3 3 consent records', len(consents.get('data', [])) >= 3)
ccon = consents['data'][0]['id']
r = api('PUT', f'/canvas/{cid}/consent/{ccon}/withdraw', {'notes': 'Withdrawn'}, JWT)
check('5.4 Withdraw consent', r.get('success') == True)
t = api('POST', f'/canvas/{cid}/transcripts', {'title': 'Anon', 'content': 'Dr. Smith mentioned the policy. Dr. Smith also noted issues.'}, JWT)
atid = t['data']['id']
r = api('POST', f'/canvas/{cid}/transcripts/{atid}/anonymize', {'replacements': [{'find': 'Dr. Smith', 'replace': '[P1]'}]}, JWT)
check('5.5 Anonymize transcript', r.get('success') == True)
full = api('GET', f'/canvas/{cid}', None, JWT)['data']
anon_t = [t for t in full['transcripts'] if t['id'] == atid]
check('5.6 Anonymized content', '[P1]' in anon_t[0].get('content', '') if anon_t else False)
cleanup(cid, JWT)

# === SUITE 6: ADMIN DASHBOARD ===
print('\n' + '=' * 60)
print('SUITE 6: ADMIN DASHBOARD')
print('=' * 60)
r = api('GET', '/admin/dashboard', admin=True)
check('6.1 Dashboard loads', r.get('success') == True)
r = api('GET', '/admin/users?limit=5', admin=True)
check('6.2 Users list', r.get('success') and len(r.get('data', [])) > 0)
r = api('GET', '/admin/health', admin=True)
check('6.3 Health = healthy', r.get('data', {}).get('status') == 'healthy')
check('6.4 DB connected', r.get('data', {}).get('dbConnected') == True)
r = api('GET', '/admin/billing', admin=True)
check('6.5 Billing loads', r.get('success') == True)
r = api('GET', '/admin/activity?limit=5', admin=True)
check('6.6 Activity log', r.get('success') and len(r.get('data', [])) > 0)
r = api('GET', '/admin/features', admin=True)
check('6.7 Features', r.get('success') and len(r.get('data', [])) > 0)
r = api('GET', '/admin/usage?period=7d', admin=True)
check('6.8 Usage analytics', r.get('success') == True)
r = api('GET', '/admin/dashboard')
check('6.9 No auth = forbidden', r.get('success') == False)

# === SUITE 7: ERROR HANDLING ===
print('\n' + '=' * 60)
print('SUITE 7: ERROR HANDLING')
print('=' * 60)
check('7.1 Invalid canvas ID', api('GET', '/canvas/fake-id-123', None, JWT).get('success') == False)
check('7.2 Invalid share code', api('GET', '/canvas/shared/FAKE-CODE').get('success') == False)
check('7.3 Empty canvas name', api('POST', '/canvas', {'name': ''}, JWT).get('success') == False)
c = api('POST', '/canvas', {'name': f'ErrTest-{int(time.time())}'}, JWT)
cid = c['data']['id']
check('7.4 Empty code text', api('POST', f'/canvas/{cid}/questions', {'text': ''}, JWT).get('success') == False)
check('7.5 Unicode names', api('POST', f'/canvas/{cid}/questions', {'text': 'Theme 感情 Emocja'}, JWT).get('success') == True)
check('7.6 XSS stored safely', api('POST', f'/canvas/{cid}/transcripts', {'title': '<script>alert(1)</script>', 'content': 'Normal <img onerror=alert(1)>'}, JWT).get('success') == True)
cleanup(cid, JWT)

# === FINAL ===
print('\n' + '=' * 60)
print(f'FINAL: {PASS} PASS, {FAIL} FAIL out of {PASS+FAIL} tests')
print('=' * 60)
if FAIL > 0:
    print('\nFAILURES:')
    for r in RESULTS:
        if r[0] == 'FAIL':
            print(f'  {r[1]}' + (f' -- {r[2]}' if len(r) > 2 else ''))
