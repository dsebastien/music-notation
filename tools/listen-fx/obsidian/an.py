import numpy as np, sys, os
S=os.path.dirname(os.path.abspath(__file__)); R=48000
def load(n):
    a=np.fromfile(f'{S}/{n}.f32',dtype='<f4'); a=a[:len(a)//2*2].reshape(-1,2); return a
def db(x): return round(float(20*np.log10(max(x,1e-9))),1)
for n in sys.argv[1:]:
    a=load(n); m=a.mean(axis=1); ab=np.abs(a).max(axis=1)
    idx=np.nonzero(ab>1e-4)[0]
    if len(idx)==0: print(n,'silent'); continue
    f,l=idx[0],idx[-1]; seg=a[f:l+1]; ms=m[f:l+1]
    peak=float(ab.max()); rms=float(np.sqrt((ms**2).mean()))
    clip=float((ab>=0.999).mean()*100)
    L,Rr=seg[:,0],seg[:,1]; corr=float((L*Rr).sum()/np.sqrt((L*L).sum()*(Rr*Rr).sum()+1e-20))
    # gaps: runs of exact zeros (both sides) of 2 ms or more inside the sound
    z=(np.abs(seg).max(axis=1)==0).astype(np.int8); d=np.diff(np.concatenate([[0],z,[0]])); st=np.nonzero(d==1)[0]; en=np.nonzero(d==-1)[0]
    gaps=[(int(s/R*1000),round((e-s)/R*1000,1)) for s,e in zip(st,en) if (e-s)>=R*0.002]
    win=int(R*0.1); env=[db(np.sqrt((ms[i:i+win]**2).mean())) for i in range(0,len(ms)-win,win)]
    print(f"{n}: first {f/R:.2f}s last {l/R:.2f}s peak {peak:.3f} rms {db(rms)} dB corr {corr:.4f} clipped {clip:.3f}% gaps(ms at, ms long) {len(gaps)}: {gaps[:12]}")
    print('   env/100ms:',' '.join(str(e) for e in env[:60]))
