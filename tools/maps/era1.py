#!/usr/bin/env python3
# Make the maps of the Era 1 region (Thánh Gióng) with the real layout:
# Phù Đổng on the north bank of the Đuống, Sóc Sơn to the north, Núi Trâu to the east,
# and Thăng Long with Văn Miếu to the south-west, across the Đuống and the Red River.
# On every map, north is map -y (the screen up and right), and east is map +x.
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from maplib import M, ore_triggers, dump

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "data", "maps")
NORTH = [0, -1]

# ---------------------------------------------------------------- Phù Đổng, on the Đuống
A = M('phu-dong', 'place.phudong', 40, 44)
A.geo = {'at': [105.953, 21.059], 'north': NORTH}
A.fill(3, 19, 8, 6, 'f')
A.fill(3, 22, 8, 1, '=')
# The bamboo hedge. The sides that face the camera (east and south) are low.
A.fill(1, 1, 31, 1, 'h')
A.fill(1, 1, 1, 28, 'h')
A.fill(31, 1, 1, 28, 'l')
A.fill(1, 28, 31, 1, 'l')
# Roads: north to Sóc Sơn, east through the gate to Núi Trâu, south to the river.
A.fill(22, 0, 2, 40, '=')
A.fill(2, 14, 38, 2, '=')
A.fill(8, 26, 2, 5, '=')
A.fill(31, 13, 1, 3, '=')
for r in [(3, 12, 4, 2), (9, 12, 4, 2), (13, 12, 7, 2), (25, 12, 4, 2), (24, 16, 6, 6), (13, 18, 6, 4)]:
    A.fill(*r, 'y')
# Fields outside the gate.
A.fill(33, 2, 6, 10, 'f')
A.fill(33, 18, 6, 9, 'f')
A.fill(35, 2, 1, 10, '=')
A.fill(35, 18, 1, 9, '=')
# The Đuống: the north bank (sand), the water, the south bank. The ford and the broken bridge.
A.fill(0, 31, 40, 2, '_')
A.fill(0, 33, 40, 4, '~')
A.fill(0, 37, 40, 1, '_')
A.fill(8, 33, 2, 4, 's')
A.fill(22, 33, 2, 1, 'B')
A.fill(22, 36, 2, 1, 'B')
A.fill(8, 31, 2, 2, '=')
A.fill(22, 31, 2, 2, '=')
A.fill(8, 37, 2, 2, '=')
A.fill(22, 37, 2, 2, '=')
# The south bank: the road south-west to Thăng Long, and fields.
A.fill(0, 39, 24, 2, '=')
A.fill(26, 39, 12, 3, 'f')
A.fill(31, 39, 1, 3, '=')
A.flowers(34, 7)
A.terrace = 'nwes'
# The đình stands on a mound: its footprint and one tile around it.
A.raise_rects = [(13, 7, 6, 6, 3)]
A.obj('home', 'house', 3, 9, 3, 3)
A.obj('giong-house', 'giong-house', 9, 9, 3, 3)
A.obj('dinh', 'dinh', 14, 8, 4, 4)
A.obj('school', 'school', 25, 9, 4, 3)
A.obj('forge', 'forge', 25, 17, 3, 3)
A.obj('banyan', 'banyan', 17, 3, 3, 3)
A.obj('well', 'well', 20, 11)
A.obj('herbs1', 'herbs', 14, 19)
A.obj('herbs2', 'herbs', 15, 19)
A.obj('herbs3', 'herbs', 16, 19)
A.obj('ore1', 'ore', 25, 2)
# The gate: two posts, open in the middle. The depth box is the middle line.
A.obj('gate', 'gate', 31, 13, 1, 3, solid=[[0, 0], [0, 2]], depth=[0.5, 0, 0.5, 3])
# Small houses of the villagers who have no other house, and the coops of the yards.
A.obj('hut-elder', 'hut', 5, 5, 3, 3)
A.obj('hut-teacher', 'hut', 13, 4, 3, 3)
A.obj('hut-woodcutter', 'hut', 25, 4, 3, 3)
A.obj('hut-smith', 'hut', 19, 21, 3, 3)
A.obj('hut-healer', 'hut', 15, 23, 3, 3)
A.obj('hut-fisher', 'hut', 11, 23, 3, 3)
A.obj('coop1', 'coop', 7, 12)
A.obj('coop2', 'coop', 29, 12)
A.obj('hay1', 'haystack', 7, 10)
A.obj('hay2', 'haystack', 12, 22)
A.obj('rice1', 'rice-stack', 11, 18)
A.many('fence', 'fence', [(3, 18), (4, 18), (5, 18)])
A.obj('rock1', 'rock', 10, 16)
A.obj('boat', 'boat', 12, 31, 2, 1)
A.obj('ore2', 'ore', 3, 31)
A.obj('rock2', 'rock', 30, 31)
A.obj('sign', 'signpost', 20, 41)
A.many('tree', 'tree', [(3, 3), (6, 4), (12, 5), (14, 3), (21, 6), (28, 4), (29, 7), (2, 16), (20, 17), (29, 23),
                        (26, 25), (6, 26), (14, 25), (18, 23), (33, 13), (37, 16), (3, 27), (16, 30), (27, 30),
                        (12, 42), (19, 42), (38, 38)])
A.many('banana', 'banana', [(8, 3), (10, 6), (20, 20), (2, 11), (28, 27), (34, 29), (24, 42)])
A.many('bamboo', 'bamboo', [(12, 27), (36, 30), (5, 30), (15, 38), (29, 38)])
A.spawn = {'x': 5.5, 'y': 13.3}
# Named places for the plans of the day (data/world/people.json). h: the height over the ground
# in half blocks.
A.places = {
    'well': {'x': 20.5, 'y': 12.6},
    'coop1': {'x': 7.5, 'y': 13.4},
    'coop2': {'x': 29.5, 'y': 13.4},
    'banyan-top': {'x': 18.5, 'y': 4.5, 'h': 17},
}
A.npcs = [
    {'id': 'grandma', 'x': 4.5, 'y': 12.7},
    {'id': 'mother', 'x': 11.5, 'y': 12.7},
    {'id': 'giong-boy', 'x': 9.6, 'y': 12.9},
    {'id': 'teacher', 'x': 26.5, 'y': 12.7},
    {'id': 'elder', 'x': 15.5, 'y': 12.8},
    {'id': 'messenger', 'x': 17.7, 'y': 12.9},
    {'id': 'smith', 'x': 26.5, 'y': 20.7},
    {'id': 'healer', 'x': 15.5, 'y': 20.7},
    {'id': 'woodcutter', 'x': 24.6, 'y': 4.4},
    {'id': 'giong-hero', 'x': 28.5, 'y': 16.8},
    {'id': 'fisher', 'x': 14.6, 'y': 31.6},
]
A.encounters = [
    {'id': 'river', 'battle': 'river', 'x': 5.5, 'y': 31.3, 'figure': 'river-serpent',
     'when': {'flags': ['giong.spoke'], 'notFlags': ['river.calmed']}},
    {'id': 'scouts', 'battle': 'scouts', 'x': 34.3, 'y': 14.6, 'figure': 'scout',
     'when': {'flags': ['giong.spoke'], 'notFlags': ['scouts.won']}},
    {'id': 'patrol', 'battle': 'patrol', 'x': 34.3, 'y': 14.6, 'figure': 'scout',
     'when': {'flags': ['giong.farewell']}},
]
A.collision = [{'x': 22, 'y': 34, 'w': 2, 'h': 2, 'block': True, 'note': 'the broken part of the bridge'}]
A.zones = [{'id': 'bridge-gap', 'x': 22, 'y': 34, 'w': 2, 'h': 2, 'accepts': 'plank', 'span': 12}]
A.life = [
    {'kind': 'chicken', 'n': 5, 'x': 5.0, 'y': 13.0, 'r': 1.2, 'bed': 'coop1'},
    {'kind': 'chicken', 'n': 4, 'x': 27.0, 'y': 13.0, 'r': 1.2, 'bed': 'coop2'},
    {'kind': 'duck', 'n': 3, 'x': 6.5, 'y': 21.5, 'r': 2},
    {'kind': 'duck', 'n': 3, 'x': 16.0, 'y': 34.6, 'r': 2.5},
    {'kind': 'duck', 'n': 2, 'x': 31.5, 'y': 35.0, 'r': 2},
    {'kind': 'duck', 'n': 2, 'x': 36.0, 'y': 7.0, 'r': 1.5},
    {'kind': 'fish', 'n': 5, 'x': 9.0, 'y': 34.5, 'r': 1.2},
    {'kind': 'buffalo', 'n': 3, 'x': 36.0, 'y': 16.8, 'r': 1.5},
    {'kind': 'dog', 'n': 1, 'x': 11.5, 'y': 13.5, 'r': 0},
    {'kind': 'pot', 'n': 1, 'x': 13.5, 'y': 11.6, 'r': 0},
    {'kind': 'pot', 'n': 1, 'x': 29.5, 'y': 13.3, 'r': 0},
    {'kind': 'pot', 'n': 1, 'x': 6.6, 'y': 11.6, 'r': 0},
    {'kind': 'cart', 'n': 1, 'x': 16.5, 'y': 16.8, 'r': 0},
    {'kind': 'heat', 'n': 1, 'x': 26.5, 'y': 18.5, 'r': 0},
    {'kind': 'owl', 'n': 1, 'x': 18.5, 'y': 4.5, 'r': 0, 'spot': 'banyan-top'},
    {'kind': 'bird', 'n': 7, 'x': 18.5, 'y': 6.5, 'r': 3},
    {'kind': 'grass', 'n': 14, 'x': 5.0, 'y': 16.8, 'r': 2.5},
    {'kind': 'grass', 'n': 12, 'x': 20.0, 'y': 24.0, 'r': 3},
    {'kind': 'grass', 'n': 10, 'x': 30.0, 'y': 27.0, 'r': 2.5},
    {'kind': 'grass', 'n': 10, 'x': 12.0, 'y': 29.5, 'r': 2.5},
]
ore_triggers(A, 'ore1', 25, 2)
ore_triggers(A, 'ore2', 3, 31)
A.triggers += [
    {'id': 'well', 'x': 20, 'y': 11, 'on': 'tap', 'action': {'textKey': 'map.well'}},
    {'id': 'banyan', **A.rect('banyan'), 'on': 'tap', 'action': {'textKey': 'map.banyan'}},
    {'id': 'home', **A.rect('home'), 'on': 'tap', 'action': {'talk': 'grandma'}},
    {'id': 'school', **A.rect('school'), 'on': 'tap', 'action': {'talk': 'teacher'}},
    {'id': 'forge', **A.rect('forge'), 'on': 'tap', 'action': {'talk': 'smith'}},
    {'id': 'dinh', **A.rect('dinh'), 'on': 'tap', 'action': {'talk': 'elder'}},
    {'id': 'giong-house', **A.rect('giong-house'), 'on': 'tap', 'action': {'talk': 'mother'}},
    {'id': 'sign', 'x': 20, 'y': 41, 'on': 'tap', 'action': {'textKey': 'map.sign.vanmieu'}},
    {'id': 'field-home', 'x': 3, 'y': 19, 'w': 8, 'h': 6, 'on': 'tap', 'action': {'textKey': 'map.field'}},
    {'id': 'field-east', 'x': 33, 'y': 2, 'w': 6, 'h': 25, 'on': 'tap', 'action': {'textKey': 'map.field'}},
    {'id': 'field-south', 'x': 26, 'y': 39, 'w': 12, 'h': 3, 'on': 'tap', 'action': {'textKey': 'map.field'}},
    {'id': 'river', 'x': 0, 'y': 33, 'w': 40, 'h': 4, 'on': 'tap', 'action': {'textKey': 'map.river'}},
]
A.paths = {'east-road': [[39.5, 14.8], [32.5, 14.8]]}
A.exits = [
    {'id': 'north-road', 'kind': 'road', 'x': 22, 'y': 0, 'w': 2, 'h': 1, 'to': {'map': 'soc-son', 'dx': -7, 'y': 29.6}},
    {'id': 'east-road', 'kind': 'road', 'x': 39, 'y': 13, 'w': 1, 'h': 4, 'to': {'map': 'trau-son', 'x': 1.3, 'dy': 0}},
    {'id': 'west-road', 'kind': 'road', 'x': 0, 'y': 39, 'w': 1, 'h': 2, 'to': {'map': 'road-thanglong', 'x': 38.7, 'dy': -28}},
]

# ---------------------------------------------------------------- The hills of Sóc Sơn, to the north
B = M('soc-son', 'place.socson', 30, 32)
B.geo = {'at': [105.826, 21.272], 'north': NORTH}
B.fill(15, 5, 2, 27, '=')
B.fill(12, 5, 8, 3, 'y')
B.fill(4, 25, 6, 5, 'f')
B.fill(4, 27, 11, 1, '=')
B.flowers(26, 13)
B.terrace = 'nwe'
# The hill rises in steps of one: the path goes up all the way to the top.
B.raise_rects = [(3, 1, 24, 24, 3), (6, 2, 18, 19, 4), (9, 3, 12, 14, 5), (11, 4, 8, 9, 6)]
B.obj('rock1', 'rock', 13, 5)
B.obj('rock2', 'rock', 8, 9)
B.obj('rock3', 'rock', 22, 14)
B.obj('hut', 'house', 5, 20, 3, 3)
B.many('tree', 'tree', [(4, 4), (8, 3), (21, 3), (25, 6), (23, 10), (5, 13), (26, 17), (10, 16), (20, 19), (2, 22), (26, 24), (19, 27), (24, 29)])
B.many('bamboo', 'bamboo', [(11, 11), (19, 8), (13, 16), (18, 22), (7, 7), (24, 21)])
B.many('banana', 'banana', [(12, 24), (22, 25)])
B.spawn = {'x': 15.5, 'y': 29.5}
B.npcs = [
    {'id': 'giong-sky', 'x': 16.0, 'y': 6.2},
    {'id': 'socson-elder', 'x': 10.6, 'y': 21.6},
]
B.life = [{'kind': 'duck', 'n': 2, 'x': 6.5, 'y': 26.5, 'r': 1.5}, {'kind': 'pot', 'n': 1, 'x': 9.5, 'y': 22.6, 'r': 0}]
B.triggers = [
    {'id': 'field', 'x': 4, 'y': 25, 'w': 6, 'h': 5, 'on': 'tap', 'action': {'textKey': 'map.field'}},
]
B.exits = [
    {'id': 'south-road', 'kind': 'road', 'x': 15, 'y': 31, 'w': 2, 'h': 1, 'to': {'map': 'phu-dong', 'dx': 7, 'y': 1.3}},
]

# ---------------------------------------------------------------- The foot of Núi Trâu, to the east
C = M('trau-son', 'place.trauson', 32, 31)
C.geo = {'at': [106.10, 21.13], 'north': NORTH}
C.fill(2, 2, 22, 11, 'f')
C.fill(2, 17, 22, 11, 'f')
C.fill(0, 14, 13, 2, '=')
C.fill(12, 2, 1, 26, '=')
C.fill(12, 7, 9, 1, '=')
C.fill(20, 7, 9, 3, 'y')
C.fill(24, 11, 8, 20, '.')
C.fill(19, 0, 13, 7, '.')
C.flowers(22, 3)
C.terrace = 'nesw'
C.obj('mountain', 'mountain', 22, 1, 5, 5)
C.obj('rock1', 'rock', 28, 12)
C.obj('rock2', 'rock', 21, 6)
C.obj('hay1', 'haystack', 14, 15)
C.many('tree', 'tree', [(0, 0), (19, 3), (29, 3), (25, 13), (30, 20), (26, 27), (0, 29), (14, 29), (0, 16)])
C.many('banana', 'banana', [(27, 17), (6, 30)])
C.many('bamboo', 'bamboo', [(29, 9), (31, 0), (18, 29), (25, 22)])
C.spawn = {'x': 1.5, 'y': 14.8}
C.encounters = [
    {'id': 'soldier1', 'battle': 'soldier1', 'x': 12.5, 'y': 9.5, 'figure': 'soldier',
     'when': {'flags': ['giong.grown'], 'notFlags': ['soldier1.won']}},
    {'id': 'soldier2', 'battle': 'soldier2', 'x': 12.5, 'y': 21.5, 'figure': 'soldier',
     'when': {'flags': ['giong.grown'], 'notFlags': ['soldier2.won']}},
    {'id': 'boss', 'battle': 'boss', 'x': 24.5, 'y': 8.2, 'figure': 'general',
     'when': {'flags': ['soldier1.won', 'soldier2.won'], 'notFlags': ['era1.boss.won']}},
]
C.life = [
    {'kind': 'duck', 'n': 2, 'x': 6.0, 'y': 5.8, 'r': 1.5},
    {'kind': 'duck', 'n': 2, 'x': 17.4, 'y': 20.6, 'r': 1.5},
    {'kind': 'duck', 'n': 1, 'x': 8.3, 'y': 24.4, 'r': 1},
]
C.triggers = [
    {'id': 'field', 'x': 2, 'y': 2, 'w': 22, 'h': 11, 'on': 'tap', 'action': {'textKey': 'map.field'}},
    {'id': 'field-south', 'x': 2, 'y': 17, 'w': 22, 'h': 11, 'on': 'tap', 'action': {'textKey': 'map.field'}},
]
C.paths = {
    'field-north': [[12.5, 2.5], [12.5, 13.5], [0.5, 14.5]],
    'field-south': [[12.5, 27.5], [12.5, 16.0], [0.5, 14.8]],
}
C.exits = [
    {'id': 'west-road', 'kind': 'road', 'x': 0, 'y': 13, 'w': 1, 'h': 4, 'to': {'map': 'phu-dong', 'x': 38.2, 'dy': 0}},
]

# ---------------------------------------------------------------- The road south-west to Thăng Long
D = M('road-thanglong', 'place.roadthanglong', 40, 24)
D.geo = {'at': [105.87, 21.04], 'north': NORTH}
# The Red River: wide water with sand banks. A ferry crosses it.
D.fill(13, 0, 1, 24, '_')
D.fill(14, 0, 13, 24, '~')
D.fill(27, 0, 1, 24, '_')
D.fill(28, 11, 12, 2, '=')
D.fill(27, 11, 1, 2, '=')
D.fill(0, 11, 13, 2, '=')
D.fill(13, 11, 1, 2, '=')
D.fill(30, 2, 8, 7, 'f')
D.fill(30, 15, 8, 7, 'f')
D.fill(2, 2, 8, 6, 'f')
D.fill(1, 15, 5, 3, 'y')
D.fill(6, 16, 5, 1, '=')
D.flowers(24, 17)
D.terrace = 'nsew'
D.obj('ferry-east', 'boat', 25, 10, 2, 1, water=True, solid=False)
D.obj('ferry-west', 'boat', 14, 13, 2, 1, water=True, solid=False)
D.obj('house1', 'house', 2, 17, 3, 3)
D.obj('house2', 'giong-house', 6, 18, 3, 3)
D.obj('sign', 'signpost', 2, 9)
D.obj('hay1', 'haystack', 36, 13)
D.many('tree', 'tree', [(11, 1), (1, 9), (11, 16), (29, 13), (38, 10), (38, 22), (29, 23), (12, 22), (0, 22)])
D.many('bamboo', 'bamboo', [(28, 1), (39, 1), (10, 9), (28, 20)])
D.many('banana', 'banana', [(9, 14), (33, 12)])
D.spawn = {'x': 38.5, 'y': 12.0}
D.life = [
    {'kind': 'duck', 'n': 2, 'x': 20.0, 'y': 5.8, 'r': 1.5},
    {'kind': 'duck', 'n': 1, 'x': 22.5, 'y': 18.5, 'r': 1},
]
D.triggers = [
    {'id': 'ferry-east', 'x': 27, 'y': 11, 'w': 1, 'h': 2, 'on': 'enter', 'action': {'move': {'x': 12.4, 'y': 12.0}, 'textKey': 'map.ferry'}},
    {'id': 'ferry-west', 'x': 13, 'y': 11, 'w': 1, 'h': 2, 'on': 'enter', 'action': {'move': {'x': 28.6, 'y': 12.0}, 'textKey': 'map.ferry.back'}},
    {'id': 'vanmieu', 'x': 0, 'y': 11, 'w': 1, 'h': 2, 'on': 'enter', 'when': {'flags': ['prologue.done']}, 'action': {'open': 'vanmieu'}},
    {'id': 'vanmieu-early', 'x': 0, 'y': 11, 'w': 1, 'h': 2, 'on': 'enter', 'action': {'textKey': 'map.road.early'}},
    {'id': 'sign', 'x': 2, 'y': 9, 'on': 'tap', 'action': {'textKey': 'map.sign.vanmieu'}},
    {'id': 'river', 'x': 14, 'y': 0, 'w': 13, 'h': 24, 'on': 'tap', 'action': {'textKey': 'map.redriver'}},
    {'id': 'field', 'x': 30, 'y': 2, 'w': 8, 'h': 20, 'on': 'tap', 'action': {'textKey': 'map.field'}},
    {'id': 'field-west', 'x': 2, 'y': 2, 'w': 8, 'h': 6, 'on': 'tap', 'action': {'textKey': 'map.field'}},
]
D.exits = [
    {'id': 'east-road', 'kind': 'road', 'x': 39, 'y': 11, 'w': 1, 'h': 2, 'to': {'map': 'phu-dong', 'x': 1.3, 'dy': 28}},
]

os.makedirs(OUT, exist_ok=True)
for m in (A, B, C, D):
    with open(os.path.join(OUT, f'{m.id}.json'), 'w') as f:
        f.write(dump(m.data('giong')) + '\n')
    print(m.id, m.w, m.h)
