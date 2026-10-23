import math, random, html
from pathlib import Path
OUT=Path(__file__).parent/'assets'
OUT.mkdir(exist_ok=True)
random.seed(17)

COLORS={'rose':('#f6bcc8','#cf7d99','#fff0ee','#a95476'), 'lilac':('#d5c1e8','#9880bd','#f3e7fa','#756291'), 'cream':('#fff2d3','#e6c48b','#fff9e9','#d5a66b'), 'peach':('#ffd0bd','#ec987c','#fff0db','#c97563'), 'pink':('#f4a5bb','#cc6487','#ffe2e9','#a94d73'), 'white':('#fcf3ed','#d8c9c7','#ffffff','#c1b3b6'), 'blue':('#d3dbea','#93a9bf','#f1f3fa','#6d859e')}

D='''<defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fbf4f0"/><stop offset="1" stop-color="#eee3eb"/></linearGradient>
<linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#ebe0e3"/><stop offset="1" stop-color="#e1d4d8"/></linearGradient>
<linearGradient id="stem" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#607b63"/><stop offset=".5" stop-color="#8ea08c"/><stop offset="1" stop-color="#5a735b"/></linearGradient>
<linearGradient id="leaf" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#acb9a0"/><stop offset=".5" stop-color="#7c967e"/><stop offset="1" stop-color="#56755f"/></linearGradient>
<filter id="blur"><feGaussianBlur stdDeviation="18"/></filter>
<filter id="petalShadow" x="-70%" y="-70%" width="240%" height="240%"><feDropShadow dx="1" dy="7" stdDeviation="6" flood-color="#6e4861" flood-opacity=".16"/></filter>
'''
for k,(light,mid,edge,dark) in COLORS.items():
 D+=f'<radialGradient id="{k}" cx="41%" cy="27%" r="80%"><stop offset="0" stop-color="{edge}"/><stop offset=".44" stop-color="{light}"/><stop offset=".8" stop-color="{mid}"/><stop offset="1" stop-color="{dark}"/></radialGradient>'
D+='</defs>'

def blossom(x,y,r,color='rose',petals=8,rotate=0):
 # front-facing floral discs with layered petals; petal shape curved upwards and pointed towards rim
 s=f'<g transform="translate({x} {y}) rotate({rotate})" filter="url(#petalShadow)">'
 for layer in range(3):
  n=petals+(1 if layer==1 else 0)
  rr=r*(1-.20*layer)
  op=(.92 if layer==0 else .95)
  for i in range(n):
   theta=i*360/n + layer*12
   width=rr*.56
   s+=f'<g transform="rotate({theta:.2f})"><path d="M 0 0 C {-width:.1f} {-rr*.17:.1f} {-width*1.12:.1f} {-rr*.68:.1f} {-width*.56:.1f} {-rr:.1f} C 0 {-rr*1.20:.1f} {width*.72:.1f} {-rr:.1f} {width*.7:.1f} {-rr*.72:.1f} C {width*.6:.1f} {-rr*.27:.1f} {width*.24:.1f} {-rr*.1:.1f} 0 0 Z" fill="url(#{color})" opacity="{op}" stroke="#fff9f5" stroke-opacity=".25" stroke-width="1.2"/></g>'
 s+=f'<circle r="{r*.145}" fill="#f2d3a7"/><circle r="{r*.083}" fill="#b98b68"/>'
 for j in range(9):
  a=2*math.pi*j/9
  s+=f'<circle cx="{math.cos(a)*r*.105:.1f}" cy="{math.sin(a)*r*.105:.1f}" r="{r*.021}" fill="#fff0b5"/>'
 return s+'</g>'

def leaf(x,y,angle,scale=1):
 return f'<g transform="translate({x} {y}) rotate({angle}) scale({scale})"><path d="M0 0 C -15 -27 -22 -92 21 -138 C 67 -78 47 -18 0 0 Z" fill="url(#leaf)" opacity=".98"/><path d="M0 0 Q22 -77 21 -138" stroke="#dbdbc1" stroke-width="2" fill="none" opacity=".65"/></g>'

def stem(x,y,base_x,base_y,thick=12):
 cx=(x+base_x)/2+22
 s=f'<path d="M{x} {y} C {x+28} {y+230} {cx-48} {base_y-180} {base_x} {base_y}" fill="none" stroke="url(#stem)" stroke-width="{thick}" stroke-linecap="round"/>'
 for frac,angle in [(0.37,-42),(0.58,55),(0.77,-48)]:
  py=y+(base_y-y)*frac; px=x+(base_x-x)*frac + math.sin(frac*math.pi)*17
  s+=leaf(round(px),round(py),angle,scale=round(thick/12*1.07,2))
 return s

def flower(x,y,r,c,base_x=None,base_y=964,n=8):
 bx=base_x if base_x is not None else x+22
 return stem(x,y+22,bx,base_y,thick=max(7,round(r/11)))+blossom(x,y,r,c,n)

def background(w,h,circle=True):
 s=f'<rect width="{w}" height="{h}" fill="url(#bg)"/>'
 s+=f'<path d="M0 {h*.84} Q {w*.48} {h*.79} {w} {h*.83} L{w} {h} H0 Z" fill="url(#floor)" opacity=".7"/>'
 if circle:
  s+=f'<ellipse cx="{w*.55}" cy="{h*.42}" rx="{w*.37}" ry="{h*.33}" fill="#fffaf9" opacity=".48"/>'
 s+=f'<ellipse cx="{w*.49}" cy="{h*.885}" rx="{w*.28}" ry="24" fill="#6e5968" opacity=".16" filter="url(#blur)"/>'
 return s

def save(name,w,h,fls,typ=None,bg=True):
 sv=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" role="img" aria-label="Декоративная визуализация больших цветов">'+D
 if bg: sv+=background(w,h)
 for f in fls: sv+=flower(*f)
 sv+='</svg>'
 (OUT/name).write_text(sv,encoding='utf-8')

save('rose-garden.svg',800,980,[(175,330,130,'rose',212,958,9),(472,210,145,'cream',430,953,10),(650,428,107,'pink',576,953,9)],'trio')
save('lilac-dream.svg',800,980,[(200,270,134,'lilac',276,952,9),(492,420,145,'rose',489,952,10),(625,225,104,'white',564,952,9)])
save('peach-poppy.svg',800,980,[(405,250,230,'peach',412,954,7)])
save('peony-cloud.svg',800,980,[(275,295,132,'pink',310,956,11),(500,250,156,'rose',457,956,12),(590,475,98,'cream',560,956,10),(205,532,90,'lilac',265,956,9)])
save('ivory-garden.svg',800,980,[(205,415,113,'cream',260,956,9),(425,252,156,'white',430,956,11),(638,450,123,'lilac',550,956,9)])
save('lavender-arch.svg',800,980,[(190,315,125,'lilac',280,958,10),(390,185,140,'pink',408,958,10),(610,325,121,'blue',525,958,10)])
# wide illustration, no bg for hero
s=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 940 930" role="img" aria-label="Большие декоративные цветы ручной работы">'+D
s+='<ellipse cx="535" cy="862" rx="340" ry="27" fill="#6c5360" opacity=".14" filter="url(#blur)"/>'
for f in [(240,390,150,'lilac',305,860,9),(570,230,200,'rose',505,860,12),(783,437,150,'cream',645,860,10),(465,520,122,'peach',462,860,8),(125,612,96,'white',295,860,10)]: s+=flower(*f)
s+='</svg>'
(OUT/'hero-blooms.svg').write_text(s,encoding='utf-8')
print('SVG assets:',[p.name for p in OUT.iterdir()])
