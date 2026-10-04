#!/usr/bin/env python3
# Make the maps of the Era 1 region (Thánh Gióng) with the real layout:
# Phù Đổng on the north bank of the Đuống, Sóc Sơn to the north, Núi Trâu to the east,
# and Thăng Long with Văn Miếu to the south-west, across the Đuống and the Red River.
# On every map, north is map -y (the screen up and right), and east is map +x.
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from maplib import M, ore_triggers, dump, place_def

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
# The Đuống: the north bank (sand), the water, the south bank. The ford and the bridge, with a
# broken part in the middle (the placement zone bridge-gap).
A.fill(0, 31, 40, 2, '_')
A.fill(0, 33, 40, 5, '~')
A.fill(0, 38, 40, 1, '_')
A.fill(8, 33, 2, 5, 's')
# Stepping stones across the ford, one step high, on every second cell (a place to jump).
A.cells += [(17, y, 'r', 1) for y in (67, 69, 71, 73, 75)]
A.fill(22, 33, 2, 5, 'B')
A.fill(8, 31, 2, 2, '=')
A.fill(22, 31, 2, 2, '=')
A.fill(8, 38, 2, 1, '=')
A.fill(22, 38, 2, 1, '=')
# The south bank: the road south-west to Thăng Long, and fields.
A.fill(0, 39, 24, 2, '=')
A.fill(26, 39, 12, 3, 'f')
A.fill(31, 39, 1, 3, '=')
A.flowers(34, 7)
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
# Small houses of the villagers who have no other house, and the coops of the yards. Each hut
# stands near the work of its owner: the smith across the road from the forge, the fisher on the
# river bank, the teacher by the school, the healer by the herbs, and the woodcutter by the bamboo
# hedge. No hut stands in front of the work of a trial, as the camera sees it at its first angle
# (a test in tests/tasks.test.js), so that the child sees the work with nothing in front.
A.obj('hut-elder', 'hut', 5, 5, 3, 3)
A.obj('hut-teacher', 'hut', 24, 5, 3, 3)
A.obj('hut-woodcutter', 'hut', 9, 2, 3, 3)
A.obj('hut-smith', 'hut', 19, 17, 3, 3)
A.obj('hut-healer', 'hut', 11, 23, 3, 3)
A.obj('hut-fisher', 'hut', 17, 29, 3, 3)
A.obj('coop1', 'coop', 7, 12)
A.obj('coop2', 'coop', 29, 12)
A.obj('hay1', 'haystack', 7, 10)
A.obj('rice1', 'rice-stack', 11, 18)
A.many('fence', 'fence', [(3, 18), (4, 18), (5, 18)])
A.obj('rock1', 'rock', 10, 16)
A.obj('boat', 'boat', 12, 31, 2, 1)
A.obj('ore2', 'ore', 3, 31)
A.obj('rock2', 'rock', 33, 31)
A.obj('sign', 'signpost', 20, 41)
# The trees, the banana plants, and the bamboo clumps. A plant in front of the work of a trial (as the
# camera sees it at its first angle) is gone, so that the work is in the open; the others keep
# their numbers (the ids in a save).
GONE = {(28, 4), (29, 7), (20, 17), (29, 23), (26, 25), (14, 25), (18, 23), (20, 20), (36, 30)}
def plants(prefix, art, points):
    for i, p in enumerate(points, 1):
        if p not in GONE:
            A.obj(f'{prefix}{i}', art, *p)
plants('tree', 'tree', [(3, 3), (6, 4), (12, 5), (14, 3), (21, 6), (28, 4), (29, 7), (2, 16), (20, 17), (29, 23),
                        (26, 25), (6, 26), (14, 25), (18, 23), (33, 13), (37, 16), (3, 27), (16, 30), (27, 30),
                        (12, 42), (19, 42), (38, 38)])
plants('banana', 'banana', [(8, 3), (10, 6), (20, 20), (2, 11), (28, 27), (34, 29), (24, 42)])
plants('bamboo', 'bamboo', [(12, 27), (36, 30), (5, 30), (14, 41), (38, 40)])
A.spawn = {'x': 5.5, 'y': 13.3}
# Named places for the plans of the day (data/world/people.json). h: the height over the ground
# in half blocks.
A.places = {
    'well': {'x': 20.5, 'y': 12.6},
    'coop1': {'x': 7.5, 'y': 13.4},
    'coop2': {'x': 29.5, 'y': 13.4},
    'banyan-top': {'x': 18.5, 'y': 4.5, 'h': 17},
    # The planks for the bridge lie on the bank in rows; the plank outlines for the prediction
    # lie on the sand to the west of the bridge.
    'bridge-pile': {'x': 24.5, 'y': 31.25},
    'bridge-guess': {'x': 18.5, 'y': 32},
    # The things of the Five Trials (data/trials.json), near each person: the heap of counting
    # rods and the mat in the school yard; the ore, the forge, the anvil, and the trough in the
    # yard of the smith, and the bucket at the well; the stakes on the sand and the line of the
    # fish trap in the river by the fisher; the three herb beds and the basket in the yard of
    # the healer; the fallen bamboo stem by the woodcutter, and the wood pile by the bridge.
    'school-rods': {'x': 25.3, 'y': 13.05},
    'school-mat': {'x': 27.6, 'y': 13.1},
    'smith-ore': {'x': 25.2, 'y': 21.9},
    'smith-forge': {'x': 24.3, 'y': 20.1},
    'smith-anvil': {'x': 27.1, 'y': 21.5},
    'smith-trough': {'x': 26.6, 'y': 22.4},
    'horse-ore': {'x': 24.4, 'y': 22.8},
    'well-bucket': {'x': 21.0, 'y': 10.0},
    'fisher-stakes': {'x': 10.5, 'y': 31.7},
    'fisher-line': {'x': 12.0, 'y': 33.25},
    'healer-bed-1': {'x': 13.2, 'y': 21.4},
    'healer-bed-2': {'x': 14.7, 'y': 21.4},
    'healer-bed-3': {'x': 16.2, 'y': 21.4},
    'healer-basket': {'x': 17.6, 'y': 20.7},
    'woodcutter-stem': {'x': 26.6, 'y': 3.6},
    'staffs-clump': {'x': 12.5, 'y': 16.25},
    'woodpile': {'x': 26.1, 'y': 30.2},
    # Rice for Gióng: the trays of bowls on the path of the paddies, and the pot in front of the
    # house of Gióng.
    'rice-trays': {'x': 8.8, 'y': 16.6},
    'giong-pot': {'x': 10.7, 'y': 13.2},
    'buffalo-shade': {'x': 37.6, 'y': 17.5},
}
# The spots of the small events of the day in the village (cells): the road on the south bank,
# the paddies on the south bank by the river (they can flood) and by the home, and the yard in
# front of the đình.
A.spots = {'road': [[10, 80]], 'field': [[57, 82], [12, 47]], 'yard': [[22, 25]]}
A.npcs = [
    {'id': 'grandma', 'x': 4.5, 'y': 12.7},
    {'id': 'mother', 'x': 11.5, 'y': 12.7},
    {'id': 'giong-boy', 'x': 9.6, 'y': 12.9},
    {'id': 'teacher', 'x': 26.5, 'y': 12.7},
    {'id': 'elder', 'x': 15.5, 'y': 12.8},
    {'id': 'messenger', 'x': 17.7, 'y': 12.9},
    {'id': 'smith', 'x': 26.5, 'y': 20.7},
    {'id': 'healer', 'x': 15.5, 'y': 20.7},
    {'id': 'woodcutter', 'x': 25.8, 'y': 4.2},
    {'id': 'giong-hero', 'x': 30.0, 'y': 17.6},
    {'id': 'fisher', 'x': 14.6, 'y': 31.6},
]
A.encounters = [
    {'id': 'river', 'raid': 'river', 'x': 5.5, 'y': 31.3, 'figure': 'river-serpent',
     'when': {'flags': ['giong.spoke'], 'notFlags': ['river.calmed']}},
    {'id': 'scouts', 'raid': 'scouts', 'x': 34.3, 'y': 14.6, 'figure': 'scout',
     'when': {'flags': ['giong.spoke'], 'notFlags': ['scouts.won']}},
    {'id': 'patrol', 'raid': 'patrol', 'x': 34.3, 'y': 14.6, 'figure': 'scout',
     'when': {'flags': ['giong.farewell']}},
]
# The bridge over the water blocks; the ground system opens its deck from the state of the zone
# (data/world/zones.json, task bridge).
A.collision = [{'x': 22, 'y': 33, 'w': 2, 'h': 5, 'block': True, 'note': 'the bridge: its deck opens from the state of the zone'}]
A.zones = [{'id': 'bridge-gap', 'x': 22, 'y': 33, 'w': 2, 'h': 5, 'task': 'bridge'}]
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
    {'kind': 'cart', 'n': 1, 'x': 18.5, 'y': 16.8, 'r': 0},
    {'kind': 'heat', 'n': 1, 'x': 26.5, 'y': 18.5, 'r': 0},
    {'kind': 'owl', 'n': 1, 'x': 18.5, 'y': 4.5, 'r': 0, 'spot': 'banyan-top'},
    {'kind': 'bird', 'n': 7, 'x': 18.5, 'y': 6.5, 'r': 3},
    {'kind': 'grass', 'n': 14, 'x': 5.0, 'y': 16.8, 'r': 2.5},
    {'kind': 'grass', 'n': 12, 'x': 20.0, 'y': 24.0, 'r': 3},
    {'kind': 'grass', 'n': 10, 'x': 30.0, 'y': 27.0, 'r': 2.5},
    {'kind': 'grass', 'n': 10, 'x': 12.0, 'y': 29.5, 'r': 2.5},
    # The small joys (docs/WORLD.md, "The world at rest"): ducklings on the path by the paddies of
    # the ducks, a frog on a lily pad by the sand, a kingfisher on a stake by the ford, a golden
    # bamboo shoot in the low hedge, puddles on the roads after the rain, and at Tết a pot of
    # bánh chưng and a lion dance in the yard of the đình.
    {'kind': 'duckling', 'n': 4, 'x': 6.0, 'y': 22.3, 'r': 0.6},
    {'kind': 'lily-pad', 'n': 1, 'x': 4.0, 'y': 33.2, 'r': 0},
    {'kind': 'frog', 'n': 1, 'x': 4.0, 'y': 33.2, 'r': 0},
    {'kind': 'kingfisher', 'n': 1, 'x': 7.3, 'y': 32.65, 'r': 0},
    {'kind': 'golden-shoot', 'n': 1, 'x': 5.25, 'y': 28.25, 'r': 0},
    {'kind': 'puddle', 'n': 1, 'x': 15.25, 'y': 14.75, 'r': 0},
    {'kind': 'puddle', 'n': 1, 'x': 26.25, 'y': 15.15, 'r': 0},
    {'kind': 'puddle', 'n': 1, 'x': 22.75, 'y': 25.25, 'r': 0},
    {'kind': 'banh-chung', 'n': 1, 'x': 13.3, 'y': 12.4, 'r': 0},
    {'kind': 'lion', 'n': 1, 'x': 16.75, 'y': 13.3, 'r': 0},
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
    {'id': 'river', 'x': 0, 'y': 33, 'w': 40, 'h': 5, 'on': 'tap', 'action': {'textKey': 'map.river'}},
]
A.paths = {'east-road': [[39.5, 14.8], [32.5, 14.8]]}

# ---------------------------------------------------------------- The hills of Sóc Sơn, to the north
B = M('soc-son', 'place.socson', 30, 32)
B.geo = {'at': [105.826, 21.272], 'north': NORTH}
B.fill(15, 5, 2, 27, '=')
B.fill(12, 5, 8, 3, 'y')
B.fill(4, 25, 6, 5, 'f')
B.fill(4, 27, 11, 1, '=')
B.flowers(26, 13)
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
C.obj('rock1', 'rock', 28, 12)
C.obj('rock2', 'rock', 21, 6)
C.obj('hay1', 'haystack', 14, 15)
C.many('tree', 'tree', [(0, 0), (19, 3), (29, 3), (25, 13), (30, 20), (26, 27), (0, 29), (14, 29), (0, 16)])
C.many('banana', 'banana', [(27, 17), (6, 30)])
C.many('bamboo', 'bamboo', [(29, 9), (31, 0), (18, 29), (25, 22)])
C.spawn = {'x': 1.5, 'y': 14.8}
C.encounters = [
    {'id': 'soldier1', 'raid': 'soldier1', 'x': 12.5, 'y': 9.5, 'figure': 'soldier',
     'when': {'flags': ['giong.grown'], 'notFlags': ['soldier1.won']}},
    {'id': 'soldier2', 'raid': 'soldier2', 'x': 12.5, 'y': 21.5, 'figure': 'soldier',
     'when': {'flags': ['giong.grown'], 'notFlags': ['soldier2.won']}},
    {'id': 'boss', 'raid': 'boss', 'x': 24.5, 'y': 8.2, 'figure': 'general',
     'when': {'flags': ['soldier1.won', 'soldier2.won', 'boss.staffs'], 'notFlags': ['era1.boss.won']}},
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
# The ferry: one boat that waits at a landing and takes the hero and Nghé across (no cut).
D.ferries = [{'id': 'red', 'a': {'x': 25.2, 'y': 12.0}, 'b': {'x': 14.8, 'y': 12.0}, 'landA': {'x': 28.6, 'y': 12.0}, 'landB': {'x': 12.4, 'y': 12.0}}]
D.obj('house1', 'house', 2, 17, 3, 3)
D.obj('house2', 'giong-house', 6, 18, 3, 3)
D.obj('sign', 'signpost', 2, 9)
# The way to Văn Miếu at the west end of the road: its gate across the road, and a stele on a turtle.
D.obj('vanmieu-gate', 'vanmieu-gate', 0, 10, 1, 4, solid=[[0, 0], [0, 3]])
D.obj('stele', 'stele', 2, 13, 2, 2)
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
    {'id': 'ferry-east', 'x': 27, 'y': 11, 'w': 1, 'h': 2, 'on': 'enter', 'action': {'ferry': 'red', 'textKey': 'map.ferry'}},
    {'id': 'ferry-west', 'x': 13, 'y': 11, 'w': 1, 'h': 2, 'on': 'enter', 'action': {'ferry': 'red', 'textKey': 'map.ferry.back'}},
    {'id': 'vanmieu', 'x': 0, 'y': 11, 'w': 1, 'h': 2, 'on': 'enter', 'when': {'flags': ['prologue.done']}, 'action': {'open': 'vanmieu'}},
    {'id': 'vanmieu-early', 'x': 0, 'y': 11, 'w': 1, 'h': 2, 'on': 'enter', 'action': {'textKey': 'map.road.early'}},
    {'id': 'sign', 'x': 2, 'y': 9, 'on': 'tap', 'action': {'textKey': 'map.sign.vanmieu'}},
    {'id': 'river', 'x': 14, 'y': 0, 'w': 13, 'h': 24, 'on': 'tap', 'action': {'textKey': 'map.redriver'}},
    {'id': 'field', 'x': 30, 'y': 2, 'w': 8, 'h': 20, 'on': 'tap', 'action': {'textKey': 'map.field'}},
    {'id': 'field-west', 'x': 2, 'y': 2, 'w': 8, 'h': 6, 'on': 'tap', 'action': {'textKey': 'map.field'}},
]

# ---------------------------------------------------------------- Xóm Ruộng, a quiet hamlet north of Phù Đổng
# A small hand-made hamlet for the activities of multiplication (docs/PLANTING.md), the same in
# every world: three houses on stilts around one open yard, a paddy field with a seedbed, a duck
# pond, a stream with a small bamboo bridge, and a đình yard with a bronze drum. Each station is
# 8 to 12 cells from the middle of the yard, on a wide straight path with no prop in the way.
E = M('xom-ruong', 'place.xomruong', 28, 22)
E.geo = {'at': [105.97, 21.1], 'north': NORTH}
E.flowers(18, 31)
# The paddy field of the plots, its dike, and the seedbed south of the dike.
E.fill(4, 2, 10, 10, 'f')
E.fill(4, 12, 10, 1, 'd')
E.fill(6, 13, 3, 2, 'f')
# The yard, and the paths from the yard to each station (wide and straight).
E.fill(14, 9, 6, 5, 'y')
E.fill(18, 5, 1, 4, '=')
E.fill(20, 10, 4, 2, '=')
E.fill(16, 14, 2, 2, '=')
E.fill(26, 10, 2, 2, '=')
E.fill(14, 14, 1, 8, '=')
# The duck pond to the north, the stream to the east with its bamboo bridge, and the đình yard to
# the south.
E.fill(17, 1, 5, 3, '~')
E.fill(24, 0, 2, 22, '~')
E.fill(24, 10, 2, 2, 'B')
E.fill(15, 16, 5, 3, 'y')
# The field of the plots is still water with no seedlings and no small dikes (the ground of a
# ditch), until the child and the farmer plant it; one dike goes across it between two bands of
# plots. The seedbed is a field with no small dikes (cells, not tiles).
E.cells += [(x, z, 'd' if z == 13 else 'c', 2 if z == 13 else 1) for x in range(8, 28) for z in range(4, 24)]
E.cells += [(x, z, 'f', 1) for x in range(12, 18) for z in range(26, 30)]
E.obj('house-duck', 'house', 14, 5, 3, 3)
E.obj('house-fisher-uncle', 'house', 21, 5, 3, 3)
E.obj('house-planter', 'house', 11, 14, 3, 3)
E.obj('dinh-xom', 'dinh', 15, 19, 4, 3)
E.obj('drum-xom', 'drum', 18, 16)
E.many('xom-tree', 'tree', [(1, 1), (1, 18), (26, 2), (26, 18), (22, 18), (8, 18)])
E.many('xom-bamboo', 'bamboo', [(12, 0), (22, 1), (1, 9)])
E.many('xom-banana', 'banana', [(13, 18), (21, 15)])
E.spawn = {'x': 17.0, 'y': 12.0}
# The people of the stations: the farmer on the dike by the seedbed, the duck girl at the pond,
# the fisher uncle at the stream by the bridge, and the old drummer in the đình yard.
E.npcs = [
    {'id': 'planter', 'x': 12.0, 'y': 12.25},
    {'id': 'duck-girl', 'x': 18.5, 'y': 6.0},
    {'id': 'fisher-uncle', 'x': 22.75, 'y': 12.5},
    {'id': 'drummer', 'x': 16.5, 'y': 16.5},
]
E.places = {
    # The bundles of seedlings lie on the dike by the seedbed.
    'plant-seedbed': {'x': 7.5, 'y': 12.6},
    'yard': {'x': 17.0, 'y': 12.0},
    # The ducks (docs/HAMLET.md): the head of the trough on the shore of the pond, and the jar of
    # feed by it; the ducks stand in a line along the trough, to the east.
    'duck-trough': {'x': 17.4, 'y': 4.6},
    'duck-jar': {'x': 17.0, 'y': 5.3},
    # The fish traps: the traps of the fisher on the bank, the first spot for a trap in the stream
    # (the spots go down the stream from it), and the small weir upstream of the bridge.
    'trap-pile': {'x': 22.2, 'y': 13.6},
    'trap-spots': {'x': 24.3, 'y': 13.2},
    'weir': {'x': 24.9, 'y': 7.5},
    # The drum dance: the bronze drums of the child, and the first dancer of the line in the yard
    # of the đình (a second group stands behind the first).
    'drum-bronze': {'x': 17.4, 'y': 15.2},
    'drum-bronze-2': {'x': 18.6, 'y': 15.2},
    'dancers': {'x': 15.3, 'y': 18.0},
}
E.zones = [{'id': 'paddy', 'x': 4, 'y': 2, 'w': 10, 'h': 10, 'task': 'paddy'}]
E.life = [
    {'kind': 'duck', 'n': 5, 'x': 19.0, 'y': 2.0, 'r': 1.2},
    {'kind': 'chicken', 'n': 3, 'x': 16.0, 'y': 8.5, 'r': 1.0},
    {'kind': 'fish', 'n': 3, 'x': 24.5, 'y': 15.0, 'r': 1.5},
]
E.spots = {'yard': [[34, 24]]}
E.triggers = [
    {'id': 'field', 'x': 4, 'y': 2, 'w': 10, 'h': 10, 'on': 'tap', 'action': {'textKey': 'map.field'}},
]

# ---------------------------------------------------------------- The places on the plane
# Each map is the frame of a place on the plane (cells, x to the east, y to the south). The hand-made
# story places are stamps (tiles: x, y, w, h); the land around them comes from data/geo/vietnam.json,
# the rules, and the seed (src/core/gen/).
PLACES = [
    # map, size of the frame (cells), offset of the hand-made map (cells), stamps (tiles)
    (A, (80, 88), (0, 0), [(0, 0, 33, 31), (0, 29, 40, 15), (31, 0, 9, 20)]),
    (B, (120, 120), (8, 4), [(0, 0, 30, 30)]),
    (C, (200, 84), (64, 4), [(0, 0, 30, 31)]),
    (D, (120, 64), (0, 16), [(0, 0, 28, 24)]),
    (E, (56, 44), (0, 0), [(0, 0, 28, 22)]),
]

# The fine height tiles of the land (data/geo/heights/, made by tools/geo/build.mjs): the land of
# the era is the land of Vietnam north of the line of the era (18.0 degrees in Era 1), and the mist
# goes a little farther. A tile that SRTM does not have is sea.
RAW = os.path.join(os.path.dirname(__file__), '..', 'geo', 'raw', 'srtm')
TILES = [f'N{la:02d}E{lo:03d}' for la in range(17, 24) for lo in range(102, 109)
         if not os.path.isdir(RAW) or os.path.exists(os.path.join(RAW, f'N{la:02d}E{lo:03d}.hgt'))]
# The tiles that the game loads at the start: the stamps and the roads between them are there.
START_TILES = ['N20E105', 'N20E106', 'N21E105', 'N21E106']

# The plane of the land (src/core/gen/plane.js, src/core/gen/tiles.js): one plane for the whole
# country, at one scale (meters for each cell), the same in both directions. Each map is the frame
# of a place: its anchor is a cell of the frame and its real place. Phù Đổng: the đình. Sóc Sơn: the
# top of núi Vệ Linh (the stamp rises with the hill). Núi Trâu: the top of the hill, east of the
# fields of the stamp. Văn Miếu: the gate. The pins are the ends of the rivers of the stamps: the
# real rivers bend to meet them. The roads join the roads of the stamps (points in the cells of the
# frames).
PLANE = {
    '_about': ('The land of the region of Thánh Gióng on the plane (src/core/gen/tiles.js). plane: the projection '
               '(Mercator; origin: the real place of the cell 0, 0; trueLat: the latitude of true scale; scale: meters of '
               'real land for each cell, the same in both directions). frames: the place of each map on the plane (cell: a '
               'cell of the frame of the map; at: its real place; lift: the stamp under the cell rises to the real height '
               'there; quiet: no hamlet of the land within these cells of the stamps). pins: the ends of the rivers of the stamps (frame and cell): the real river bends to meet them. '
               'rivers: the widths of the real rivers (cells; from: the main river of a branch, where the branch begins). roads: the roads between the stamps (points: frame and cell; '
               'the road winds between its points by the seed; on a hill it turns back and forth). tiles: the fine height '
               'tiles (data/geo/heights/); startTiles: the tiles that the game loads at the start (the game loads the others '
               'when the hero comes near them). base: the height of the low land (steps). relief: the curve from meters to '
               'steps: k x the square root of the meters over low (the land under low is flat). road: steep (the most steps '
               'for each cell that a road climbs without a cost), climb (the cost of a steeper climb), keep (the cost of '
               'each cell away from the line of the road). wet: the rice paddies (scale of the noise, near: cells from '
               'water, over: the least score, terrace: cells from a hamlet where paddies are terraces over the low land). '
               'blend: cells over which the land comes to the height of a stamp. dike: the size of a paddy block. mist: '
               'the land out of the land of the era (cells): fade (the land fades into the paper over these cells), walk '
               '(the hero walks this far into the mist, then turns back). sea: surf (cells of sea to the knee). Made by '
               'tools/maps/era1.py; do not change it by hand.'),
    'id': 'giong',
    'plane': {'origin': [102.0, 23.5], 'trueLat': 16, 'scale': 45},
    'tiles': TILES,
    'startTiles': START_TILES,
    'frames': [
        {'id': 'phu-dong', 'cell': [32, 20], 'at': [105.953, 21.059], 'note': 'the đình'},
        {'id': 'soc-son', 'cell': [38, 20], 'at': [105.825, 21.29], 'lift': True, 'note': 'the top of núi Vệ Linh'},
        {'id': 'trau-son', 'cell': [176, 20], 'at': [106.1, 21.145], 'note': 'the top of Núi Trâu, east of the fields'},
        {'id': 'road-thanglong', 'cell': [0, 40], 'at': [105.836, 21.029], 'note': 'the gate of Văn Miếu'},
        {'id': 'xom-ruong', 'cell': [34, 24], 'at': [105.97, 21.1], 'quiet': 16, 'note': 'the yard of Xóm Ruộng, north of Phù Đổng (quiet: no hamlet of the land within 16 cells)'},
    ],
    'pins': [
        {'river': 'duong', 'frame': 'phu-dong', 'cell': [0, 71]},
        {'river': 'duong', 'frame': 'phu-dong', 'cell': [80, 71]},
        {'river': 'hong', 'frame': 'road-thanglong', 'cell': [41, 16]},
        {'river': 'hong', 'frame': 'road-thanglong', 'cell': [41, 63]},
    ],
    'base': 2,
    'relief': {'low': 16, 'k': 0.8},
    'rivers': [
        {'id': 'duong', 'water': 10, 'bank': 2, 'bend': 2, 'from': 'hong'},
        {'id': 'hong', 'water': 26, 'bank': 2, 'bend': 3},
        # The other rivers of the land of Era 1, each with a width from its size (cells of 45 m).
        # The Lục Đầu Giang, where the Đuống meets the Cầu and the Thương, begins the Thái Bình.
        {'id': 'thai-binh', 'water': 14, 'bank': 2, 'bend': 3, 'from': 'duong'},
        {'id': 'bach-dang', 'water': 14, 'bank': 2, 'bend': 2},
        {'id': 'ma', 'water': 10, 'bank': 2, 'bend': 3},
        {'id': 'ca', 'water': 12, 'bank': 2, 'bend': 3},
        {'id': 'mekong', 'water': 24, 'bank': 2, 'bend': 3},
    ],
    'roads': [
        {'id': 'east', 'width': 4, 'points': [['phu-dong', 79, 30], ['trau-son', 64, 33]]},
        {'id': 'north', 'width': 4, 'points': [['phu-dong', 46, 0], ['soc-son', 39, 63]]},
        {'id': 'west', 'width': 4, 'points': [['phu-dong', 0, 80], ['road-thanglong', 55, 39]]},
        {'id': 'xom-ruong', 'width': 2, 'bend': 0, 'points': [['phu-dong', 46, 0], ['xom-ruong', 29, 43]]},
        {'id': 'trau', 'width': 2, 'bend': 2, 'points': [['trau-son', 123, 19], ['trau-son', 176, 20]]},
    ],
    'road': {'steep': 0.7, 'climb': 40, 'keep': 0.06},
    'wet': {'scale': 22, 'near': 14, 'over': 0.15, 'terrace': 14},
    'blend': 10,
    'dike': 5,
    'mist': {'fade': 12, 'walk': 4},
}

os.makedirs(OUT, exist_ok=True)
for m, size, offset, stamps in PLACES:
    with open(os.path.join(OUT, f'{m.id}.json'), 'w') as f:
        f.write(dump(place_def(m, 'giong', size, offset, stamps)) + '\n')
    print(m.id, size)
with open(os.path.join(OUT, '..', 'world', 'land-giong.json'), 'w') as f:
    f.write(dump(PLANE) + '\n')
