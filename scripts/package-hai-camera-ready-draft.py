"""Validate and package an AUTHOR-REVIEW draft, never a final submission.

No API calls, credentials, uploads, or eRights completion. Uses a file allowlist.
"""
import hashlib
import json
import re
import shutil
import zipfile
from pathlib import Path

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / 'experiments/hai-2026-camera-ready'
OUT = ROOT / 'output/pdf/hai-2026-camera-ready-draft'
OLD = ROOT / 'experiments/hai-2026-poster'
RELEASE = ROOT / 'output/pdf/hai-2026-poster-release'


def require(ok, message):
    if not ok:
        raise RuntimeError(message)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def extract(text, start, end):
    return text.split(start, 1)[1].split(end, 1)[0].strip()


def font_audit(pdf):
    found = {}
    visited = set()

    def resources(res):
        res = res.get_object()
        for font in res.get('/Font', {}).get_object().values() if '/Font' in res else []:
            f = font.get_object()
            descendants = f.get('/DescendantFonts', [f])
            for child in descendants:
                child = child.get_object()
                desc = child.get('/FontDescriptor', {})
                desc = desc.get_object() if hasattr(desc, 'get_object') else desc
                name = str(child.get('/BaseFont', f.get('/BaseFont', 'unknown')))
                embedded = any(k in desc for k in ['/FontFile', '/FontFile2', '/FontFile3'])
                found[name] = found.get(name, True) and embedded
        xobjects = res.get('/XObject', {})
        xobjects = xobjects.get_object() if hasattr(xobjects, 'get_object') else xobjects
        for obj in xobjects.values():
            identity = (getattr(obj, 'idnum', None), getattr(obj, 'generation', None))
            if identity in visited:
                continue
            visited.add(identity)
            obj = obj.get_object()
            if '/Resources' in obj:
                resources(obj['/Resources'])

    for page in PdfReader(pdf).pages:
        resources(page['/Resources'])
    require(found and all(found.values()), f'Unembedded fonts in {pdf.name}: {found}')
    return found


def zip_allowlist(target, entries):
    require(len({name for _, name in entries}) == len(entries), 'Duplicate ZIP entry')
    with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as z:
        for path, name in entries:
            require(path.is_file(), f'Missing {path}')
            require(not name.startswith('/') and '..' not in Path(name).parts, 'Unsafe archive path')
            require(not Path(name).name.startswith('.env'), 'Environment files prohibited')
            z.write(path, name)
    return {'sha256': sha(target), 'entries': [name for _, name in entries]}


def main():
    current = (WORK / 'source/main.tex').read_text(encoding='utf-8')
    original = (OLD / 'main.tex').read_text(encoding='utf-8')
    results = lambda text: extract(text, r'\section{Results}', r'\section{Implications and Limits}')
    require(results(current) == results(original), 'Results differ from submitted source')
    require(extract(current, r'\title{', '}') == extract(original, r'\title{', '}'), 'Accepted title changed')
    require(sha(WORK / 'source/references.bib') == sha(OLD / 'references.bib'), 'Bibliography changed')
    disclosure = lambda text: extract(text, r'\paragraph{Generative AI disclosure.}', r'\balance')
    require(disclosure(current) == disclosure(original), 'AI disclosure changed')
    require(r'\documentclass[sigconf]{acmart}' in current, 'Wrong template option')
    require(r'\Description{' in current and r'\begin{CCSXML}' in current, 'Missing figure alt text/CCS')
    rights = (WORK / 'source/rights.tex').read_text(encoding='utf-8')
    for line in [r'\copyrightyear{2026}', r'\acmYear{2026}', r'\setcopyright{cc}',
                 r'\setcctype{by}', r'\acmDOI{10.1145/3841580.3845761}',
                 r'\acmISBN{979-8-4007-2575-3/2026/11}']:
        require(line in rights, f'ACM eRights metadata missing: {line}')
    email = extract(current, r'\email{', '}')
    require(email == '2354251@tongji.edu.cn', 'Email differs from author-confirmed eRights email')
    author = extract(current, r'\author{', '}')
    orcid = extract(current, r'\orcid{', '}')
    require(author == 'Kaiqi Feng', 'Author name differs from author-confirmed eRights name')
    require(orcid == '0009-0006-1970-9572', 'ORCID differs from author-supplied identifier')
    total = 0
    digits = orcid.replace('-', '')
    for digit in digits[:15]:
        total = (total + int(digit)) * 2
    check = (12 - total % 11) % 11
    require(digits[-1] == ('X' if check == 10 else str(check)), 'Invalid ORCID checksum')
    audit = json.loads((WORK / 'supplement/prompt-invariance-audit.json').read_text())
    require(audit['passed'], 'Offline audit failed')
    require(sum(x['requestsChecked'] for x in audit['providers'].values()) == 14720, 'Audit count changed')
    pages = [(p.extract_text() or '') for p in PdfReader(OUT / 'main.pdf').pages]
    require(len(pages) == 3, 'Expected 2 content pages and 1 references-only page')
    for phrase in ['10.1145/3841580.3845761', '979-8-4007-2575-3/2026/11',
                   'Creative Commons Attribution 4.0', email]:
        require(phrase in pages[0], f'Publication metadata absent from first page: {phrase}')
    require('1308825834@qq.com' not in '\n'.join(pages), 'Old email remains in manuscript')
    require(author in pages[0], 'Confirmed author name absent from first page')
    require('Kaiqi FENG' not in '\n'.join(pages), 'Old author capitalization remains')
    require('Generative AI disclosure' in pages[1] and 'References' in pages[2], 'Content spilled beyond page 2')
    for heading in ['Implications and Limits', 'Generative AI disclosure', 'Research Storefront and Protocols']:
        require(heading not in pages[2], f'Body heading on references page: {heading}')
    require(len(PdfReader(OUT / 'HAI2026_S1_Prompt_Record.pdf').pages) == 4, 'S1 pagination changed')
    fonts = {name: font_audit(OUT / name) for name in ['main.pdf', 'HAI2026_S1_Prompt_Record.pdf']}
    log = (OUT / 'main.log').read_text(encoding='utf-8')
    require('Overfull \\hbox' not in log, 'Horizontal text overflow')
    require('undefined references' not in log.lower(), 'Unresolved references')
    draft = OUT / 'HAI2026_1206_RESTORED_FIGURE_DRAFT.pdf'
    shutil.copyfile(OUT / 'main.pdf', draft)
    source_entries = [(WORK / 'source' / name, 'source/' + name) for name in
                      ['main.tex', 'references.bib', 'acmart.cls', 'ACM-Reference-Format.bst', 'figures/feedback-chain-restored.pdf']]
    if (WORK / 'source/rights.tex').is_file():
        source_entries.append((WORK / 'source/rights.tex', 'source/rights.tex'))
    source_entries.append((draft, 'pdf/main.pdf'))
    source_zip = OUT / 'HAI2026_1206_DRAFT_Source.zip'
    source_info = zip_allowlist(source_zip, source_entries)
    supplement_entries = [(OUT / 'HAI2026_S1_Prompt_Record.pdf', 'HAI2026_S1_Prompt_Record.pdf')]
    supplement_entries += [(WORK / 'supplement' / name, name) for name in
                           ['README.md', 'deepseek-served-order-requests.json', 'mimo-served-order-requests.json',
                            'prompt-invariance-audit.json', 'deepseek-summary-original.json', 'mimo-summary-original.json']]
    supplement_entries.append((RELEASE / 'HAI2026_Anonymous_Artifact.zip', 'HAI2026_Anonymous_Artifact.zip'))
    supplement_entries += [(ROOT / 'scripts' / name, 'provenance/' + name) for name in
                           ['prepare-hai-camera-ready.py', 'render-hai-camera-ready.py']]
    supplement_zip = OUT / 'HAI2026_1206_DRAFT_Supplement.zip'
    supplement_info = zip_allowlist(supplement_zip, supplement_entries)
    title = extract(current, r'\title{', '}')
    abstract = ' '.join(extract(current, r'\begin{abstract}', r'\end{abstract}').split()).replace('--', '–')
    require(len(abstract.split()) <= 150, 'Abstract exceeds the PCS 150-word limit')
    keywords = extract(current, r'\keywords{', '}')
    fields = f'''# PCS camera-ready fields — draft

Do not upload this author-review draft as the final version. First match the final title/author metadata with eRights and the final PDF.

## Title

{title}

## Abstract

{abstract}

## Keywords

{keywords}

## Author details (confirmed by author)

{author}; College of Design and Innovation, Tongji University; Shanghai, China; {email}.

ORCID: {orcid}. Author name, ORCID and email were confirmed by the author. The ORCID passes a local checksum check; account ownership was not independently verified.

Keep authorship unchanged. This document is a local copy/paste aid, not a submitted PCS form; check that the live PCS/eRights records match.

## Outstanding publication tasks

ACM eRights is complete. The supplied CC BY block, DOI 10.1145/3841580.3845761 and ISBN 979-8-4007-2575-3/2026/11 are incorporated; pagination is checked locally. Author name, email and ORCID are synchronized in the local source. Complete final supplemental-license and production checks, then upload final files to both Sheridan and PCS and check TAPS proofs. Register for in-person presentation. Latest supplied deadline: 2026-09-10 19:59 Beijing/Singapore (2026-09-09 23:59 AoE).
'''
    (WORK / 'PCS_CAMERA_READY_FIELDS.md').write_text(fields, encoding='utf-8')
    report = {'status': 'AUTHOR_REVIEW_DRAFT_NOT_FOR_UPLOAD', 'localChecksPassed': True,
              'resultsUnchanged': True, 'acceptedTitleUnchanged': True, 'bibliographyUnchanged': True,
              'aiDisclosureUnchanged': True, 'mainPages': 3, 'supplementPages': 4,
              'abstractWhitespaceWords': len(abstract.split()), 'fontEmbedding': fonts,
              'draftPdfSha256': sha(draft), 'sourceArchive': source_info, 'supplementArchive': supplement_info,
              'eRights': {'confirmationReceived': True, 'license': 'CC BY 4.0',
                          'doi': '10.1145/3841580.3845761', 'isbn': '979-8-4007-2575-3/2026/11',
                          'authorConfirmedEmail': email, 'authorConfirmedName': author,
                          'authorSuppliedOrcid': orcid, 'orcidChecksumValid': True,
                          'firstPageBlockChecked': True},
              'originalReleaseSha256': {name: sha(RELEASE / name) for name in
                                       ['HAI2026_Poster_Anonymous.pdf', 'HAI2026_Poster_Source.zip', 'HAI2026_Anonymous_Artifact.zip']},
              'pending': ['Final supplemental-material licensing/provenance audit', 'Current publisher package/template check',
                          'Publisher-side TAPS validation, proof approval and both required submissions'],
              'layoutNotes': re.findall(r'Overfull \\vbox[^\n]*', log)}
    (OUT / 'DRAFT_VALIDATION.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps({k: v for k, v in report.items() if k not in ['fontEmbedding', 'sourceArchive', 'supplementArchive']}, indent=2))


if __name__ == '__main__':
    main()
