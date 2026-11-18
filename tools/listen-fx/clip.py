import sys, numpy as np
S = sys.argv[1]
db = lambda p: 10 * np.log10(max(p, 1e-15))
for n in ['dry', 'level0', 'room012', 'room03']:
    a = np.fromfile(f'{S}/{n}.f32', dtype='<f4'); a = a[: len(a) // 2 * 2].reshape(-1, 2)
    snd = np.abs(a).max(axis=1) > 1e-3
    x = a[snd]
    over = np.abs(x) > 1.0
    clipped = np.clip(x, -1, 1)
    err = x - clipped
    # runs of clipped samples
    o = over.any(axis=1).astype(int); runs = np.diff(np.concatenate([[0], o, [0]])); n_runs = int((runs == 1).sum())
    print(f'{n:8s} peak {np.abs(x).max():.3f}  rms {db((x**2).mean()):6.1f} dB  samples above full scale: {100*over.mean():5.2f} %  in {n_runs} bursts over {len(x)/48000:.1f} s  what clipping removes: {db((err**2).sum()/(x**2).sum()):6.1f} dB under the sound')
