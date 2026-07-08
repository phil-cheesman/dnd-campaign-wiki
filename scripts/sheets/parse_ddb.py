import json, sys

PROF = 5  # level 15
SKILLS = {  # skill subType -> ability
 'acrobatics':'dex','animal-handling':'wis','arcana':'int','athletics':'str',
 'deception':'cha','history':'int','insight':'wis','intimidation':'cha',
 'investigation':'int','medicine':'wis','nature':'int','perception':'wis',
 'performance':'cha','persuasion':'cha','religion':'int','sleight-of-hand':'dex',
 'stealth':'dex','survival':'wis'}
SAVES = {'strength':'str','dexterity':'dex','constitution':'con',
 'intelligence':'int','wisdom':'wis','charisma':'cha'}

# Final ability scores from canon frontmatter (authoritative)
SCORES = {
 'cruucar': dict(str=20,dex=12,con=14,int=12,wis=12,cha=11),
 'noctis':  dict(str=9, dex=20,con=10,int=6, wis=10,cha=16),
 'vane':    dict(str=10,dex=19,con=16,int=16,wis=14,cha=20),
}
FILES = {
 'cruucar':'sources/character-sheets/cruucar/ddb-78231335.json',
 'noctis': 'sources/character-sheets/noctis/ddb-63485208.json',
 'vane':   'sources/character-sheets/vane/ddb-93088472.json',
}

def amod(score): return (score-10)//2

def parse(slug):
    d=json.load(open(FILES[slug]))['data']
    sc=SCORES[slug]
    mods=[]
    for grp in d.get('modifiers',{}).values():
        mods.extend(grp)
    # collect per subType the set of types + summed bonus
    prof=set(); expert=set(); halfprof=set(); bonus={}
    save_prof=set()
    for m in mods:
        t=m.get('type'); st=m.get('subType'); v=m.get('value') or 0
        if st in SKILLS:
            if t=='proficiency': prof.add(st)
            elif t=='expertise': expert.add(st)
            elif t=='half-proficiency': halfprof.add(st)
            elif t=='bonus': bonus[st]=bonus.get(st,0)+v
        elif st and st.endswith('-saving-throws'):
            base=st[:-len('-saving-throws')]
            if base in SAVES and t=='proficiency': save_prof.add(base)
    out={'skills':{}, 'saves':{}}
    for sk,ab in SKILLS.items():
        m=amod(sc[ab])
        flag=''
        if sk in expert: m+=2*PROF; flag='E'
        elif sk in prof: m+=PROF; flag='P'
        elif sk in halfprof: m+=PROF//2; flag='h'
        m+=bonus.get(sk,0)
        out['skills'][sk]=(m,flag,bonus.get(sk,0))
    for sv,ab in SAVES.items():
        m=amod(sc[ab])
        f=''
        if sv in save_prof: m+=PROF; f='P'
        out['saves'][sv]=(m,f)
    return out

for slug in FILES:
    r=parse(slug)
    print(f"\n=== {slug} ===")
    print("SKILLS:")
    for sk,(m,f,b) in r['skills'].items():
        tag=f" [{f}]" if f else ""
        bt=f" (+{b} item)" if b else ""
        print(f"  {sk:18} {'+' if m>=0 else ''}{m}{tag}{bt}")
    print("SAVES:", {sv:(('+' if m>=0 else '')+str(m))+(f and f) for sv,(m,f) in r['saves'].items()})
