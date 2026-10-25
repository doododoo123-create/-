#!/usr/bin/env python3
"""Sample-free, non-melodic material/impact SFX, Saguk Classic v2.
Requires Python 3, numpy, scipy, ffmpeg. No external recordings, samples or IRs.
"""
from pathlib import Path
import hashlib, json, subprocess, wave
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

SR=44100
ROOT=Path(__file__).resolve().parent
PACK=ROOT/'saguk_classic_v2'
MASTERS=ROOT/'masters'
R=np.random.default_rng(2026102502)
SOUNDS=[]

def tvec(d):return np.arange(round(d*SR))/SR
def blank(d):return np.zeros(round(d*SR))
def put(dst,src,at=0,gain=1):
    j=round(at*SR)
    if j<0:src=src[-j:];j=0
    n=min(len(src),len(dst)-j)
    if n>0:dst[j:j+n]+=gain*src[:n]
    return dst

def band(x,lo=0,hi=0,order=2):
    if lo and hi:sos=butter(order,[lo,hi],fs=SR,btype='bandpass',output='sos')
    elif lo:sos=butter(order,lo,fs=SR,btype='highpass',output='sos')
    elif hi:sos=butter(order,hi,fs=SR,btype='lowpass',output='sos')
    else:return x
    return sosfilt(sos,x)
def noise(d,lo=100,hi=7000):return band(R.normal(0,1,round(d*SR)),lo,hi)
def peak(x):return x/(max(1e-9,float(np.max(np.abs(x)))))
def ends(x,attack=.0003,release=.008):
    x=x.copy();a=min(len(x)//3,round(attack*SR));b=min(len(x)//3,round(release*SR))
    if a:x[:a]*=np.linspace(0,1,a)
    if b:x[-b:]*=np.linspace(1,0,b)
    return x

def body(d,centers,decays,weights,spread=.07):
    # Three slightly separated modes per group disperse a pure ringing note.
    t=tvec(d);y=blank(d)
    for c,dec,w in zip(centers,decays,weights):
        for k in range(3):
            f=c*R.uniform(1-spread,1+spread)
            phase=R.uniform(-.25,.25)
            y+=w/3*np.sin(2*np.pi*f*t+phase)*np.exp(-t/(dec*R.uniform(.8,1.2)))
    return ends(y)

def bone_hit(strength=1,cloth=False):
    # Short hard contact, many dry object modes, with a low table response.
    d=.10 if not cloth else .075;t=tvec(d)
    contact=noise(d,950,9500)*np.exp(-t/(.0013+strength*.0008))
    obj=body(d,[730,1370,2180,3240,4870],[.007,.010,.006,.004,.0025],
             [.14,.25,.18,.15,.08],.15)
    table=body(d,[185,340,620],[.019,.013,.008],[.2,.10,.06],.12)
    y=contact*.38+obj*.38+table*.55
    y=band(y,100,6000 if not cloth else 3100)
    return peak(ends(y))*strength*(.57 if cloth else 1)

def wood_knock(d=.17,weight=.6,dull=False):
    t=tvec(d)
    y=noise(d,200,4800 if dull else 7200)*np.exp(-t/.0025)*.3
    y+=body(d,[210,480,930,1670,2790],[.025,.018,.011,.007,.004],[.23,.23,.14,.08,.05],.18)
    return peak(ends(y))*weight

def leather(d=.27,weight=.4):
    t=tvec(d)
    y=noise(d,140,2500)*np.exp(-t/.014)
    y+=noise(d,70,650)*np.exp(-t/.04)*.4
    return peak(ends(y))*weight

def rub(d=.45,kind='paper',weight=.25):
    t=tvec(d);u=t/d
    lo,hi={'paper':(700,6400),'cloth':(280,2900),'leather':(110,2100),'grit':(400,5000)}[kind]
    y=noise(d,lo,hi)
    slow=band(R.normal(0,1,len(t)),0,45)
    slow=peak(slow)
    y*=np.sin(np.pi*u)**.8*(.4+.6*np.abs(slow))
    # Sparse tiny creases add nonstationary physical detail.
    for _ in range(max(2,int(d*18))):
        at=R.uniform(.02,d-.015);width=R.uniform(.002,.008)
        crack=noise(width,lo,hi)*np.hanning(round(width*SR))
        put(y,crack,at,.09)
    return peak(ends(y,.004,.02))*weight

def drum(d=.8,size='large',weight=.8,muted=False):
    f={'large':73,'medium':108,'tight':156}[size]*R.uniform(.97,1.03)
    t=tvec(d);y=blank(d)
    for k,(ratio,amp) in enumerate([(1,1),(1.593,.38),(2.135,.24),(2.296,.16),(2.653,.13),(2.918,.08),(3.155,.06)]):
        decay=(.14 if muted else .29)/(1+k*.31)
        # Membrane tension shift is subtle, avoiding a synth 'boing' glide.
        phase=2*np.pi*f*ratio*(t+.022*.008*(1-np.exp(-t/.008)))
        y+=amp*np.sin(phase+R.uniform(-.09,.09))*np.exp(-t/decay)
    y+=noise(d,90,4500)*np.exp(-t/.013)*.5
    y+=noise(d,170,1300)*np.exp(-t/.08)*.12
    y=band(y,35,4100)
    return peak(ends(y,.0008,.04))*weight

def metal(d=.6,heavy=False,weight=.55):
    # Dense inharmonic modes and scraping contact: no note or melodic gesture.
    t=tvec(d);n=42 if heavy else 30
    frequencies=np.exp(R.uniform(np.log(170 if heavy else 650),np.log(5800),n))
    y=blank(d)
    for f in frequencies:
        decay=(.22 if heavy else .075)*(2600/(f+1600))
        y+=np.sin(2*np.pi*f*t+R.uniform(-.4,.4))*np.exp(-t/decay)/np.sqrt(n)
    y+=noise(d,1200,10000)*np.exp(-t/.018)*.50
    y=band(y,110,5700)
    return peak(ends(y,.0004,.025))*weight

def gong(d=2,weight=.7,low=True):
    t=tvec(d);y=blank(d)
    # A broad low bronze plate, without pitched bell/chime partials.
    frequencies=np.r_[R.uniform(85,430,18),R.uniform(450,2400,52)]
    for f in frequencies:
        decay=(.36+1.0/(1+(f/650)**1.3))*R.uniform(.65,1)
        env=np.exp(-t/decay)*(1-np.exp(-t/(.008+(f<300)*.01)))
        y+=np.sin(2*np.pi*f*t+R.uniform(-.8,.8))*env/(3+(f/220)**.48)
    y+=noise(d,180,5100)*np.exp(-t/.065)*.38
    if not low:y=band(y,240,4300)
    else:y=band(y,55,2800)
    return peak(ends(y,.001,.13))*weight

def gust(d=1.5,weight=.20):
    t=tvec(d);slow=peak(band(R.normal(0,1,len(t)),0,9))
    y=noise(d,100,2200)*(.5+.5*np.abs(slow))*np.sin(np.pi*t/d)**1.2
    return peak(ends(y,.03,.10))*weight

def foot(d=.24,hard=False):
    y=blank(d);put(y,leather(.16,.4),0);put(y,rub(.15,'grit',.17 if hard else .09),.01)
    put(y,wood_knock(.12,.07,True),.015)
    return y

def dice_roll(d=2.05,cloth=False,shake=True,variant=0):
    y=blank(d)
    release=.61 if shake else .05
    if shake:
        put(y,rub(.48,'leather',.13),0)
        # Random little hard impacts inside the cup, rather than quantized ticks.
        for at in [.04,.083,.17,.207,.30,.34,.41,.474,.515]:
            put(y,bone_hit(R.uniform(.16,.29),cloth=True),at,.65)
    # Two independent bodies: bounce periods shrink as energy is lost.
    for die in range(2):
        at=release+.07+die*.035+R.uniform(0,.018)
        interval=.18+R.uniform(-.015,.025)
        energy=1.0-die*.12
        for k in range(11):
            if at+.08>d:break
            put(y,bone_hit(energy,cloth),at,.75)
            if k<4:put(y,rub(.035,'grit',.04*energy),at+.009)
            at+=max(.017,interval*R.uniform(.88,1.12))
            interval*=R.uniform(.67,.79);energy*=R.uniform(.66,.82)
    return ends(y,.001,.035)

def cue(d):return blank(d)
def add(id,label,category,desc,y,volume=.6,cooldown=200,priority=2):
    SOUNDS.append(dict(id=id,label=label,category=category,description=desc,samples=y,
                       volume=volume,cooldown_ms=cooldown,priority=priority))

def design():
    add('ui_click','목패 클릭','ui','마른 나무 명령패를 살짝 놓는 소리',wood_knock(.12,.7,True),.43,80,0)
    y=cue(.32);put(y,wood_knock(.20,.7,True),0);put(y,leather(.14,.17),.025)
    add('ui_confirm','명령패 확정','ui','탁자 위에 명령패를 단단히 놓기',y,.50,180,1)
    add('ui_cancel','명령 취소','ui','목패를 거두는 짧은 스침과 탁음',rub(.19,'paper',.25)+wood_knock(.19,.33,True),.43,150,1)
    y=cue(.55);put(y,rub(.42,'paper',.55),0);put(y,wood_knock(.15,.22,True),.32)
    add('panel_open','두루마리 펼침','ui','종이를 펴는 바스락 소리',y,.42,300,0)
    y=cue(.44);put(y,rub(.31,'paper',.45),0);put(y,leather(.15,.25),.25)
    add('panel_close','두루마리 접기','ui','종이를 접고 가볍게 내려놓기',y,.40,260,0)
    add('map_select','지도 위 말 놓기','ui','지도에 작은 장기말을 얹는 소리',wood_knock(.13,.55),.41,100,0)
    add('dice_tick','주사위 한 번 구름','dice','짧고 건조한 주사위 모서리 충돌',bone_hit(.65)[:round(.065*SR)],.34,95,0)
    add('dice_roll','주사위 굴림 · 기본','dice','컵 안에서 흔든 뒤 나무판에 던져 구르고 멎기',dice_roll(2.05),.65,1000,1)
    y=cue(.28);put(y,bone_hit(.95),0);put(y,bone_hit(.24),.054);put(y,bone_hit(.09),.088)
    add('dice_land','주사위 마지막 착지','dice','최종 눈금 공개용 짧은 착지; 전체 굴림 뒤에는 선택 사용',y,.57,250,2)
    y=cue(.18);put(y,wood_knock(.14,.7,True),0);put(y,leather(.10,.13),.045)
    add('bonus_add','보정패 가산','dice','점수패를 더하는 목재 접촉음',y,.43,150,1)
    y=cue(.22);put(y,rub(.13,'leather',.17),0);put(y,wood_knock(.12,.48,True),.07)
    add('bonus_penalty','보정패 감산','dice','점수패를 거두는 스침과 둔탁한 클릭',y,.40,150,1)
    y=cue(.36);put(y,wood_knock(.21,.6,True),0);put(y,leather(.25,.3),.01)
    add('score_lock','점수 낙인','dice','인장을 탁 찍어 최종 점수 확정',y,.52,280,2)
    y=cue(1.0);put(y,drum(.65,'medium',.6,True),0);put(y,wood_knock(.17,.25,True),.27)
    add('turn_start','군령 시작','calendar','절제된 북 한 타와 명령패',y,.52,800,2)
    y=cue(1.7);put(y,gust(1.4,.12),.04);put(y,rub(.8,'cloth',.10),.2);put(y,wood_knock(.17,.25,True),.15)
    add('season_spring','봄 · 깃발과 바람','calendar','가벼운 바람과 천이 펄럭이는 소리',y,.49,1700,3)
    y=cue(1.7);put(y,drum(.65,'medium',.42,True),0);put(y,gust(1.45,.10),.12);put(y,rub(.7,'cloth',.09),.3)
    add('season_summer','여름 · 군영의 북','calendar','절제된 가죽 북과 군영의 바람',y,.49,1700,3)
    y=cue(1.8);put(y,gust(1.5,.14),0);put(y,rub(.65,'paper',.19),.28);put(y,wood_knock(.2,.16,True),.72)
    add('season_autumn','가을 · 낙엽 스침','calendar','종이처럼 마른 잎과 바람의 마찰음',y,.49,1800,3)
    y=cue(2.0);put(y,gust(1.8,.2),0);put(y,drum(.9,'large',.25,True),.17)
    add('season_winter','겨울 · 낮은 바람','calendar','차분한 저역 바람과 멀리 울리는 북',y,.48,1900,3)
    y=cue(1.65)
    for k,at in enumerate([0,.29,.59,.87,1.19]):
        put(y,foot(.25,True),at,R.uniform(.7,1))
        if k%2==0:put(y,metal(.15,False,.05),at+.03)
    put(y,rub(1.25,'leather',.06),.1)
    add('army_march','갑옷 행군','battle','흙을 밟는 발·가죽·작은 쇠 마찰',y,.53,1400,1)
    y=cue(.52);put(y,rub(.26,'cloth',.55),0);put(y,leather(.20,.27),.20)
    add('attack_whoosh','칼을 휘두름','battle','공기와 천을 가르는 짧은 마찰',y,.54,450,2)
    y=cue(.78);put(y,metal(.65,False,.7),0);put(y,rub(.18,'grit',.16),.02);put(y,wood_knock(.22,.15,True),0)
    add('sword_clash','쇠붙이 맞부딪침','battle','조밀하고 거친 금속 충돌·짧은 잔향',y,.58,550,2)
    y=cue(1.1);put(y,drum(.9,'large',.7),0);put(y,metal(.65,True,.45),.012);put(y,leather(.4,.35),.018)
    add('battle_impact','전열 충돌','battle','방패·가죽·쇠가 한 번 무겁게 부딪힘',y,.65,950,3)
    y=cue(2.4);put(y,drum(.6,'medium',.5),0);put(y,drum(.5,'medium',.33),.22);put(y,drum(.8,'large',.65),.50);put(y,gong(1.8,.37,False),.50)
    add('battle_victory','승전 북과 징','battle','짧은 승전 북 세 타와 넓은 청동 울림',y,.63,2100,3)
    y=cue(2.2);put(y,drum(.9,'large',.50),0);put(y,gong(1.9,.34),.08);put(y,rub(.55,'cloth',.10),.65)
    add('battle_defeat','패전의 낮은 울림','battle','낮은 북과 무겁게 잦아드는 청동 울림',y,.57,2100,3)
    y=cue(.9);put(y,drum(.4,'medium',.40,True),0);put(y,wood_knock(.17,.25,True),.21)
    add('battle_draw','교착·정지','battle','울림을 누른 북과 목재 탁음',y,.49,800,2)
    y=cue(1.15);put(y,rub(.35,'cloth',.32),0);put(y,wood_knock(.22,.34,True),.28);put(y,drum(.65,'medium',.52,True),.30)
    add('territory_capture','깃발 꽂기','realm','깃발 천이 펼쳐지고 말뚝이 단단히 박힘',y,.58,850,2)
    y=cue(2.5);put(y,wood_knock(.35,.4,True),0);put(y,metal(.85,True,.43),.03);put(y,drum(1.2,'large',.65),.04);put(y,gong(2.15,.43),.15)
    add('capital_fall','성문 함락','realm','큰 목재 충격과 무거운 북·징의 여운',y,.68,2400,4)
    y=cue(2.8);put(y,gong(2.6,.62),0);put(y,drum(1.1,'large',.46,True),.07);put(y,rub(.8,'cloth',.11),.7)
    add('country_eliminated','국가 멸망','realm','한 번 울리는 낮은 청동판과 잦아드는 북',y,.59,2700,4)
    y=cue(1.02);put(y,drum(.5,'tight',.43,True),0);put(y,drum(.5,'medium',.55,True),.26);put(y,wood_knock(.2,.25,True),.32)
    add('recruit','모병 군령','domestic','훈련용 북 두 타와 군령패',y,.52,850,2)
    y=cue(.85);put(y,wood_knock(.2,.44,True),0);put(y,leather(.2,.25),.14);put(y,wood_knock(.2,.4,True),.30)
    add('production','충원 장부 정리','domestic','장부 위 목패와 자루를 다루는 소리',y,.50,750,2)
    y=cue(.95);put(y,rub(.33,'leather',.28),0);put(y,wood_knock(.23,.48,True),.23);put(y,leather(.3,.27),.29)
    add('supply','보급품 내려놓기','domestic','가죽 자루와 나무 상자를 내려놓는 소리',y,.51,800,2)
    y=cue(.87);put(y,rub(.25,'paper',.2),0);put(y,wood_knock(.2,.42,True),.16);put(y,drum(.5,'medium',.34,True),.18)
    add('domestic_success','내정 승인','domestic','문서에 인장을 찍고 작은 북 한 타',y,.51,800,2)
    y=cue(.56);put(y,rub(.25,'paper',.28),0);put(y,wood_knock(.17,.35,True),.20)
    add('domestic_failure','내정 실패·출정 거부','domestic','문서를 거두고 명령패를 내려놓기',y,.45,600,2)
    y=cue(1.55);put(y,drum(.55,'medium',.42,True),0);put(y,wood_knock(.2,.35,True),.20);put(y,metal(.8,True,.17),.24);put(y,rub(.4,'cloth',.10),.6)
    add('general_appointed','장군 임명','domestic','군령패 수여와 절제된 북·갑옷 마찰',y,.56,1400,3)
    y=cue(2.5);put(y,drum(1.1,'large',.42,True),0);put(y,gong(2.3,.40),.11);put(y,rub(.6,'cloth',.08),.6)
    add('general_fallen','장군 전사','domestic','먹먹한 북 한 타와 낮은 청동 잔향',y,.55,2400,4)
    y=cue(.51);put(y,rub(.19,'paper',.25),0);put(y,wood_knock(.21,.46,True),.16)
    add('save','장부 저장','system','종이를 넘기고 도장을 한 번 찍기',y,.44,400,1)
    y=cue(3.45)
    for at,size,gain in [(0,'medium',.42),(.23,'medium',.4),(.52,'large',.64),(.93,'medium',.42),(1.22,'large',.66)]:put(y,drum(.9,size,gain),at)
    put(y,gong(2.1,.44,False),1.22);put(y,rub(.8,'cloth',.12),1.45)
    add('campaign_complete','천하통일 군례','system','다섯 번의 군례 북과 넓고 긴 징의 울림',y,.64,3400,5)
    # Six extra tabletop options, newly synthesized with independent collisions.
    add('dice_roll_wood_short','주사위 · 짧은 나무판','dice','컵 없이 곧바로 굴림; 빠른 판정용',dice_roll(1.12,shake=False),.64,700,1)
    add('dice_roll_wood_alt','주사위 · 나무판 다른 굴림','dice','기본 굴림과 충돌 간격이 다른 변형',dice_roll(2.12,variant=1),.64,1000,1)
    add('dice_roll_cloth','주사위 · 천 깐 판','dice','천을 깐 판에 던져 한층 낮고 부드럽게 구름',dice_roll(1.9,cloth=True),.66,1000,1)
    y=cue(1.15);put(y,rub(.92,'leather',.18),.02)
    for at in [.04,.08,.16,.21,.29,.34,.43,.48,.57,.61,.72,.79,.88]:put(y,bone_hit(R.uniform(.18,.32),True),at,.8)
    add('dice_cup_shake','주사위 · 가죽 컵 흔들기','dice','던지기 없이 컵 안에서만 달그락거림',y,.59,750,1)
    y=cue(.65)
    for at,g in [(0,.9),(.15,.42),(.245,.20),(.305,.09)]:put(y,bone_hit(g),at)
    add('dice_drop_single','주사위 · 한 알 떨어뜨리기','dice','단일 주사위가 짧게 튀고 멎기',y,.60,450,1)
    y=cue(.38)
    for at,g in [(0,.42),(.052,.30),(.092,.18),(.122,.10),(.145,.05)]:put(y,bone_hit(g),at)
    add('dice_settle','주사위 · 잔구름 마무리','dice','최종 판정 직전 작은 연속 충돌',y,.51,350,1)

def finalize(y,category):
    y=band(y,32,6800,2);y-=np.mean(y)
    y=np.tanh(y*.65)/.65
    # Centre-focused dry foley, with only a very small mathematically generated room.
    l=y.copy();r=y.copy();wet=.015 if category in ['dice','ui'] else .045
    for sec,gain in [(.019,.7),(.031,.38),(.049,.14)]:
        for dest,offset in [(l,0),(r,.003)]:
            n=round((sec+offset)*SR)
            if n<len(y):dest[n:]+=y[:-n]*wet*gain
    a=np.column_stack([l,r]);a-=a.mean(axis=0)
    end=min(round(.025*SR),len(a)//3);a[-end:]*=np.linspace(1,0,end)[:,None]
    a[:min(44,len(a))]*=np.linspace(0,1,min(44,len(a)))[:,None]
    target={'ui':-9.5,'dice':-6.8}.get(category,-5.6)
    a*=10**(target/20)/max(1e-9,np.max(np.abs(a)))
    return a

def generate():
    for p in [PACK/'audio/mp3',PACK/'audio/ogg',MASTERS]:p.mkdir(parents=True,exist_ok=True)
    design();assert len(SOUNDS)==42
    for s in SOUNDS:
        a=finalize(s.pop('samples'),s['category']);wav=MASTERS/(s['id']+'.wav')
        with wave.open(str(wav),'wb')as w:
            w.setnchannels(2);w.setsampwidth(2);w.setframerate(SR);w.writeframes(np.round(a*32767).astype('<i2').tobytes())
        for fmt in ['mp3','ogg']:
            out=PACK/'audio'/fmt/(s['id']+'.'+fmt)
            args=['-c:a','libmp3lame','-b:a','112k']if fmt=='mp3'else['-c:a','libvorbis','-q:a','3']
            subprocess.run(['ffmpeg','-v','error','-y','-i',str(wav),*args,'-map_metadata','-1',str(out)],check=True)
            s[fmt]=str(out.relative_to(PACK))
        s.update(duration=round(len(a)/SR,3),sample_rate=SR,channels=2,wav_master_sha256=hashlib.sha256(wav.read_bytes()).hexdigest())
    info=dict(name='사국쟁패 고전 전략 효과음 v2',version='2.0',seed=2026102502,sample_free=True,method='Procedural material and collision synthesis; no external recordings or samples',sounds=SOUNDS)
    (PACK/'manifest.json').write_text(json.dumps(info,ensure_ascii=False,indent=2))
    print(json.dumps({'sounds':len(SOUNDS),'seconds':sum(s['duration']for s in SOUNDS),'path':str(PACK)},ensure_ascii=False))

if __name__=='__main__':generate()
