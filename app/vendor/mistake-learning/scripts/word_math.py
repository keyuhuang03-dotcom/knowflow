"""Small explicit LaTeX-to-OMML converter for review cards.

Unsupported commands raise an error rather than printing raw LaTeX silently.
Ordinary prose is never passed to this parser.
"""
import re
from docx.oxml import OxmlElement
from docx.oxml.ns import qn


def element(name,*children):
    node=OxmlElement('m:'+name)
    for child in children:node.append(child)
    return node


def text(value):
    node=element('t');node.text=value
    node.set(qn('xml:space'),'preserve')
    return element('r',node)


class Parser:
    SYMBOLS={'int':'∫','ln':'ln','log':'log','arctan':'arctan','sin':'sin','cos':'cos','tan':'tan',
             'lim':'lim','sum':'∑','prod':'∏','infty':'∞','ne':'≠','neq':'≠','le':'≤','ge':'≥',
             'leq':'≤','geq':'≥','to':'→','rightarrow':'→','cdot':'·','times':'×','pm':'±',
             'prime':'′','pi':'π','alpha':'α','beta':'β','theta':'θ','Delta':'Δ','partial':'∂',
             'quad':'  ','qquad':'    ','lvert':'|','rvert':'|','vert':'|','lbrace':'{','rbrace':'}'}
    def __init__(self,source):
        self.tokens=re.findall(r'\\[a-zA-Z]+|\\.|[^\s]',source)
        self.index=0
    def peek(self):return self.tokens[self.index] if self.index<len(self.tokens) else None
    def pop(self):
        token=self.peek()
        if token is None:raise ValueError('Incomplete LaTeX equation')
        self.index+=1;return token
    def group(self):
        if self.peek()=='{':
            self.pop();nodes=self.sequence('}')
            if self.pop()!='}':raise ValueError('Unbalanced LaTeX braces')
            return nodes
        return [self.atom()]
    def atom(self):
        token=self.pop()
        if token=='{':
            nodes=self.sequence('}');self.pop();return element('box',element('e',*nodes))
        if token==r'\frac':return element('f',element('num',*self.group()),element('den',*self.group()))
        if token==r'\sqrt':
            degree=[]
            if self.peek()=='[':
                self.pop();degree=self.sequence(']');self.pop()
            prop=element('radPr')
            hidden=element('degHide');hidden.set(qn('m:val'),'0' if degree else '1');prop.append(hidden)
            return element('rad',prop,element('deg',*degree),element('e',*self.group()))
        if token in (r'\mathrm',r'\text',r'\operatorname'):
            return element('box',element('e',*self.group()))
        if token.startswith('\\'):
            name=token[1:]
            if name in self.SYMBOLS:return text(self.SYMBOLS[name])
            if name in (',',';',' ','!'):return text(' ' if name!='!' else '')
            if name in ('{','}','_','%','$'):return text(name)
            raise ValueError(f'Unsupported LaTeX command: {token}')
        if token in ('}','^','_'):raise ValueError(f'Unexpected LaTeX token: {token}')
        return text(token)
    def sequence(self,stop=None):
        result=[]
        while self.peek() is not None and self.peek()!=stop:
            if self.peek() in (r'\left',r'\right'):
                self.pop();continue
            base=self.atom();sup=sub=None
            while self.peek() in ('^','_'):
                marker=self.pop();value=self.group()
                if marker=='^':sup=value
                else:sub=value
            if sup is not None and sub is not None:base=element('sSubSup',element('e',base),element('sub',*sub),element('sup',*sup))
            elif sup is not None:base=element('sSup',element('e',base),element('sup',*sup))
            elif sub is not None:base=element('sSub',element('e',base),element('sub',*sub))
            result.append(base)
        return result


def equation(source):
    parser=Parser(source);nodes=parser.sequence()
    return element('oMath',*nodes)
