#!/usr/bin/env python3
"""Evidence-preserving local storage. Diagnosis is performed by the Skill's AI host."""
import argparse
import copy
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import tempfile
import unicodedata
from contextlib import contextmanager
from datetime import datetime, timezone

from jsonschema import Draft202012Validator, FormatChecker

BASE = Path(__file__).resolve().parents[1]


def read(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def encoded(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + '\n'


def normalize(value):
    return ' '.join(unicodedata.normalize('NFKC', value).casefold().split())


def identity(path):
    return tuple(normalize(x) for x in path)


def node_id(path):
    return 'K' + hashlib.sha256(json.dumps(identity(path), ensure_ascii=False).encode()).hexdigest()[:20]


def check_schema(value, name):
    validator = Draft202012Validator(read(BASE / 'schemas' / name), format_checker=FormatChecker())
    errors = sorted(validator.iter_errors(value), key=lambda e: str(list(e.path)))
    if errors:
        e = errors[0]
        raise ValueError(f"{'.'.join(map(str, e.path)) or '$'}: {e.message}")


def taxonomy():
    return read(BASE / 'references' / 'error-taxonomy.json')


def validate(draft):
    check_schema(draft, 'diagnosis.schema.json')
    inp, diag = draft['input'], draft['diagnosis']
    all_steps = [*inp['student_solution'], *draft.get('supplemental_evidence', [])]
    steps = {s['id']: s['text'] for s in all_steps}
    if len(steps) != len(all_steps):
        raise ValueError('duplicate step id')
    nodes = {k['key']: k for k in diag['knowledge']}
    if len(nodes) != len(diag['knowledge']):
        raise ValueError('duplicate knowledge key')
    if diag['first_blocked_step'] is not None and diag['first_blocked_step'] not in steps:
        raise ValueError('first_blocked_step must reference a student step')
    if diag['answer_status'] == 'provided' and inp['correct_answer'] is None:
        raise ValueError('provided answer requires original correct_answer')
    if diag['answer_status'] == 'independently_derived' and diag['derived_answer'] is None:
        raise ValueError('independently_derived requires derived_answer')
    if diag['status'] == 'complete' and (not nodes or not diag['correct_reasoning'] or diag['missing_information']):
        raise ValueError('complete diagnosis needs knowledge and reasoning, with no unresolved missing information')
    if diag['status'] == 'needs_information' and not diag['missing_information']:
        raise ValueError('needs_information requires explicit missing information')
    for k in nodes.values():
        if k['outcome'] not in ('unknown', 'unobserved') and not k['evidence']:
            raise ValueError('assessed knowledge needs evidence')
        if k['independent'] and (k['hint_required'] or k['outcome'] != 'correct' or k['understanding'] != 'understood'):
            raise ValueError('independent success must show understanding, be correct and without hints')
        for ev in k['evidence']:
            if not set(ev['step_ids']) <= steps.keys():
                raise ValueError('unknown evidence step')
            if not any(ev['quote'] in steps[x] for x in ev['step_ids']):
                raise ValueError('evidence quote must occur verbatim in cited step')
    presentation = diag.get('presentation', {})
    if not set(presentation.get('student_solution', {})) <= {s['id'] for s in inp['student_solution']}:
        raise ValueError('presentation references unknown student step')
    if 'student_answer' in presentation and inp['student_answer'] is None:
        raise ValueError('presentation cannot invent a missing student answer')
    if 'correct_answer' in presentation and inp['correct_answer'] is None and diag['derived_answer'] is None:
        raise ValueError('presentation cannot invent a missing correct answer')
    allowed = {x['id'] for x in taxonomy()['types']}
    for err in diag['errors']:
        if err['type'] not in allowed:
            raise ValueError('unregistered error type: ' + err['type'])
        if err['step_id'] not in steps or not set(err['knowledge_keys']) <= nodes.keys():
            raise ValueError('error references unknown step or knowledge')
        if err['evidence'] not in steps[err['step_id']]:
            raise ValueError('error evidence must be a verbatim student quote')
    for rel in diag['relations']:
        if rel['from_key'] not in nodes or rel['to_key'] not in nodes:
            raise ValueError('relation references unknown knowledge')


def blank_node(path):
    return {'id': node_id(path), 'name': path[-1], 'path': path,
            'kind': ['Subject', 'Chapter', 'KnowledgeNode', 'SubSkill'][len(path)-1],
            'parent_id': node_id(path[:-1]) if len(path) > 1 else None,
            'aliases': [], 'exposure_count': 0, 'correct_count': 0, 'wrong_count': 0,
            'partial_count': 0, 'hint_required_count': 0, 'independent_success_count': 0,
            'repeated_error_count': 0, 'last_seen_at': None, 'last_wrong_at': None,
            'last_correct_at': None, 'last_reviewed_at': None, 'confidence': 0,
            'mastery_score': None, 'model_version': 'evidence-v1',
            'error_counts': {}, 'evidence_events': []}


def acyclic(edges):
    graph = {}
    for edge in edges:
        if edge['type'] == 'PREREQUISITE':
            graph.setdefault(edge['from_id'], set()).add(edge['to_id'])
    active, done = set(), set()
    def visit(node):
        if node in active:
            raise ValueError('PREREQUISITE cycle')
        if node in done:
            return
        active.add(node)
        for child in graph.get(node, ()):
            visit(child)
        active.remove(node)
        done.add(node)
    for node in graph:
        visit(node)


def digest(value):
    return hashlib.sha256(encoded(value).encode()).hexdigest()


def canonical_id(nid, nodes):
    seen = set()
    while nodes[nid].get('merge_target'):
        if nid in seen:
            raise ValueError('merge cycle')
        seen.add(nid)
        nid = nodes[nid]['merge_target']
    return nid


def check_aliases(nodes):
    claims = {}
    for node in nodes.values():
        if node['kind'] != 'SubSkill':
            continue
        owner = canonical_id(node['id'], nodes)
        for name in [node['name'], *node['aliases']]:
            key = (*identity(node['path'][:-1]), normalize(name))
            if key in claims and claims[key] != owner:
                raise ValueError('alias collision between canonical nodes')
            claims[key] = owner


def decide(candidate, catalog):
    """Lexical suggestions are review candidates only, never semantic authority."""
    nodes = catalog['nodes']; path = candidate['path']
    policy = candidate.get('canonicalization', {})
    candidates = policy.get('candidate_ids', [])
    for nid in candidates:
        if nid not in nodes or nodes[nid]['kind'] != 'SubSkill':
            raise ValueError('unknown canonicalization candidate')
        if normalize(nodes[nid]['path'][0]) != normalize(path[0]):
            raise ValueError('candidate cannot cross subjects')
    nid = candidate['existing_id']
    if nid:
        if nid not in nodes or nodes[nid]['kind'] != 'SubSkill':
            raise ValueError('existing_id must name an existing SubSkill')
        if normalize(nodes[nid]['path'][0]) != normalize(path[0]):
            raise ValueError('existing_id cannot cross subjects')
        return {'action':'REUSE','node_id':canonical_id(nid,nodes),'candidate_ids':[nid],'reason':'explicit stable ID'}
    names = {normalize(path[-1]), *(normalize(x) for x in candidate['aliases'])}
    matches = {canonical_id(n['id'],nodes) for n in nodes.values() if n['kind']=='SubSkill'
               and identity(n['path'][:-1]) == identity(path[:-1])
               and names & {normalize(n['name']), *(normalize(x) for x in n['aliases'])}}
    if len(matches) > 1:
        raise ValueError('ambiguous alias; select existing_id and resolve alias conflict')
    if matches:
        return {'action':'REUSE','node_id':next(iter(matches)),'candidate_ids':sorted(matches),'reason':'exact canonical name or declared alias'}
    if policy.get('action') == 'REUSE':
        raise ValueError('REUSE requires a matching name/alias or existing_id')
    if policy.get('action') == 'CREATE':
        return {'action':'CREATE','node_id':node_id(path),'candidate_ids':candidates,'reason':policy['reason']}
    if policy.get('action') == 'NEEDS_REVIEW':
        return {'action':'NEEDS_REVIEW','node_id':None,'candidate_ids':candidates,'reason':policy['reason']}
    # Conservative lexical screening. AI must supply candidates for semantic paraphrases.
    from difflib import SequenceMatcher
    similar = {canonical_id(n['id'],nodes) for n in nodes.values() if n['kind']=='SubSkill'
               and normalize(n['path'][0]) == normalize(path[0])
               and max(SequenceMatcher(None,normalize(path[-1]),normalize(x)).ratio()
                       for x in [n['name'],*n['aliases']]) >= .72}
    if similar:
        return {'action':'NEEDS_REVIEW','node_id':None,'candidate_ids':sorted(similar),'reason':'lexical similarity only; AI or user must review skill granularity'}
    return {'action':'CREATE','node_id':node_id(path),'candidate_ids':[],'reason':'no exact or alias match and no review candidate'}


def resolve_details(draft, catalog, allow_collapsed=False):
    nodes = copy.deepcopy(catalog['nodes']); mapping = {}; decisions = {}
    for k in draft['diagnosis']['knowledge']:
        decision = decide(k, {'nodes':nodes})
        nid = decision['node_id']; decisions[k['key']] = decision
        mapping[k['key']] = nid
        if nid is None:
            continue
        if nid not in nodes:
            for end in range(1,5):
                n = blank_node(k['path'][:end])
                nodes.setdefault(n['id'], n)
        n = nodes[nid]
        for alias in [k['path'][-1], *k['aliases']]:
            if normalize(alias) != normalize(n['name']) and alias not in n['aliases']:
                n['aliases'].append(alias)
    assigned = [n for n in mapping.values() if n is not None]
    if not allow_collapsed and len(assigned) != len(set(assigned)):
        raise ValueError('same skill appears twice in one diagnosis; consolidate its evidence')
    check_aliases(nodes)
    return mapping, nodes, decisions


def resolve(draft, catalog):
    mapping, nodes, _ = resolve_details(draft, catalog)
    return mapping, nodes


def register_bound(draft, mapping, catalog):
    """Replay immutable bindings, never rerun a future heuristic on old decisions."""
    nodes = catalog['nodes']
    if set(mapping) != {k['key'] for k in draft['diagnosis']['knowledge']}:
        raise ValueError('stored knowledge mapping keys differ from diagnosis')
    for k in draft['diagnosis']['knowledge']:
        nid = mapping[k['key']]
        if nid is None:
            continue
        if nid not in nodes:
            if nid != node_id(k['path']) or k['existing_id'] is not None:
                raise ValueError('stored knowledge mapping references unknown stable ID')
            for end in range(1,5):
                n = blank_node(k['path'][:end]); nodes.setdefault(n['id'], n)
        if nodes[nid]['kind'] != 'SubSkill' or normalize(nodes[nid]['path'][0]) != normalize(k['path'][0]):
            raise ValueError('invalid stored knowledge binding')
        n = nodes[canonical_id(nid,nodes)]
        for alias in [k['path'][-1], *k['aliases']]:
            if normalize(alias) != normalize(n['name']) and alias not in n['aliases']:
                n['aliases'].append(alias)
    check_aliases(nodes)


def field_changes(old, new, prefix=''):
    if isinstance(old,dict) and isinstance(new,dict):
        changes = []
        for key in sorted(old.keys() | new.keys()):
            path = prefix + '/' + key.replace('~','~0').replace('/','~1')
            changes.extend(field_changes(old.get(key),new.get(key),path))
        return changes
    return [] if old == new else [{'path':prefix,'previous_value':old,'new_value':new}]


def validate_replacement(old, new):
    validate(new)
    old_input, new_input = dict(old['input']), dict(new['input'])
    previous = old.get('supplemental_evidence', [])
    location = new_input.get('source_location')
    # A user may supply previously absent metadata after recording the attempt.
    # Keep the original file immutable and require new, explicit evidence.
    if not old_input.get('source_location') and location:
        added = new.get('supplemental_evidence', [])[len(previous):]
        if any(e['text'] == location and e['source'] == 'user_correction' for e in added):
            new_input.pop('source_location', None)
            old_input.pop('source_location', None)
    if old_input != new_input or old['attempt_key'] != new['attempt_key']:
        raise ValueError('revision cannot change original attempt input or attempt_key; append supplemental evidence')
    previous = old.get('supplemental_evidence', [])
    if new.get('supplemental_evidence', [])[:len(previous)] != previous:
        raise ValueError('supplemental evidence is append-only')
    if old == new:
        raise ValueError('revision has no changes')


def node_change(request, catalog, event_meta):
    nodes = catalog['nodes']
    kind = request['kind']
    nid = request['from_node_id'] if kind=='merge' else request['node_id']
    if nid not in nodes or nodes[nid]['kind'] != 'SubSkill':
        raise ValueError('node event requires an existing SubSkill')
    if nodes[nid].get('merge_target'):
        raise ValueError('source is already merged; use its canonical ID (cycle rejected)')
    old = copy.deepcopy(nodes[nid])
    if kind == 'merge':
        target = request['to_node_id']
        if target not in nodes or nodes[target]['kind'] != 'SubSkill':
            raise ValueError('merge target requires an existing SubSkill')
        target = canonical_id(target,nodes)
        if target == nid:
            raise ValueError('merge cycle or self merge')
        if normalize(nodes[target]['path'][0]) != normalize(old['path'][0]):
            raise ValueError('merge cannot cross subjects')
        nodes[nid]['merge_target'] = target
        for name in [old['name'], *old['aliases']]:
            if normalize(name) != normalize(nodes[target]['name']) and name not in nodes[target]['aliases']:
                nodes[target]['aliases'].append(name)
        changes = [{'path':'/nodes/'+nid+'/merge_target','previous_value':None,'new_value':target}]
    else:
        name = request['new_name'].strip()
        if normalize(name) == normalize(old['name']):
            raise ValueError('rename has no change')
        nodes[nid]['name'] = name; nodes[nid]['path'][-1] = name
        if old['name'] not in nodes[nid]['aliases']:
            nodes[nid]['aliases'].append(old['name'])
        changes = [{'path':'/nodes/'+nid+'/name','previous_value':old['name'],'new_value':name}]
    nodes[nid].setdefault('history',[]).append({**event_meta,'kind':kind,'reason':request['reason'],'changes':changes})
    check_aliases(nodes)
    return changes


def replay(records, events=()):
    catalog = {'schema_version':'1.1','projection_version':'1.1','knowledge_catalog_version':'1.1',
               'mastery_model_version':'evidence-v1','nodes':{},'relations':[],
               'needs_review':[], 'suppressed_relations':[]}
    effective = {}; record_ids = {r['id'] for r in records}
    buckets = {}
    last_anchor = 0
    for event in events:
        anchor = event['after_mistake_id']
        if anchor not in record_ids or int(anchor[1:]) < last_anchor:
            raise ValueError('invalid event attempt anchor/order')
        last_anchor = int(anchor[1:]); buckets.setdefault(anchor,[]).append(event)
    for original in records:
        record = copy.deepcopy(original)
        if record['schema_version']=='1.0':
            # V1 hashes only covered the draft, so also retain its binding check.
            legacy = copy.deepcopy(record['diagnosis'])
            for k in legacy['diagnosis']['knowledge']:
                k['canonicalization']={'action':'CREATE','candidate_ids':[],'reason':'legacy exact identity replay'}
            expected,_,_=resolve_details(legacy,catalog)
            if expected != record['knowledge_mapping']:
                raise ValueError('stored knowledge mapping differs from legacy canonical replay')
        register_bound(record['diagnosis'],record['knowledge_mapping'],catalog)
        record['revision_history'] = []
        record['feedback_history'] = []
        effective[record['id']] = record
        for event in buckets.get(record['id'],[]):
            req = event['request']
            if req['kind'] == 'revision':
                target = effective.get(req['target_mistake_id'])
                if target is None or target['diagnosis']['attempt_key'] != req['target_attempt_key']:
                    raise ValueError('revision target attempt mismatch')
                if digest(target['diagnosis']) != req['expected_effective_hash']:
                    raise ValueError('stale effective diagnosis hash')
                validate_replacement(target['diagnosis'],req['replacement'])
                changes = field_changes(target['diagnosis'], req['replacement'])
                if changes != event['changes']:
                    raise ValueError('revision audit changes mismatch')
                register_bound(req['replacement'],event['knowledge_mapping'],catalog)
                target['diagnosis'] = copy.deepcopy(req['replacement'])
                target['knowledge_mapping'] = copy.deepcopy(event['knowledge_mapping'])
                target['canonicalization_decisions'] = copy.deepcopy(event['canonicalization_decisions'])
                target['revision_history'].append({k:event[k] for k in ('event_id','created_at','request','changes')})
            elif req['kind'] == 'feedback':
                target = effective.get(req['target_mistake_id'])
                validate_feedback(req, target, records)
                if event['changes'] or event['knowledge_mapping'] or event['canonicalization_decisions']:
                    raise ValueError('feedback cannot change diagnosis or knowledge bindings')
                target['feedback_history'].append({k:event[k] for k in ('event_id','created_at','request')})
            else:
                changes = node_change(req,catalog,{k:event[k] for k in ('event_id','created_at')})
                if changes != event['changes']:
                    raise ValueError('node event audit changes mismatch')
    return catalog, list(effective.values())


def validate_feedback(request, target, records):
    if target is None or target['diagnosis']['attempt_key'] != request['target_attempt_key']:
        raise ValueError('feedback target attempt mismatch')
    if digest(target['diagnosis']) != request['expected_effective_hash']:
        raise ValueError('stale effective diagnosis hash')
    original = next(r for r in records if r['id']==request['target_mistake_id'])
    changed = original['diagnosis'] != target['diagnosis']
    if request['verdict']=='confirmed_unchanged' and changed:
        raise ValueError('confirmed_unchanged requires unchanged original diagnosis')
    if request['verdict']=='confirmed_correction' and not changed:
        raise ValueError('confirmed_correction requires a revised diagnosis')


def add_observation(node, event):
    outcome = event['outcome']; types = event['error_types']; at = event['at']
    node['exposure_count'] += 1; node['last_seen_at'] = at
    if outcome == 'correct':
        node['correct_count'] += 1; node['last_correct_at'] = at
    if outcome == 'wrong':
        node['wrong_count'] += 1; node['last_wrong_at'] = at
    if outcome == 'partial': node['partial_count'] += 1
    node['hint_required_count'] += int(event['hint_required'])
    node['independent_success_count'] += int(event['independent'])
    if types:
        node['repeated_error_count'] += int(any(node['error_counts'].get(t,0) for t in types))
        node['last_wrong_at'] = at
        for t in types: node['error_counts'][t] = node['error_counts'].get(t,0)+1
    node['evidence_events'].append(event)
    scored = [e for e in node['evidence_events'] if e['outcome'] in ('correct','partial','wrong')]
    weight = sum(e['confidence'] for e in scored)
    def credit(e):
        if e['outcome']=='wrong': return 0
        if e['outcome']=='partial' or e['understanding']!='understood': return .4
        return 1 if e['independent'] else .6
    node['mastery_score'] = round(100*(1+sum(credit(e)*e['confidence'] for e in scored))/(2+weight),2) if weight else None
    node['confidence'] = round(weight/(weight+3),4)


def project(records, events=()):
    catalog, effective = replay(records,events)
    nodes = catalog['nodes']
    for r in effective:
        diag = r['diagnosis']['diagnosis']; mapping = r['knowledge_mapping']
        grouped = {}
        for k in diag['knowledge']:
            original_id = mapping[k['key']]
            if original_id is None:
                catalog['needs_review'].append({'mistake_id':r['id'],'knowledge_key':k['key'],'path':k['path'],
                    'decision':r.get('canonicalization_decisions',{}).get(k['key'],{}),'evidence':k['evidence']})
                continue
            if k['outcome']=='unobserved': continue
            nid = canonical_id(original_id,nodes)
            types = sorted({e['type'] for e in diag['errors'] if k['key'] in e['knowledge_keys']})
            grouped.setdefault(nid,[]).append({**copy.deepcopy(k),'original_node_id':original_id,'error_types':types})
        for nid, observations in grouped.items():
            # A post-hoc merge can collapse two historical skills in one attempt.
            # Count once, retain every component and use conservative observed outcome.
            rank = {'unknown':0,'correct':1,'partial':2,'wrong':3}
            chosen = max(observations,key=lambda o:rank[o['outcome']])
            ev = {k:chosen[k] for k in ('outcome','understanding','confidence')}
            ev.update(mistake_id=r['id'], at=r['created_at'],
                      revision_ids=[e['event_id'] for e in r['revision_history']],
                      original_node_ids=sorted({o['original_node_id'] for o in observations}),
                      source_observations=observations,
                      hint_required=any(o['hint_required'] for o in observations),
                      independent=all(o['independent'] for o in observations),
                      evidence=[e for o in observations for e in o['evidence']],
                      error_types=sorted({t for o in observations for t in o['error_types']}))
            add_observation(nodes[nid],ev)
        for rel in diag['relations']:
            source, target = mapping[rel['from_key']],mapping[rel['to_key']]
            edge = {k:rel[k] for k in ('type','reason','confidence')}
            edge.update(mistake_id=r['id'],original_from_id=source,original_to_id=target)
            if source is None or target is None:
                edge['suppressed_reason']='unresolved node'; catalog['suppressed_relations'].append(edge); continue
            edge.update(from_id=canonical_id(source,nodes),to_id=canonical_id(target,nodes))
            if edge['from_id']==edge['to_id']:
                if source==target: raise ValueError('self relation is not allowed')
                edge['suppressed_reason']='collapsed by merge'; catalog['suppressed_relations'].append(edge); continue
            catalog['relations'].append(edge)
    acyclic(catalog['relations'])
    for n in nodes.values():
        n['canonical_id'] = canonical_id(n['id'],nodes)
    return catalog


def display_math(expression):
    """Only an explicitly declared formula is math; never guess from prose or '/'."""
    expression = expression.strip()
    for left, right in (('$$', '$$'), ('$', '$'), (r'\[', r'\]'), (r'\(', r'\)')):
        if expression.startswith(left) and expression.endswith(right):
            expression = expression[len(left):-len(right)].strip()
            break
    return '$$\n' + expression + '\n$$'


def render(record, tz_name="UTC", catalog=None, review=False):
    d = record['diagnosis']; inp = d['input']; diag = d['diagnosis']
    presentation = diag.get('presentation', {})
    labels = {t['id']: t['label'] for t in taxonomy()['types']}
    roles = {'primary':'首要卡点','secondary':'独立后续错误','propagated':'前错传递'}
    states = {'understood':'有理解证据','memorized':'记得但理解未证实','gap':'存在缺口','misconception':'存在误解','unknown':'待确认'}
    outcomes = {'correct':'本次正确','partial':'部分完成','wrong':'本次错误','unknown':'表现待确认','unobserved':'未观察'}
    errors = '\n'.join(f"- {e['step_id']} · {labels[e['type']]}（{roles[e['role']]}，置信度 {e['confidence']:.0%}）：{e['cause']}\n  - 原话：{e['evidence']}\n  - 修复：{e['repair']}" for e in diag['errors']) or '未确认具体错误。'
    knowledge = '\n'.join(f"- {' → '.join(k['path'])}：{states[k['understanding']]} / {outcomes[k['outcome']]}" for k in diag['knowledge']) or '待补充'
    formulas = '\n\n'.join(display_math(f['expression']) + '\n\n' + '；'.join(f'{s}：{v}' for s,v in sorted(f['symbols'].items())) + '\n\n适用条件：' + '；'.join(f['conditions']) for f in diag['formulas']) or '本题暂无可确认的公式。'
    derivations = '\n\n'.join(f"{f['why_here']}\n\n{f['derivation']}" for f in diag['formulas']) or '待补充或本题不适用。'
    values = {'id':record['id'],'title':d['title'],'created_at':human_time(record['created_at'],tz_name)+' ('+tz_name+')',
              'source':inp['source'],'source_location':inp.get('source_location') or '未提供','error_types':'、'.join(dict.fromkeys(labels[e['type']] for e in diag['errors'])) or '暂无确定分类',
              'status':{'complete':'已完成','needs_information':'待补充信息'}[diag['status']],'question':presentation.get('question',inp['question']),
              'student_solution':'\n'.join(f"- **{s['id']}**：{presentation.get('student_solution',{}).get(s['id'],s['text'])}" for s in inp['student_solution']),
              'student_answer':presentation.get('student_answer',inp['student_answer']) or '未作答 / 未提供',
              'correct_answer':presentation.get('correct_answer') or inp['correct_answer'] or diag['derived_answer'] or '待确认',
              'answer_status':{'provided':'输入提供','independently_derived':'AI 独立推导','unverified':'尚未验证'}[diag['answer_status']], 'first_blocked_step':diag['first_blocked_step'] or '证据不足，尚不能定位',
              'summary':diag['summary'],'errors':errors,'knowledge':knowledge,'formulas':formulas,'derivations':derivations,
              'reasoning':'\n'.join(f'{i}. {v}' for i,v in enumerate(diag['correct_reasoning'],1)) or '信息不足，不补造解答。',
              'triggers':'\n'.join('- '+x for x in diag['trigger_conditions']) or '待确认',
              'transfer':'\n'.join('- '+x for x in diag['transfer_questions']) or '待补充',
              'missing':'\n'.join('- '+x for x in diag['missing_information']) or '无',
              'weak':'、'.join(k['path'][-1] for k in diag['knowledge'] if k['understanding'] in ('gap','memorized','misconception')) or '暂无足够证据',
              'mastered':'、'.join(k['path'][-1] for k in diag['knowledge'] if k['understanding']=='understood' and k['outcome']=='correct') or '暂无足够证据'}
    if catalog is not None:
        values['knowledge'] = '\n'.join(
            '- ' + ' → '.join(catalog['nodes'][canonical_id(record['knowledge_mapping'][k['key']],catalog['nodes'])]['path'])
            + f"：{states[k['understanding']]} / {outcomes[k['outcome']]}"
            if record['knowledge_mapping'][k['key']] else '- '+' → '.join(k['path'])+'（知识归属待确认）'
            for k in diag['knowledge']) or '待补充'
    values.update(date=human_time(record['created_at'],tz_name,True),
                  short_errors='\n'.join('- '+e['cause'] for e in diag['errors']) or '暂未确认，请先核对题目与过程。',
                  must_know='、'.join(k['path'][-1] for k in diag['knowledge']),
                  short_formulas='\n\n'.join(display_math(f['expression']) for f in diag['formulas']),
                  short_why='\n'.join(f['why_here'] for f in diag['formulas']) or diag['summary'])
    if catalog is not None:
        values['must_know']='、'.join(dict.fromkeys(
            catalog['nodes'][canonical_id(nid,catalog['nodes'])]['name'] if nid else k['path'][-1]+'（归属待确认）'
            for k in diag['knowledge'] for nid in [record['knowledge_mapping'][k['key']]]))
    template_name = 'review-card.md' if review else 'mistake-card.md'
    template = (BASE/'templates'/template_name).read_text(encoding='utf-8')
    text = re.sub(r'\{\{(\w+)\}\}', lambda m: str(values[m[1]]), template)
    if review:
        if diag['missing_information']:
            text += '\n解题前仍需确认：'+'；'.join(diag['missing_information'])+'\n'
        return text
    text += '\n## 知识证据与追踪\n\n'
    for k in diag['knowledge']:
        nid = record['knowledge_mapping'][k['key']]
        current = canonical_id(nid,catalog['nodes']) if catalog and nid else nid
        text += f"- {k['key']}：历史绑定 {nid or '待确认'} → 当前 {current or '待确认'}；置信度 {k['confidence']:.0%}\n"
        for ev in k['evidence']:
            text += '- 原话：'+ev['quote']+'；依据：'+ev['reason']+'\n'
    if d.get('supplemental_evidence'):
        text += '\n## 后续补充证据\n\n'
        text += '\n'.join('- '+e['id']+' ('+e['source']+')：'+e['text'] for e in d['supplemental_evidence'])+'\n'
    text += '\n## 修订审计\n\n'
    for event in record.get('revision_history',[]):
        req=event['request']
        text += f"- {event['event_id']} · {human_time(event['created_at'],tz_name)} · {req['source']}：{req['reason']}\n"
        text += '  - 说明：'+req['explanation']+'\n'
        text += '  - 字段：'+ '、'.join(c['path'] for c in event['changes'])+'\n'
    if not record.get('revision_history'): text += '无后续诊断修订。\n'
    text += '\n原始事实：`data/'+record['id']+'.json`；修订全文与字段前后值：`events/`。\n'
    return text


def atomic_write(path, text):
    path = Path(path); path.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(prefix='.writing-', dir=path.parent)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as stream:
            stream.write(text); stream.flush(); os.fsync(stream.fileno())
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


@contextmanager
def locked(root):
    # flock is released by the OS on process death; no stale lock removal race.
    import fcntl
    root.mkdir(parents=True, exist_ok=True)
    with (root / '.store.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        yield


def recover(root):
    journal = root / '.pending.json'
    if journal.exists():
        entries = read(journal)
        for relative, content in entries.items():
            dest = (root / relative).resolve()
            if not dest.is_relative_to(root.resolve()):
                raise ValueError('invalid journal path')
            if relative.startswith(('data/', 'events/')) and dest.exists():
                if dest.read_text(encoding='utf-8') != content:
                    raise ValueError('journal would overwrite an immutable fact')
                continue
            atomic_write(dest, content)
        journal.unlink()


def commit(root, outputs):
    atomic_write(root / '.pending.json', encoded(outputs))
    recover(root)


def load_records(root):
    records = []
    attempt_keys = set()
    for file in sorted((root / 'data').glob('M*.json'), key=lambda p: int(p.stem[1:])):
        record = read(file)
        check_schema(record, 'mistake.schema.json')
        validate(record['diagnosis'])
        if file.stem != record['id']:
            raise ValueError('record id / filename mismatch')
        if hashlib.sha256(encoded(record['diagnosis']).encode()).hexdigest() != record['content_hash']:
            raise ValueError('record content hash mismatch; restore original before rebuilding')
        if record.get('record_hash') and digest({k:v for k,v in record.items() if k!='record_hash'}) != record['record_hash']:
            raise ValueError('record envelope hash mismatch')
        key = record['diagnosis']['attempt_key']
        if key in attempt_keys:
            raise ValueError('duplicate historical attempt_key')
        attempt_keys.add(key)
        records.append(record)
    return records


def load_events(root):
    events = []; previous = None; keys = set()
    for path in sorted((root/'events').glob('E*.json')):
        event = read(path); check_schema(event,'event.schema.json')
        if event['event_id'] != f'E{len(events)+1:06d}' or path.stem != event['event_id']:
            raise ValueError('event sequence or filename mismatch')
        if event['previous_event_hash'] != previous or digest(event['request']) != event['request_hash']:
            raise ValueError('event hash chain/request mismatch')
        if digest({k:v for k,v in event.items() if k!='event_hash'}) != event['event_hash']:
            raise ValueError('event content hash mismatch')
        if event['request']['event_key'] in keys:
            raise ValueError('duplicate event key')
        keys.add(event['request']['event_key']); previous = event['event_hash']; events.append(event)
    return events


def display_timezone(root, override=None):
    from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
    config = read(root/'config.json') if (root/'config.json').exists() else {}
    name = override or config.get('timezone','UTC')
    try: ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError, TypeError) as exc:
        raise ValueError(f'invalid IANA timezone: {name}') from exc
    return name


def human_time(timestamp, tz_name, date_only=False):
    from zoneinfo import ZoneInfo
    instant = datetime.fromisoformat(timestamp.replace('Z','+00:00'))
    if instant.tzinfo is None:
        raise ValueError('machine timestamp must have an explicit offset')
    return instant.astimezone(ZoneInfo(tz_name)).strftime('%Y-%m-%d' if date_only else '%Y-%m-%d %H:%M')


def outputs_for(records, catalog, events=(), tz_name='UTC'):
    result = {'knowledge/catalog.json': encoded(catalog)}
    _, effective = replay(records,events)
    for record in effective:
        full = render(record,tz_name,catalog)
        result[f"notes/{record['id']}.md"] = full  # V1 compatibility projection
        result[f"notes/diagnosis/{record['id']}.md"] = full
        result[f"notes/review/{record['id']}.md"] = render(record,tz_name,catalog,review=True)
    return result


def save(draft, root, tz_name=None):
    validate(draft); root = Path(root); content_hash = digest(draft)
    with locked(root):
        recover(root); tz_name = display_timezone(root,tz_name)
        records = load_records(root); events = load_events(root)
        for old in records:
            if old['diagnosis']['attempt_key'] == draft['attempt_key']:
                if old['content_hash'] != content_hash:
                    raise ValueError('attempt_key already exists with different content; use a revision event')
                commit(root,outputs_for(records,project(records,events),events,tz_name))
                return old,False
        before = project(records,events)
        mapping, _, decisions = resolve_details(draft,before)
        next_id = max((int(r['id'][1:]) for r in records),default=0)+1
        record = {'schema_version':'1.1','id':f'M{next_id:04d}',
                  'created_at':datetime.now(timezone.utc).isoformat(),'content_hash':content_hash,
                  'diagnosis':copy.deepcopy(draft),'knowledge_mapping':mapping,
                  'canonicalization_decisions':decisions,'mastery_updates':{},
                  'review':{'status':'not_scheduled','last_reviewed_at':None,'scheduler':None}}
        after = project([*records,record],events)
        record['mastery_updates']={nid:{'before':before['nodes'].get(nid,{}).get('mastery_score'),
                                      'after':after['nodes'][nid]['mastery_score'],'model_version':'evidence-v1'}
                                   for nid in mapping.values() if nid is not None}
        record['record_hash']=digest(record)
        check_schema(record,'mistake.schema.json')
        outputs=outputs_for([*records,record],after,events,tz_name)
        outputs[f"data/{record['id']}.json"] = encoded(record)
        commit(root,outputs)
        return record,True


def append_event(request, root, tz_name=None):
    check_schema(request,'event-request.schema.json'); root=Path(root)
    with locked(root):
        recover(root); tz_name=display_timezone(root,tz_name)
        records=load_records(root); events=load_events(root)
        request_hash=digest(request)
        for event in events:
            if event['request']['event_key']==request['event_key']:
                if event['request_hash']!=request_hash:
                    raise ValueError('event_key already exists with different content')
                commit(root,outputs_for(records,project(records,events),events,tz_name))
                return event,False
        if not records: raise ValueError('event requires an existing attempt/node')
        catalog=project(records,events)
        event={'schema_version':'2.0' if request['kind']=='feedback' else '1.1','event_id':f'E{len(events)+1:06d}',
               'created_at':datetime.now(timezone.utc).isoformat(),'after_mistake_id':records[-1]['id'],
               'previous_event_hash':events[-1]['event_hash'] if events else None,
               'request_hash':request_hash,'request':copy.deepcopy(request),
               'changes':[],'knowledge_mapping':{},'canonicalization_decisions':{}}
        if request['kind']=='revision':
            _, effective=replay(records,events)
            target=next((r for r in effective if r['id']==request['target_mistake_id']),None)
            if target is None or target['diagnosis']['attempt_key']!=request['target_attempt_key']:
                raise ValueError('revision target attempt mismatch')
            if digest(target['diagnosis'])!=request['expected_effective_hash']:
                raise ValueError('stale effective diagnosis hash')
            validate_replacement(target['diagnosis'],request['replacement'])
            mapping,_,decisions=resolve_details(request['replacement'],catalog,allow_collapsed=True)
            event.update(changes=field_changes(target['diagnosis'],request['replacement']),
                         knowledge_mapping=mapping,canonicalization_decisions=decisions)
        elif request['kind']=='feedback':
            _, effective=replay(records,events)
            target=next((r for r in effective if r['id']==request['target_mistake_id']),None)
            validate_feedback(request,target,records)
        else:
            if digest(catalog)!=request['expected_catalog_hash']:
                raise ValueError('stale catalog hash')
            event['changes']=node_change(request,copy.deepcopy(catalog),{k:event[k] for k in ('event_id','created_at')})
        event['event_hash']=digest(event)
        check_schema(event,'event.schema.json')
        all_events=[*events,event]
        after=project(records,all_events)
        outputs=outputs_for(records,after,all_events,tz_name)
        outputs[f"events/{event['event_id']}.json"]=encoded(event)
        commit(root,outputs)
        return event,True


def rebuild(root, tz_name=None):
    root=Path(root)
    with locked(root):
        recover(root); tz_name=display_timezone(root,tz_name)
        records=load_records(root); events=load_events(root)
        catalog=project(records,events)
        commit(root,outputs_for(records,catalog,events,tz_name))
        return catalog


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root',type=Path,default=Path('mistakes'))
    parser.add_argument('--timezone',help='IANA zone; overrides root/config.json; default UTC')
    sub=parser.add_subparsers(dest='command',required=True)
    for name in ('validate','save','apply-event','plan-nodes'):
        sub.add_parser(name).add_argument('input',type=Path)
    for name in ('rebuild','catalog'): sub.add_parser(name)
    sub.add_parser('effective').add_argument('mistake_id')
    args=parser.parse_args()
    try:
        if args.command=='validate':
            validate(read(args.input)); print('valid')
        elif args.command=='save':
            record,created=save(read(args.input),args.root,args.timezone)
            print(encoded({'id':record['id'],'created':created,
                           'json':str((args.root/'data'/f"{record['id']}.json").resolve()),
                           'diagnosis_card':str((args.root/'notes/diagnosis'/f"{record['id']}.md").resolve()),
                           'review_card':str((args.root/'notes/review'/f"{record['id']}.md").resolve())}))
        elif args.command=='apply-event':
            event,created=append_event(read(args.input),args.root,args.timezone)
            print(encoded({'event_id':event['event_id'],'created':created,'changes':event['changes']}))
        elif args.command=='rebuild':
            rebuild(args.root,args.timezone); print('rebuilt')
        else:
            with locked(args.root):
                recover(args.root)
                records=load_records(args.root); events=load_events(args.root)
                catalog=project(records,events)
                if args.command=='catalog':
                    print(encoded({'catalog_hash':digest(catalog),**catalog}))
                elif args.command=='plan-nodes':
                    draft=read(args.input); validate(draft)
                    _,_,decisions=resolve_details(draft,catalog); print(encoded(decisions))
                else:
                    _,effective=replay(records,events)
                    record=next((r for r in effective if r['id']==args.mistake_id),None)
                    if record is None: raise ValueError('unknown mistake ID')
                    print(encoded({'effective_hash':digest(record['diagnosis']),**record}))
    except (ValueError,OSError,KeyError) as exc:
        parser.exit(2,f'error: {exc}\n')


if __name__=='__main__': main()
