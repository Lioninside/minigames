#!/usr/bin/env python3
"""Rechnet das 3DS-Modell „man“ (cadnav.com, Modell 53323) in die Spielfigur um.

Aufruf:  python3 tools/bake_avatar.py <man.3DS> js/data/avatar-man.js
- Achsen: 3DS (x, y, z-oben, Blick -y) → Spiel (x, y-oben, Blick -z)
- 13 Einzelteile → Rumpf (mit Kopf) und vier Glieder mit Gelenkpunkt (Hüfte, Schulter),
  Glieder senkrecht ausgerichtet (das Original steht in Schrittstellung)
- Farben aus den Materialien, pro Dreieck. Nur Standardbibliothek."""
import struct, sys, json, math

def parse(path):
    b = open(path, 'rb').read(); objs = []; mats = []
    def walk(o, end):
        while o < end - 6:
            cid, ln = struct.unpack_from('<HI', b, o)
            if ln < 6: break
            body = o + 6
            if cid in (0x4D4D, 0x3D3D, 0xAFFF, 0x4100, 0xA200):
                if cid == 0xAFFF: mats.append({})
                walk(body, o + ln)
            elif cid == 0x4000:
                e = b.index(b'\0', body); objs.append({'name': b[body:e].decode('latin1')}); walk(e + 1, o + ln)
            elif cid == 0xA000: mats[-1]['name'] = b[body:b.index(b'\0', body)].decode('latin1')
            elif cid == 0xA020:
                c2 = struct.unpack_from('<H', b, body)[0]
                mats[-1]['diff'] = list(b[body + 6:body + 9]) if c2 == 0x0011 else [round(x * 255) for x in struct.unpack_from('<3f', b, body + 6)]
            elif cid == 0x4110:
                n = struct.unpack_from('<H', b, body)[0]; objs[-1]['v'] = [struct.unpack_from('<3f', b, body + 2 + i * 12) for i in range(n)]
            elif cid == 0x4120:
                n = struct.unpack_from('<H', b, body)[0]; objs[-1]['f'] = [struct.unpack_from('<3H', b, body + 2 + i * 8) for i in range(n)]
                walk(body + 2 + n * 8, o + ln)
            elif cid == 0x4130:
                e = b.index(b'\0', body); nm = b[body:e].decode('latin1'); n = struct.unpack_from('<H', b, e + 1)[0]
                objs[-1].setdefault('fm', []).append((nm, list(struct.unpack_from('<%dH' % n, b, e + 3))))
            o += ln
    walk(0, len(b))
    return objs, mats

def main(src, dst):
    objs, mats = parse(src)
    pal = [m['diff'] for m in mats]; midx = {m['name']: i for i, m in enumerate(mats)}
    O = {o['name'].split(':')[0]: o for o in objs if 'v' in o}
    G = lambda v: (v[0], v[2], v[1])          # 3DS → Spiel
    def tris(names):
        out = []
        for n in names:
            o = O[n]; fc = [0] * len(o['f'])
            for nm, lst in o.get('fm', []):
                for i in lst: fc[i] = midx[nm]
            for i, f in enumerate(o['f']): out.append(([G(o['v'][f[0]]), G(o['v'][f[2]]), G(o['v'][f[1]])], fc[i]))
        return out
    groups = {'body': ['3', '9', '4', '5', '6'], 'legL': ['1', '8'], 'legR': ['2', '7'], 'armL': ['13', '11'], 'armR': ['12', '10']}
    # Mitte (Hüfte) auf x = 0, z = 0
    hip = [G(v) for v in O['3']['v']]
    cx = sum(p[0] for p in hip) / len(hip); cz = sum(p[2] for p in hip) / len(hip)
    parts = {}
    for name, names in groups.items():
        T = [([(p[0] - cx, p[1], p[2] - cz) for p in t], c) for t, c in tris(names)]
        part = {}
        if name != 'body':
            pts = [p for t, _ in T for p in t]
            ymax = max(p[1] for p in pts); ymin = min(p[1] for p in pts)
            top = [p for p in pts if p[1] > ymax - 0.06]
            piv = [sum(p[0] for p in top) / len(top), ymax - (0.02 if 'leg' in name else 0.06), sum(p[2] for p in top) / len(top)]
            # Glied senkrecht stellen (Drehung um die x-Achse durch das Gelenk)
            lowY = ymin + (0.14 if 'leg' in name else 0.12)
            low = [p for p in pts if p[1] < lowY + 0.12 and p[1] > lowY - 0.02] or pts
            lz = sum(p[2] for p in low) / len(low) - piv[2]; ly = sum(p[1] for p in low) / len(low) - piv[1]
            ang = math.atan2(lz, -ly)
            ca, sa = math.cos(ang), math.sin(ang)
            def rot(p):
                y, z = p[1] - piv[1], p[2] - piv[2]
                return (p[0] - piv[0], y * ca - z * sa, y * sa + z * ca)   # relativ zum Gelenk
            T = [([rot(p) for p in t], c) for t, c in T]
            part['pivot'] = [round(x, 3) for x in piv]
            print(name, 'Gelenk', part['pivot'], 'Ausgleich %.1f Grad' % math.degrees(ang))
        part['p'] = [round(x, 3) for t, _ in T for p in t for x in p]
        part['c'] = [c for _, c in T]
        parts[name] = part
    data = {'palette': pal, 'parts': parts, 'height': round(max(G(v)[1] for o in O.values() for v in o['v']), 3)}
    with open(dst, 'w') as f:
        f.write('/* Spielfigur „man“: Quelle cadnav.com (Modell 53323), umgerechnet mit tools/bake_avatar.py. Nicht von Hand ändern. */\n')
        f.write('window.AVATAR_MAN = ' + json.dumps(data, separators=(',', ':')) + ';\n')
    print('Dreiecke', sum(len(p['c']) for p in parts.values()), 'Höhe', data['height'], 'Palette', pal)

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
