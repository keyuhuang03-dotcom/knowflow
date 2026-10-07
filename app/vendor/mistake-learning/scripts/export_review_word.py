#!/usr/bin/env python3
"""Printable Word projection from effective records, never from cached Markdown.

Run with the document workspace runtime. Requires python-docx.
Equations are native editable Word OMML; prose is never interpreted as math.
"""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess

from docx import Document
from docx.shared import Cm, Pt, RGBColor
from docx.oxml.ns import qn
from docx.enum.text import WD_ALIGN_PARAGRAPH
from word_math import equation

MATH = re.compile(r'\$\$(.*?)\$\$|(?<!\\)\$([^$\n]+)\$', re.S)


def export_card(markdown, destination):
    """Convert the Skill's headings, lists, emphasis and explicit math to Word."""
    doc = Document()
    for border in doc.styles.element.xpath(".//w:pBdr"):
        border.getparent().remove(border)
    section = doc.sections[0]
    section.page_width=Cm(21); section.page_height=Cm(29.7)
    section.top_margin=section.bottom_margin=Cm(1.7)
    section.left_margin=section.right_margin=Cm(1.8)
    for name in ('Normal','Title','Heading 1','Heading 2','List Bullet','List Number'):
        style=doc.styles[name]; style.font.name='Songti SC'; style.font.size=Pt(11)
        style.font.color.rgb=RGBColor(0,0,0)
        style.element.get_or_add_rPr().get_or_add_rFonts().set(qn('w:eastAsia'),'Songti SC')
        style.paragraph_format.space_after=Pt(5)
        style.paragraph_format.line_spacing=1.15
    doc.styles['Title'].font.size=Pt(18)
    doc.styles['Title'].font.bold=True
    for name in ('Heading 1','Heading 2'):
        doc.styles[name].font.size=Pt(12)
        doc.styles[name].font.bold=True
        doc.styles[name].paragraph_format.space_before=Pt(9)
        doc.styles[name].paragraph_format.keep_with_next=True
    doc.core_properties.title='错题复习卡'
    doc.core_properties.author=''

    def plain(p,text):
        for i,part in enumerate(re.split(r'\*\*(.*?)\*\*',text)):
            run=p.add_run(part);run.bold=bool(i%2)
    def rich(p,text):
        pos=0
        for match in MATH.finditer(text):
            plain(p,text[pos:match.start()])
            expression=(match.group(1) or match.group(2)).strip()
            p._p.append(equation(expression))
            pos=match.end()
        plain(p,text[pos:])
    # Keep display equations intact while splitting text into paragraphs.
    for block in re.split(r'(\$\$.*?\$\$)',markdown,flags=re.S):
        if not block.strip():continue
        if block.startswith('$$'):
            p=doc.add_paragraph();p.alignment=WD_ALIGN_PARAGRAPH.CENTER
            rich(p,block);continue
        for line in block.splitlines():
            line=line.strip()
            if not line:continue
            if line.startswith('# '):
                title=re.sub(r'[｜：:|]',' ',line[2:])
                doc.add_paragraph(title,'Title')
            elif line.startswith('## '):doc.add_paragraph(line[3:],'Heading 1')
            elif line.startswith('- '):rich(doc.add_paragraph(style='List Bullet'),line[2:])
            elif re.match(r'\d+\. ',line):rich(doc.add_paragraph(style='List Number'),re.sub(r'^\d+\. ','',line))
            else:rich(doc.add_paragraph(),line)
    destination=Path(destination);destination.parent.mkdir(parents=True,exist_ok=True)
    temporary=destination.with_suffix('.tmp.docx')
    doc.save(temporary);os.replace(temporary,destination)


def export_reviews(root,store_python='python3'):
    root=Path(root).resolve()
    # Storage validation runs in the existing project environment; document
    # authoring uses the bundled document runtime and its dependencies.
    code = """
import json,sys
from pathlib import Path
sys.path.insert(0,sys.argv[1])
import mistake_store as store
root=Path(sys.argv[2])
with store.locked(root):
    store.recover(root)
    records=store.load_records(root);events=store.load_events(root)
    catalog=store.project(records,events)
    _,effective=store.replay(records,events)
    tz=store.display_timezone(root)
    print(json.dumps({r['id']:store.render(r,tz,catalog,review=True) for r in effective}))
"""
    snapshot=subprocess.run([str(store_python),'-c',code,str(Path(__file__).parent.resolve()),str(root)],check=True,capture_output=True,text=True)
    result=[]
    for identifier,markdown in json.loads(snapshot.stdout).items():
        output=root/'notes/review'/f'{identifier}.docx'
        export_card(markdown,output)
        result.append(str(output))
    return result

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root',type=Path,default=Path('mistakes'))
    parser.add_argument('--store-python',default='python3')
    args=parser.parse_args()
    print(json.dumps(export_reviews(args.root,args.store_python),ensure_ascii=False,indent=2))
