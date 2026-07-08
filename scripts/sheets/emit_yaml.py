import json
PROF=5
SK=['acrobatics','animal-handling','arcana','athletics','deception','history','insight',
'intimidation','investigation','medicine','nature','perception','performance','persuasion',
'religion','sleight-of-hand','stealth','survival']
SKAB={'acrobatics':'dex','animal-handling':'wis','arcana':'int','athletics':'str','deception':'cha',
'history':'int','insight':'wis','intimidation':'cha','investigation':'int','medicine':'wis',
'nature':'int','perception':'wis','performance':'cha','persuasion':'cha','religion':'int',
'sleight-of-hand':'dex','stealth':'dex','survival':'wis'}
SAVES=['str','dex','con','int','wis','cha']
SCORES={
 'cruucar':dict(str=20,dex=12,con=14,int=12,wis=12,cha=11),
 'noctis': dict(str=9,dex=20,con=10,int=6,wis=10,cha=16),
 'vane':   dict(str=10,dex=19,con=16,int=16,wis=14,cha=20)}
FILES={'cruucar':'sources/character-sheets/cruucar/ddb-78231335.json',
 'noctis':'sources/character-sheets/noctis/ddb-63485208.json',
 'vane':'sources/character-sheets/vane/ddb-93088472.json'}
FULL2AB={'strength':'str','dexterity':'dex','constitution':'con','intelligence':'int','wisdom':'wis','charisma':'cha'}
def amod(s):return (s-10)//2
def parse(slug):
    d=json.load(open(FILES[slug]))['data']; sc=SCORES[slug]
    mods=[]; [mods.extend(g) for g in d.get('modifiers',{}).values()]
    prof=set();exp=set();half=set();bon={};svp=set()
    for m in mods:
        t=m.get('type');st=m.get('subType');v=m.get('value') or 0
        if st in SKAB:
            if t=='proficiency':prof.add(st)
            elif t=='expertise':exp.add(st)
            elif t=='half-proficiency':half.add(st)
            elif t=='bonus':bon[st]=bon.get(st,0)+v
        elif st and st.endswith('-saving-throws') and t=='proficiency':
            full=st[:-len('-saving-throws')]
            svp.add(FULL2AB.get(full))
    skills={}
    for sk in SK:
        m=amod(sc[SKAB[sk]])
        if sk in exp:m+=2*PROF
        elif sk in prof:m+=PROF
        elif sk in half:m+=PROF//2
        m+=bon.get(sk,0); skills[sk]=m
    saves={sv:amod(sc[sv])+(PROF if sv in svp else 0) for sv in SAVES}
    return dict(skills=skills,expert=sorted(exp),saves=saves,saves_prof=sorted([x for x in svp if x],key=SAVES.index))

# Displayed-mod characters (from sheets/pastes)
def disp(skvals, expert, saves, sp):
    return dict(skills=dict(zip(SK,skvals)),expert=expert,saves=dict(zip(SAVES,saves)),saves_prof=sp)
DATA={}
DATA['cruucar']=parse('cruucar')
DATA['vane']=parse('vane')
n=parse('noctis'); n['saves']['str']=amod(SCORES['noctis']['str']); n['saves_prof']=['dex','int']; n['saves']['int']=amod(SCORES['noctis']['int'])+PROF; DATA['noctis']=n
DATA['berrian']=disp([3,6,0,6,5,0,6,5,0,1,0,6,5,10,0,3,3,6],[],[7,9,9,6,12,16],['wis','cha'])
DATA['torgoth']=disp([2,4,5,9,0,1,9,5,1,4,1,9,0,0,5,2,2,4],[],[9,2,7,1,4,0],['str','con'])
DATA['quinton']=disp([4,7,4,-1,9,4,4,14,4,4,4,12,14,14,4,4,4,4],['intimidation','perception','performance','persuasion'],[-3,7,4,2,2,9],['dex','cha'])

def fm(v): return f"{{ "+", ".join(f"{k}: {x}" for k,x in v.items())+" }"
for slug,d in DATA.items():
    print(f"\n##### {slug} #####")
    print("  skills: "+fm(d['skills']))
    print(f"  skills_expert: [{', '.join(d['expert'])}]")
    print("  saves: "+fm(d['saves']))
    print(f"  saves_prof: [{', '.join(d['saves_prof'])}]")

# --- insertion into canon frontmatter ---
import os
def block(d):
    return ["  skills: "+fm(d['skills']),
            f"  skills_expert: [{', '.join(d['expert'])}]",
            "  saves: "+fm(d['saves']),
            f"  saves_prof: [{', '.join(d['saves_prof'])}]"]
for slug,d in DATA.items():
    path=f"canon/characters/{slug}.md"
    lines=open(path).read().split("\n")
    if any(l.strip().startswith('skills:') for l in lines[:60]):
        print(f"skip {slug} (already has skills)"); continue
    out=[]; done=False
    for l in lines:
        out.append(l)
        if not done and l.startswith('  abilities:'):
            out.extend(block(d)); done=True
    assert done, f"no abilities line in {slug}"
    open(path,'w').write("\n".join(out))
    print(f"inserted into {slug}")
