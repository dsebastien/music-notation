import sys, numpy as np
S = sys.argv[1]
def load(n):
    a = np.fromfile(f'{S}/{n}.f32', dtype='<f4'); a = a[: len(a) // 2 * 2].reshape(-1, 2); return a
def first(x, th=1e-3):
    i = np.argmax(np.abs(x).max(axis=1) > th); return int(i)
db = lambda p: 10 * np.log10(max(p, 1e-15))
takes = {n: load(n) for n in ['dry', 'level0', 'room012', 'room03']}
for n, a in takes.items():
    f = first(a); m = a.mean(axis=1)
    pre = a[: max(1, f - 2400)]
    last = len(a) - 1 - int(np.argmax(np.abs(a[::-1]).max(axis=1) > 1e-3))
    print(f'{n:8s} {len(a)/48000:5.1f} s, first sound {f/48000:5.2f} s, last {last/48000:5.2f} s, peak {np.abs(a).max():.3f}, before the play: rms {db((pre**2).mean()):6.1f} dB peak {np.abs(pre).max():.5f}, L=R? {np.abs(a[:,0]-a[:,1]).max():.4f}')
def align(x, ref, fx, fr, span=4000, n=60000):
    # best integer lag of x against ref around their first sounds (left side)
    seg = ref[fr: fr + n, 0]; best = (0, -1)
    for lag in range(-span, span + 1):
        s = x[fx + lag: fx + lag + n, 0]
        if len(s) < n or fx + lag < 0: continue
        c = float(np.dot(s[::4], seg[::4]))
        if c > best[1]: best = (lag, c)
    return best[0]
d = takes['dry']; fd = first(d)
for n in ['level0', 'room012', 'room03']:
    x = takes[n]; fx = first(x); lag = align(x, d, fx, fd)
    N = min(len(d) - fd, len(x) - fx - lag) - 100
    a = x[fx + lag: fx + lag + N]; r = d[fd: fd + N]
    g = float((a * r).sum() / (r * r).sum())
    res = a - g * r
    w = 480; frames = N // w
    e = (res[: frames * w] ** 2).reshape(frames, w, 2).sum(axis=(1, 2)); rr = (r[: frames * w] ** 2).reshape(frames, w, 2).sum(axis=(1, 2))
    sounding = rr / (2 * w) > 1e-5
    print(f'{n:8s} against dry: lag {lag}, gain {20*np.log10(abs(g)):+.2f} dB, what is not the dry sound: {db((res**2).sum() / (r**2).sum()):6.1f} dB under it (worst 10 ms: {db((e[sounding] / rr[sounding]).max()):6.1f} dB); peak {np.abs(a).max():.3f}')
    np.save(f'{S}/{n}-res.npy', res.astype('<f4'))
