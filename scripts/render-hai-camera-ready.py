"""Build the vector chain figure and source-grounded prompt supplement offline."""
import json
import textwrap
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Preformatted, Table, TableStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# Embed the fonts in both the manuscript figure and the reading supplement.
for name, filename in [('PaperSans', 'arial.ttf'), ('PaperSans-Bold', 'arialbd.ttf'),
                       ('PaperSans-Italic', 'ariali.ttf'), ('PaperSans-BoldItalic', 'arialbi.ttf'),
                       ('PaperMono', 'consola.ttf')]:
    pdfmetrics.registerFont(TTFont(name, str(Path('C:/Windows/Fonts') / filename)))
pdfmetrics.registerFontFamily('PaperSans', normal='PaperSans', bold='PaperSans-Bold',
                            italic='PaperSans-Italic', boldItalic='PaperSans-BoldItalic')

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / 'experiments/hai-2026-camera-ready'
OUT = ROOT / 'output/pdf/hai-2026-camera-ready-draft'
OUT.mkdir(parents=True, exist_ok=True)

def figure():
    p = WORK / 'source/figures/feedback-chain.pdf'
    c = canvas.Canvas(str(p), pagesize=(504, 132), initialFontName='PaperSans')
    c.setTitle('Immediate order effects and mediated writeback effects')
    def label(x, y, text, size=8, bold=False, color='#20262b'):
        c.setFillColor(colors.HexColor(color))
        c.setFont('PaperSans-Bold' if bold else 'PaperSans', size)
        c.drawString(x, y, text)
    blocks = [(0, 113, '#f1eee8'), (120, 148, '#e9eff1'), (275, 229, '#eef1eb')]
    for x, width, fill in blocks:
        c.setFillColor(colors.HexColor(fill))
        c.rect(x, 27, width, 105, fill=1, stroke=0)
    label(8, 117, 'A  ACTIVATION', 8, True)
    label(128, 117, 'B  IMMEDIATE ORDER EFFECT', 8, True)
    label(283, 117, 'C  MEDIATED WRITEBACK EFFECT', 8, True)
    for x, y, t in [
        (8,99,'Activate task evidence'),(8,85,'vs. keep it held'),
        (8,63,'Current Top-10 changes'),
        (128,99,'Same records, different order'),(128,85,'-> Current LLM choice'),
        (283,99,'Selected item -> history -> later shelf'),
        (283,85,'-> Later LLM choice (same provider)')]: label(x,y,t)
    label(8,46,'0.765 displacement',8,True)
    label(128,63,'Choice distance: DS .193 / MiMo .147',7.4,True)
    label(128,46,'Masked input controls: near zero',7.4)
    label(283,63,'Later choice: DS .035 / MiMo .017',8,True)
    label(283,46,'Selected identities may now differ between arms',7.4)
    c.setStrokeColor(colors.HexColor('#737d84'))
    c.setDash(3, 2)
    c.line(0, 19, 504, 19)
    label(0,6,'Research path: task evidence -> displayed order -> immediate choice -> writeback -> later shelf and choice.',7.5)
    c.save()

def supplement():
    styles = getSampleStyleSheet()
    for style in styles.byName.values():
        if hasattr(style, 'fontName'):
            style.fontName = 'PaperSans-Bold' if 'Bold' in style.fontName else 'PaperSans'
    styles.add(ParagraphStyle(name='BodyS', fontName='PaperSans', fontSize=9.5, leading=12.5, spaceAfter=7))
    styles.add(ParagraphStyle(name='CodeS', fontName='PaperMono', fontSize=7.1, leading=9))
    story=[]
    def p(text): story.append(Paragraph(text, styles['BodyS']))
    def h(text): story.append(Paragraph(text, styles['Heading2']))
    def code(text, width=103):
        lines=[]
        for line in text.splitlines():
            lines.extend(textwrap.wrap(line, width, replace_whitespace=False, drop_whitespace=False, break_on_hyphens=False) or [''])
        story.append(Preformatted('\n'.join(lines), styles['CodeS']))
        story.append(Spacer(1,8))
    examples = {provider: json.loads((WORK / f'supplement/{provider}-served-order-requests.json').read_text(encoding='utf-8')) for provider in ['deepseek','mimo']}
    audit=json.loads((WORK/'supplement/prompt-invariance-audit.json').read_text())
    story.append(Paragraph('Supplementary Material S1<br/>Prompt record and paired-input audit', styles['Title']))
    p('From Shelf Order to Later Agent Choice: A Link-by-Link Audit of Recommendation Writeback')
    h('1. What the order-only comparison changes')
    p('Study 2 compares the same offered records in two candidate-array orders. The agent chooses one offered identifier or abandons. Candidate attributes and the rest of the request stay fixed within each provider and task-model unit. The two repeats of an arm use the same input. The masked control uses the same complete input in all four conditions.')
    p('The examples below are copied from locally retained successful request payloads, not reconstructed prompts. The selected unit is industrial-and-scientific / 03d99ea294e5d4d9 / GRU4Rec, the first stored served-order row with a changed order, chosen independently of model output. Complete request JSON for all four conditions and both providers accompanies this PDF. HTTP headers, credentials, raw provider responses, and original Amazon identifiers are excluded.')
    h('2. Why these two providers')
    p('The study used two available API providers with machine-readable categorical output. The protocol frozen before the full run designated DeepSeek as the primary analysis and MiMo as a second-provider replication. This design tests whether the path appears in both evaluated systems. It does not sample the LLM population or separate architecture effects from provider-specific serving and prompting. The provider labels refer to the requested aliases used in August 2026; the archived run summaries retain returned model metadata.')
    h('3. Common controls and provider-specific wrappers')
    p('Both providers used temperature 0, a 96-token output cap and JSON-object output mode. DeepSeek used chat-completions with system/user messages and thinking disabled. MiMo used Responses instructions/input with reasoning effort none. Neither run used a provider-enforced JSON Schema: the requested keys were described in the instructions and checked by the local action parser.')
    p('DeepSeek adds an illustrative JSON shape containing view|select|abandon. The terminal instruction and parser restrict this phase to select or abandon. MiMo Study 2 has no appended shape example. These historical differences are retained verbatim. They are fixed within each provider comparison, not claimed to be identical across providers.')
    p('The shared instruction refers to a required recommendation inspection. This is inherited controller wording held fixed in Study 2: served-order candidate records all carry inspected=false and omit platformRank. The inspection-only mode is a separate manipulation. The prompt record does not retroactively rewrite the instruction.')
    for provider in ['deepseek','mimo']:
        story.append(PageBreak())
        h(f'4{ "a" if provider == "deepseek" else "b"}. Complete {provider} example: immediate-a')
        request=examples[provider]['requests']['immediate-a']
        if provider=='deepseek':
            system=request['messages'][0]['content']; raw=request['messages'][1]['content']
        else: system=request['instructions'];raw=request['input']
        p('<b>System / instructions (verbatim text, wrapped for reading)</b>')
        code(system)
        p('<b>User / input</b> (all values preserved; whitespace expanded below)')
        state=json.loads(raw)
        other={k:v for k,v in state.items() if k!='candidates'}
        code(json.dumps(other,indent=2))
        candidate_lines = []
        for i, row in enumerate(state['candidates']):
            line = '  {'
            for j, (key, value) in enumerate(row.items()):
                token = json.dumps(key) + ':' + json.dumps(value) + (',' if j < len(row)-1 else '')
                if len(line) + len(token) > 99:
                    candidate_lines.append(line)
                    line = '   '
                line += token
            candidate_lines.append(line + '}' + (',' if i < len(state['candidates'])-1 else ''))
        code('"candidates": [\n'+'\n'.join(candidate_lines)+'\n]')
        p('<b>Transport settings</b>')
        settings={k:v for k,v in request.items() if k not in ['messages','instructions','input']}
        code(json.dumps(settings,indent=2))
    story.append(PageBreak())
    h('5. Paired order and complete response contract')
    request=examples['deepseek']['requests']
    orders={cond:[r['candidateId'] for r in json.loads(request[cond]['messages'][1]['content'])['candidates']] for cond in ['immediate-a','held-a']}
    rows=[['Position','Immediate (A/B)','Held (A/B)']]+[[str(i+1),orders['immediate-a'][i],orders['held-a'][i]] for i in range(12)]
    table=Table(rows,colWidths=[65,175,175]); table.setStyle(TableStyle([('FONTNAME',(0,0),(-1,-1),'PaperSans'),('FONTNAME',(0,0),(-1,0),'PaperSans-Bold'),('FONTSIZE',(0,0),(-1,-1),9),('BOTTOMPADDING',(0,0),(-1,-1),3),('LINEBELOW',(0,0),(-1,0),.6,colors.black),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,colors.HexColor('#f2f3f4')])]))
    story.append(table);story.append(Spacer(1,12))
    p('Both providers use the same paired order for this unit. The A and B suffixes denote repeated calls, not different prompts. Each identifier maps to exactly the same record in either order.')
    p('Requested response fields: action, candidateId, confidence. The local terminal parser accepts select or abandon; a selected identifier must belong to the offered set. Abandon is normalized to a null identifier. Numeric confidence is retained when present; missing or nonnumeric confidence is normalized to null, not treated as a failed action. Constraint compliance and task quality are evaluated separately. Thus JSON-object output mode is not a strict schema or a hard-constraint enforcement mechanism.')
    h('6. Offline audit of the frozen requests')
    for provider in ['deepseek','mimo']:
        a=audit['providers'][provider]
        p(f'<b>{provider}:</b> {a["requestsChecked"]:,} requests; {a["servedUnits"]} served-order units; {a["maskedUnits"]} masked-control units. No non-order input or wrapper mismatch was found. {a["orderChangedUnits"]} units had different served orders; the remaining 20 stayed in the analysis. All masked-control payloads were identical within unit. No retry instruction was present in the checked successful payloads.')
    p('The audit compares wrappers, non-candidate state, identifier-indexed candidate records, repeated inputs, and masked payloads. It inspects the successful cached requests used for the reported results; it does not certify provider internals or stationarity, nor audit every unsuccessful transport attempt. The accompanying JSON records code hashes, example cache keys, and counts. No provider call or new experiment was made for this audit.')
    h('7. How downstream and product-language inputs differ')
    p('Study 3 uses a next-task-terminal input containing the later shelf and features derived against a held-out next item: constraintMatch, taskUtility, intentSimilarity, priceSimilarity, and historyNovelty. Selected-item identity has already mediated writeback, so later candidate content may differ. Study 2 order-only invariance is not asserted for this mediated comparison. MiMo Study 3 additionally appends a select|abandon JSON example.')
    p('The product-language extension uses an ordinary-language shoppingRequest and cleaned title, brand, and price records. It uses its own instructions to choose a qualifying candidate and treats catalog text as data. Its three-step continuation is a fixed policy, not three further LLM decisions. The archived runners retain these distinct prompt builders.')
    doc=SimpleDocTemplate(str(OUT/'HAI2026_S1_Prompt_Record.pdf'),pagesize=(595.28,841.89),rightMargin=42,leftMargin=42,topMargin=42,bottomMargin=54,title='HAI 2026 Supplementary Material S1: Prompt record')
    def footer(c,doc):
        c.setFont('PaperSans',8);c.drawString(42,23,'HAI 2026 / Supplementary Material S1');c.drawRightString(553,23,str(doc.page))
    doc.build(story,onFirstPage=footer,onLaterPages=footer,
              canvasmaker=lambda *args, **kwargs: canvas.Canvas(*args, **{**kwargs, 'initialFontName': 'PaperSans'}))

if __name__=='__main__':
    figure();supplement()
