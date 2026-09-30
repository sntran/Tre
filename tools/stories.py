#!/usr/bin/env python3
# Make docs/reference/stories.html from the story files in tests/stories/: a plain page that
# lists the stories with their "about" line and a link to each one in the game
# (?story=<name>&play). Run it after a change to a story; the page is committed.
import html, json, os, sys

ROOT = os.path.join(os.path.dirname(__file__), '..')
SRC = os.path.join(ROOT, 'tests', 'stories')
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'docs', 'reference', 'stories.html')

stories = []
for name in sorted(os.listdir(SRC)):
    if name.endswith('.json'):
        with open(os.path.join(SRC, name), encoding='utf-8') as f:
            stories.append(json.load(f))

rows = []
for s in stories:
    about = s.get('about', {})
    link = f"../../index.html?story={s['name']}"
    # A whole day plays faster.
    fast = '&amp;speed=4' if s['name'] == 'day' else ''
    rows.append(f"""    <li>
      <h2>{html.escape(s['name'])}</h2>
      <p lang="vi">{html.escape(about.get('vi', ''))}</p>
      <p lang="en">{html.escape(about.get('en', ''))}</p>
      <p class="meta">{html.escape(s.get('map', 'phu-dong'))} · {len(s.get('steps', []))} steps ·
        <a href="{link}&amp;play{fast}">play</a> ·
        <a href="{link}&amp;play{fast}&amp;debug=1">play with the debug panel</a> ·
        <a href="{link}">open at the start</a></p>
    </li>""")

page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tre stories</title>
<!-- Made by tools/stories.py from tests/stories/*.json. Do not edit by hand. -->
<style>
  :root {{ --ink: #1f1b17; --paper: #efe4c8; --diep: #f7f0df; --vermilion: #b3412a; --indigo: #2f4668; }}
  body {{ margin: 0; padding: 16px; background: var(--paper); color: var(--ink); font: 16px/1.5 system-ui, sans-serif; }}
  main {{ max-width: 860px; margin: 0 auto; }}
  h1 {{ font-family: Georgia, serif; margin: 0 0 4px; }}
  ul {{ list-style: none; padding: 0; display: grid; gap: 12px; }}
  li {{ padding: 10px 14px; border: 2px solid var(--ink); border-radius: 8px; background: var(--diep); }}
  h2 {{ margin: 0; font: 700 18px ui-monospace, Menlo, Consolas, monospace; color: var(--indigo); }}
  p {{ margin: 4px 0; }}
  .meta {{ font-size: 14px; }}
  a {{ color: var(--vermilion); }}
</style>
</head>
<body>
<main>
  <h1>Tre stories</h1>
  <p>The use paths of the game as data (<code>tests/stories/</code>). Each story runs headless in
  <code>npm test</code>, and plays here in the game with a finger on the screen. The game waits
  one second at each check. Nothing of a story is saved.</p>
  <ul>
{chr(10).join(rows)}
  </ul>
</main>
</body>
</html>
"""
with open(OUT, 'w', encoding='utf-8') as f:
    f.write(page)
print(f'{len(stories)} stories -> {OUT}')
