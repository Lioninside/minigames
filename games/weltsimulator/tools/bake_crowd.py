#!/usr/bin/env python3
"""Bake-Werkzeug für die Menschenmenge im Welt-Simulator.

Liest ein glTF-Binary (GLB) mit Skelett und Animationen (z. B. „Animated Woman“ von Quaternius, CC0)
und schreibt eine kompakte JS-Datendatei für js/assets/crowd.js:

  * Geometrie indiziert und quantisiert (Position int16, Normale int8, 4 Knochen uint8, Gewichte uint8,
    Farbindex uint8 aus der Palettentextur)
  * ausgewählte Animationen als vorberechnete Knochenmatrizen (3x4, half float) pro Einzelbild,
    bereits auf 1 m Körpergrösse normiert, Füsse auf y = 0, Blick nach +z, ohne Wurzelbewegung

Aufruf:  python3 tools/bake_crowd.py <eingabe.glb> js/data/crowd-woman.js
Nur Standardbibliothek, keine Abhängigkeiten."""
import sys, json, struct, math, zlib, base64

CLIPS = [  # (Name in der GLB, Kurzname, Bilder pro Sekunde)
    ('Armature|Walking', 'walk', 30),
    ('Armature|Running', 'run', 30),
    ('Armature|Idle', 'idle', 10),
    ('Armature|SitIdle', 'sit', 10),
]

def load_glb(path):
    b = open(path, 'rb').read()
    jl = struct.unpack('<I', b[12:16])[0]
    j = json.loads(b[20:20 + jl])
    off = 20 + jl
    bl = struct.unpack('<I', b[off:off + 4])[0]
    return j, b[off + 8: off + 8 + bl]

CT = {5126: ('f', 4), 5123: ('H', 2), 5121: ('B', 1), 5125: ('I', 4), 5122: ('h', 2), 5120: ('b', 1)}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}

def accessor(j, bin_, i):
    a = j['accessors'][i]; bv = j['bufferViews'][a['bufferView']]
    fmt, sz = CT[a['componentType']]; n = NC[a['type']]
    stride = bv.get('byteStride', sz * n)
    base = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    out = []
    for k in range(a['count']):
        v = struct.unpack_from('<' + fmt * n, bin_, base + k * stride)
        out.append(v if n > 1 else v[0])
    return out

# ---- kleine Mathematik (Matrizen spaltenweise wie glTF, als Liste von 16) ----
def mmul(a, b):
    r = [0.0] * 16
    for c in range(4):
        for rr in range(4):
            r[c * 4 + rr] = sum(a[k * 4 + rr] * b[c * 4 + k] for k in range(4))
    return r

def trs(t, q, s):
    x, y, z, w = q
    xx, yy, zz, xy, xz, yz, wx, wy, wz = x*x, y*y, z*z, x*y, x*z, y*z, w*x, w*y, w*z
    return [(1 - 2*(yy+zz)) * s[0], 2*(xy+wz) * s[0], 2*(xz-wy) * s[0], 0,
            2*(xy-wz) * s[1], (1 - 2*(xx+zz)) * s[1], 2*(yz+wx) * s[1], 0,
            2*(xz+wy) * s[2], 2*(yz-wx) * s[2], (1 - 2*(xx+yy)) * s[2], 0,
            t[0], t[1], t[2], 1]

def xform(m, p):
    return [m[0]*p[0] + m[4]*p[1] + m[8]*p[2] + m[12], m[1]*p[0] + m[5]*p[1] + m[9]*p[2] + m[13], m[2]*p[0] + m[6]*p[1] + m[10]*p[2] + m[14]]

def nlerp(a, b, f):
    if sum(x*y for x, y in zip(a, b)) < 0: b = [-x for x in b]
    q = [x + (y - x) * f for x, y in zip(a, b)]
    l = math.sqrt(sum(x*x for x in q)); return [x / l for x in q]

def sample(times, vals, t, rot):
    if t <= times[0]: return list(vals[0])
    if t >= times[-1]: return list(vals[-1])
    lo, hi = 0, len(times) - 1
    while hi - lo > 1:
        m = (lo + hi) // 2
        if times[m] <= t: lo = m
        else: hi = m
    f = (t - times[lo]) / (times[hi] - times[lo])
    if rot: return nlerp(vals[lo], vals[hi], f)
    return [x + (y - x) * f for x, y in zip(vals[lo], vals[hi])]

def png_rgb(data):
    """Minimaler PNG-Dekoder (8 Bit, RGB/RGBA, ohne Interlacing) für die Palettentextur."""
    pos, idat, w = 8, b'', 0
    while pos < len(data):
        ln, typ = struct.unpack('>I4s', data[pos:pos + 8]); body = data[pos + 8: pos + 8 + ln]
        if typ == b'IHDR': w, h, bd, ctype = struct.unpack('>IIBB', body[:10])
        elif typ == b'IDAT': idat += body
        pos += 12 + ln
    ch = {2: 3, 6: 4}[ctype]; raw = zlib.decompress(idat); stride = w * ch
    rows, prev, p = [], bytearray(stride), 0
    for y in range(h):
        ft = raw[p]; line = bytearray(raw[p + 1: p + 1 + stride]); p += 1 + stride
        for i in range(stride):
            a = line[i - ch] if i >= ch else 0; b_ = prev[i]; c = prev[i - ch] if i >= ch else 0
            if ft == 1: line[i] = (line[i] + a) & 255
            elif ft == 2: line[i] = (line[i] + b_) & 255
            elif ft == 3: line[i] = (line[i] + (a + b_) // 2) & 255
            elif ft == 4:
                pa, pb, pc = abs(b_ - c), abs(a - c), abs(a + b_ - 2 * c)
                line[i] = (line[i] + (a if pa <= pb and pa <= pc else b_ if pb <= pc else c)) & 255
        rows.append(line); prev = line
    return w, h, lambda x, y: tuple(rows[y][x * ch: x * ch + 3])

def main(src, dst):
    j, bin_ = load_glb(src)
    nodes = j['nodes']
    parent = {}
    for i, n in enumerate(nodes):
        for c in n.get('children', []): parent[c] = i
    rest = [(n.get('translation', [0, 0, 0]), n.get('rotation', [0, 0, 0, 1]), n.get('scale', [1, 1, 1])) for n in nodes]
    skin = j['skins'][0]; joints = skin['joints']
    ibm = [list(m) for m in accessor(j, bin_, skin['inverseBindMatrices'])]
    prim = j['meshes'][0]['primitives'][0]; A = prim['attributes']
    P = accessor(j, bin_, A['POSITION']); N = accessor(j, bin_, A['NORMAL']); UV = accessor(j, bin_, A['TEXCOORD_0'])
    J = accessor(j, bin_, A['JOINTS_0']); W = accessor(j, bin_, A['WEIGHTS_0']); IDX = accessor(j, bin_, prim['indices'])

    def worlds(local):
        cache = {}
        def wm(i):
            if i in cache: return cache[i]
            m = trs(*local[i])
            if i in parent: m = mmul(wm(parent[i]), m)
            cache[i] = m; return m
        return [mmul(wm(jn), ibm[k]) for k, jn in enumerate(joints)]

    def skin_pos(mats, k):
        p = [0.0, 0.0, 0.0]
        for ji, w in zip(J[k], W[k]):
            if w <= 0: continue
            q = xform(mats[ji], P[k]); p = [a + b * w for a, b in zip(p, q)]
        return p

    # Normierung aus der Ruhepose: Füsse auf 0, Grösse 1, Mitte auf x/z = 0
    bind = worlds(rest)
    pts = [skin_pos(bind, k) for k in range(0, len(P), 3)]
    mn = [min(p[i] for p in pts) for i in range(3)]; mx = [max(p[i] for p in pts) for i in range(3)]
    s = 1.0 / (mx[1] - mn[1])
    Nm = [s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, -(mn[0] + mx[0]) / 2 * s, -mn[1] * s, -(mn[2] + mx[2]) / 2 * s, 1]
    print('Ruhepose-Grösse', [round(b - a, 3) for a, b in zip(mn, mx)])

    hips = joints[0]
    frames, meta_clips = [], []
    for gname, short, fps in CLIPS:
        anim = next(a for a in j['animations'] if a['name'] == gname)
        ch = []
        dur = 0
        for c in anim['channels']:
            smp = anim['samplers'][c['sampler']]
            t = accessor(j, bin_, smp['input']); v = accessor(j, bin_, smp['output'])
            dur = max(dur, t[-1]); ch.append((c['target']['node'], c['target']['path'], t, v))
        n = max(2, round(dur * fps))
        start = len(frames)
        hx = []
        for f in range(n):
            t = f * dur / n
            local = [list(r) for r in rest]
            for node, path, tt, vv in ch:
                val = sample(tt, vv, t, path == 'rotation')
                k = {'translation': 0, 'rotation': 1, 'scale': 2}[path]
                local[node][k] = val
            mats = [mmul(Nm, m) for m in worlds(local)]
            frames.append(mats)
            # Hüftposition für die Wurzelbewegung
            hx.append(xform(mats[0], xform(invert_affine(ibm[0]), [0, 0, 0])))
        # Wurzelbewegung (horizontale Drift über den Zyklus) entfernen
        dx = (hx[-1][0] - hx[0][0]) * n / (n - 1); dz = (hx[-1][2] - hx[0][2]) * n / (n - 1)
        if abs(dx) > 0.02 or abs(dz) > 0.02:
            for f in range(n):
                k = f / n
                for m in frames[start + f]: m[12] -= dx * k; m[14] -= dz * k
        hy = [h[1] for h in hx]
        meta_clips.append({'name': short, 'start': start, 'frames': n, 'dur': round(dur, 4), 'hipY': round(sum(hy) / len(hy), 4), 'hipZ': round(sum(h[2] for h in hx) / len(hx), 4)})
        print(f'{short}: {n} Bilder, {dur:.2f} s, Drift {dx:.3f}/{dz:.3f}, Hüfte y {sum(hy)/len(hy):.3f} z {meta_clips[-1]["hipZ"]:.3f}')

    # Palette
    img = j['images'][0]; bv = j['bufferViews'][img['bufferView']]
    pw, ph, px = png_rgb(bin_[bv.get('byteOffset', 0): bv.get('byteOffset', 0) + bv['byteLength']])
    pal, pal_idx = [], {}
    def color_of(uv):
        x = min(pw - 1, max(0, int(uv[0] * pw))); y = min(ph - 1, max(0, int(uv[1] * ph)))
        c = px(x, y)
        if c not in pal_idx: pal_idx[c] = len(pal); pal.append(c)
        return pal_idx[c]

    # Indizieren
    vmap, verts, idx = {}, [], []
    for k in IDX:
        n_ = N[k]; ws = W[k]
        tot = sum(ws) or 1
        wq = [round(w / tot * 255) for w in ws]; wq[0] += 255 - sum(wq)
        key = (tuple(round(x, 6) for x in P[k]), tuple(round(x, 3) for x in n_), tuple(J[k]), tuple(wq), color_of(UV[k]))
        if key not in vmap: vmap[key] = len(verts); verts.append(key)
        idx.append(vmap[key])
    nv = len(verts)
    pmn = [min(v[0][i] for v in verts) for i in range(3)]; pmx = [max(v[0][i] for v in verts) for i in range(3)]
    out = bytearray()
    def align():
        while len(out) % 4: out.append(0)
    offs = {}
    offs['pos'] = len(out)
    for v in verts:
        out += struct.pack('<3h', *[round(((v[0][i] - pmn[i]) / (pmx[i] - pmn[i] or 1)) * 65534 - 32767) for i in range(3)])
    align(); offs['nrm'] = len(out)
    for v in verts:
        l = math.sqrt(sum(x * x for x in v[1])) or 1
        out += struct.pack('<4b', *[round(x / l * 127) for x in v[1]], 0)
    offs['jnt'] = len(out)
    for v in verts: out += struct.pack('<4B', *v[2])
    offs['wgt'] = len(out)
    for v in verts: out += struct.pack('<4B', *v[3])
    offs['col'] = len(out)
    for v in verts: out.append(v[4])
    align(); offs['idx'] = len(out)
    for i in idx: out += struct.pack('<H', i)
    align(); offs['bones'] = len(out)
    for mats in frames:
        for m in mats:
            # drei Zeilen der 3x4-Matrix
            for r in range(3): out += struct.pack('<4e', m[r], m[4 + r], m[8 + r], m[12 + r])
    meta = {'verts': nv, 'tris': len(idx) // 3, 'bones': len(joints), 'frames': len(frames), 'clips': meta_clips,
            'posMin': pmn, 'posMax': pmx, 'palette': ['#%02x%02x%02x' % c for c in pal], 'offs': offs, 'bytes': len(out)}
    with open(dst, 'w') as f:
        f.write('/* Erzeugt mit tools/bake_crowd.py aus „Animated Woman“ von Quaternius (CC0). Nicht von Hand ändern. */\n')
        f.write('window.CROWD_DATA = window.CROWD_DATA || {};\nwindow.CROWD_DATA.woman = ' + json.dumps(meta) + ';\n')
        f.write('window.CROWD_DATA.woman.b64 = "' + base64.b64encode(bytes(out)).decode() + '";\n')
    print('Vertices', nv, 'Dreiecke', len(idx) // 3, 'Bilder', len(frames), 'Palette', meta['palette'], 'Bytes', len(out))

def invert_affine(m):
    # Inverse einer affinen 4x4 (spaltenweise)
    a = [[m[c * 4 + r] for c in range(3)] for r in range(3)]
    det = (a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1]) - a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0]) + a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0]))
    inv = [[0] * 3 for _ in range(3)]
    for r in range(3):
        for c in range(3):
            r1, r2 = [i for i in range(3) if i != c]; c1, c2 = [i for i in range(3) if i != r]
            inv[r][c] = ((-1) ** (r + c)) * (a[r1][c1] * a[r2][c2] - a[r1][c2] * a[r2][c1]) / det
    t = [m[12], m[13], m[14]]
    ti = [-sum(inv[r][k] * t[k] for k in range(3)) for r in range(3)]
    return [inv[0][0], inv[1][0], inv[2][0], 0, inv[0][1], inv[1][1], inv[2][1], 0, inv[0][2], inv[1][2], inv[2][2], 0, ti[0], ti[1], ti[2], 1]

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
