# Shared parts of the map scripts: a map with ground letters, heights, objects, people, and
# the other layers, and the JSON writer. Map x goes to the screen right-down, map y goes to the
# screen left-down.
import json, random, sys, os, zlib

LEGEND = {'.': 'grass', ',': 'flowers', '=': 'path', 'y': 'yard', '_': 'sand', 'B': 'bridge',
          '~': 'water', 's': 'shallow', 'f': 'field', 'd': 'dike', 'h': 'hedge', 'l': 'hedge-low', 'r': 'rock'}
# The scripts place things on tiles; the maps have S x S cells for each tile. One cell is one
# ground block of the voxel world.
S = 2
# A dike (bờ) crosses the paddies every DIKE cells.
DIKE = 5
ABOUT = ('A map of the voxel world: a window on the plane of its region. Map x is east, map y is south (world z). '
         'One cell is one ground block. window: the place of the map on the region plane (cells); the maps of a region '
         'touch at their edges, and the land goes on from one map to the next. stamps: the hand-made story places, '
         'which stay as they are: ground (one letter for each cell, see legend) and height (one digit for each cell, '
         'the height of the ground in steps: water 0, river bank 1, rice paddy 1, ground 2; the top of a column is the '
         'digit + 1 blocks). The land outside the stamps comes from the rules of the region and the seed of the world '
         '(src/core/gen/, data/world/land-<region>.json, data/world/scatter.json). The hero steps up or down one step; a '
         'higher step is a cliff. layers.objects: props that the code builds from blocks (prop: the kind, seed: the '
         'variation), on a footprint of w x h cells that they block (solid: a list of [dx, dy], or false); the scatter '
         'rules add more. layers.collision: rectangles that block (block: true) or open (block: false) cells. '
         'layers.zones: placement zones. layers.paths: walk lines in cells. The exits come from the windows: an edge '
         'that touches another map takes the hero there (src/world/regions.js). layers.places: named map points for the '
         'plans of the day (h: the height over the ground in half blocks). layers.spots: the spots of the small events of the day in the stamps (road, field, yard; cells; the land adds more). layers.life: groups of animals (kind in '
         'data/world/life.json, n of them, around a map point within r cells); the code places them by the seed of the '
         'world. figure: the look of a person or an enemy in data/figures.json. geo: the real place of the middle of the '
         'map ([longitude, latitude]) and the map direction of north ([dx, dy]). The maps are made by '
         'tools/maps/era1.py; do not change them by hand.')


class M:
    def __init__(self, id, name_key, w, h, base='.'):
        self.id, self.name_key, self.w, self.h = id, name_key, w, h
        self.g = [[base] * w for _ in range(h)]
        self.z = [[2] * w for _ in range(h)]
        self.objects, self.npcs, self.encounters, self.triggers = [], [], [], []
        self.collision, self.zones, self.paths, self.exits = [], [], {}, []
        self.life = []
        self.ferries = []  # ferries over a big river: id, a and b (the spots of the boat), landA and landB (where the riders step off)
        self.places = {}
        self.spots = {}  # the spots of the small events of the day: road, field, yard (cells, not tiles)
        self.geo = None
        self.spawn = None
        self.terrace = ''  # the sides with terraces: n, e, s, w (north is y = 0, west is x = 0)
        self.raise_rects = []  # (x, y, w, h, z): ground at a set height (a mound)

    # The height of each tile, in steps.
    def heights(self):
        base = {'~': 0, 's': 0, '_': 1, 'f': 1}
        z = [[base.get(self.g[y][x], 2) for x in range(self.w)] for y in range(self.h)]
        # A path on the river bank goes down to the ford, or stays high as a causeway to the bridge.
        for y in range(self.h):
            for x in range(self.w):
                if self.g[y][x] != '=':
                    continue
                nb = [self.g[yy][xx] for xx, yy in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1))
                      if 0 <= xx < self.w and 0 <= yy < self.h]
                if '_' in nb and 's' in nb or ('_' in nb and all(c in '_=s' for c in nb) and self.ford_lane(x)):
                    z[y][x] = 1
        for (x0, y0, w, h, zz) in self.raise_rects:
            for y in range(y0, y0 + h):
                for x in range(x0, x0 + w):
                    z[y][x] = zz
        # Terraces: the edge of the map rises in two steps. Roads and water go through.
        for y in range(self.h):
            for x in range(self.w):
                if self.g[y][x] in '~s=B':
                    continue
                d = min([v for k, v in (('n', y), ('s', self.h - 1 - y), ('w', x), ('e', self.w - 1 - x)) if k in self.terrace] or [9])
                if d <= 1:
                    z[y][x] += 2 - d
        return z

    def ford_lane(self, x):
        return any(self.g[y][x] == 's' for y in range(self.h))

    def fill(self, x0, y0, w, h, ch):
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w):
                if 0 <= x < self.w and 0 <= y < self.h:
                    self.g[y][x] = ch

    def at(self, x, y):
        return self.g[y][x]

    def flowers(self, n, seed):
        rnd = random.Random(seed)
        for _ in range(n):
            x, y = rnd.randrange(1, self.w - 1), rnd.randrange(1, self.h - 1)
            if self.g[y][x] == '.':
                self.g[y][x] = ','

    def obj(self, id, art, x, y, w=1, h=1, water=False, **kw):
        for dy in range(h):
            for dx in range(w):
                assert self.g[y + dy][x + dx] not in ('hl' if water else 'hl~'), (self.id, id, x + dx, y + dy)
        kw.pop('depth', None)
        seed = zlib.crc32(f'{self.id}:{id}'.encode()) & 0x7fffffff
        self.objects.append({'id': id, 'prop': art, 'x': x, 'y': y, 'w': w, 'h': h, 'seed': seed, **({'float': True} if water else {}), **kw})

    def many(self, prefix, art, points):
        for i, (x, y) in enumerate(points, 1):
            self.obj(f'{prefix}{i}', art, x, y)

    def rect(self, id):
        o = next(o for o in self.objects if o['id'] == id)
        return {'x': o['x'], 'y': o['y'], 'w': o['w'], 'h': o['h']}

    def data(self, region):
        k = S
        sc = lambda v: round(v * k, 3)
        def rect(r):
            out = dict(r)
            for key in ('x', 'y'):
                if key in out: out[key] = out[key] * k
            out['w'] = r.get('w', 1) * k
            out['h'] = r.get('h', 1) * k
            return out
        def point(p):
            return {**p, 'x': sc(p['x']), 'y': sc(p['y'])}
        ground = [''.join(ch * k for ch in row) for row in self.g for _ in range(k)]
        heights = [''.join(str(v) * k for v in row) for row in self.heights() for _ in range(k)]
        # Dikes between the paddies: walkable, at the height of the ground.
        ground = [list(r) for r in ground]
        heights = [list(r) for r in heights]
        for z, row in enumerate(ground):
            for x, ch in enumerate(row):
                if ch == 'f' and (x % DIKE == 0 or z % DIKE == 0):
                    row[x] = 'd'
                    heights[z][x] = str(int(heights[z][x]) + 1)
        objects = []
        for o in self.objects:
            n = {**o, 'x': o['x'] * k, 'y': o['y'] * k, 'w': o['w'] * k, 'h': o['h'] * k}
            if isinstance(o.get('solid'), list):
                n['solid'] = [[dx * k + i, dy * k + j] for dx, dy in o['solid'] for i in range(k) for j in range(k)]
            objects.append(n)
        triggers = []
        for t in self.triggers:
            n = rect(t)
            if 'move' in t.get('action', {}):
                n['action'] = {**t['action'], 'move': point(t['action']['move'])}
            triggers.append(n)
        exits = []
        for e in self.exits:
            n = rect(e)
            n['to'] = {key: (sc(v) if key in ('x', 'y', 'dx', 'dy') else v) for key, v in e['to'].items()}
            exits.append(n)
        return {
            '_about': ABOUT,
            'id': self.id,
            'region': region,
            'nameKey': self.name_key,
            'geo': self.geo,
            'width': self.w * k,
            'height': self.h * k,
            'legend': LEGEND,
            'spawn': point(self.spawn),
            'layers': {
                'ground': [''.join(r) for r in ground],
                'height': [''.join(r) for r in heights],
                'objects': objects,
                'collision': [rect(c) for c in self.collision],
                'zones': [rect(zz) for zz in self.zones],
                'paths': {key: [[sc(x), sc(y)] for x, y in line] for key, line in self.paths.items()},
                'exits': exits,
                'life': [{**point(g), 'r': sc(g['r'])} for g in self.life],
                'places': {name: point(p) for name, p in self.places.items()},
                'triggers': triggers,
                'ferries': [{**f, **{key: point(f[key]) for key in ('a', 'b', 'landA', 'landB')}} for f in self.ferries],
            },
            'npcs': [point(n) for n in self.npcs],
            'encounters': [point(e) for e in self.encounters],
        }


def place_def(m, region, size, offset, stamps):
    """The map as the frame of a place on the plane (the land file puts the frame at its real place).
    size: the width and height of the frame (cells); offset: the place of the hand-made map in the
    frame (cells); stamps: the parts of the hand-made map that stay (tiles: x, y, w, h). The land
    outside the stamps comes from the rules of the region (src/core/gen/). The objects and the
    groups of animals outside the stamps go: the scatter rules make new ones there."""
    d = m.data(region)
    ox, oy = offset
    rects = [(x * S, y * S, w * S, h * S) for (x, y, w, h) in stamps]
    def inside(x, y, w=0, h=0):
        return any(rx <= x and ry <= y and x + w <= rx + rw and y + h <= ry + rh for rx, ry, rw, rh in rects)
    def move(p):
        return {**p, 'x': round(p['x'] + ox, 3), 'y': round(p['y'] + oy, 3)}
    L = d['layers']
    out_stamps = [{'x': x + ox, 'y': y + oy, 'w': w, 'h': h,
                   'ground': [row[x:x + w] for row in L['ground'][y:y + h]],
                   'height': [row[x:x + w] for row in L['height'][y:y + h]]} for (x, y, w, h) in rects]
    trig = []
    for t in L['triggers']:
        if not inside(t['x'], t['y'], t['w'], t['h']):
            continue
        n = move(t)
        if 'move' in t.get('action', {}):
            n['action'] = {**t['action'], 'move': move(t['action']['move'])}
        trig.append(n)
    return {
        '_about': d['_about'],
        'id': d['id'],
        'region': region,
        'nameKey': d['nameKey'],
        'geo': d['geo'],
        'width': size[0],
        'height': size[1],
        'legend': d['legend'],
        'spawn': move(d['spawn']),
        'stamps': out_stamps,
        'layers': {
            'objects': [move(o) for o in L['objects'] if inside(o['x'], o['y'], o['w'], o['h'])],
            'collision': [move(c) for c in L['collision']],
            'zones': [move(z) for z in L['zones']],
            'paths': {k: [[round(x + ox, 3), round(y + oy, 3)] for x, y in line] for k, line in L['paths'].items()},
            'life': [move(g) for g in L['life'] if inside(g['x'], g['y'])],
            'places': {k: move(p) for k, p in L['places'].items()},
            'triggers': trig,
            'ferries': [{**f, **{key: move(f[key]) for key in ('a', 'b', 'landA', 'landB')}} for f in L['ferries']],
            'spots': {k: [[x + ox, y + oy] for x, y in pts] for k, pts in m.spots.items()},
        },
        'npcs': [move(n) for n in d['npcs']],
        'encounters': [move(e) for e in d['encounters']],
    }


def ore_triggers(m, id, x, y):
    m.triggers.append({'id': id, 'x': x, 'y': y, 'on': 'tap', 'when': {'flags': ['giong.spoke'], 'notFlags': [f'horse.{id}']},
                       'action': {'pickup': {'iron': 2}, 'set': f'horse.{id}', 'textKey': 'map.ore.found'}})
    m.triggers.append({'id': f'{id}-early', 'x': x, 'y': y, 'on': 'tap', 'action': {'textKey': 'map.ore.look'}})



def dump(v, ind=0):
    pad = ' ' * ind
    if isinstance(v, dict) and ind < 4:
        items = [f'{pad} {json.dumps(k, ensure_ascii=False)}: {dump(x, ind + 1).lstrip()}' for k, x in v.items()]
        return pad + '{\n' + ',\n'.join(items) + '\n' + pad + '}'
    if isinstance(v, list) and ind < 4 and v and isinstance(v[0], (dict, str, list)):
        items = [pad + ' ' + json.dumps(x, ensure_ascii=False) for x in v]
        return pad + '[\n' + ',\n'.join(items) + '\n' + pad + ']'
    return pad + json.dumps(v, ensure_ascii=False)


