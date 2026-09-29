import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../', import.meta.url).pathname;

// The screenshots of an issue live in docs/media/issue-N/: at most three JPEG files, each under
// 200 KB. No videos in the repository: every clone would carry them for good.
test('the media of the issues are few, small JPEG screenshots, and there are no videos', () => {
  const media = join(root, 'docs/media');
  if (existsSync(media)) {
    for (const dir of readdirSync(media)) {
      assert.match(dir, /^issue-\d+$/, `docs/media/${dir}`);
      const files = readdirSync(join(media, dir));
      assert.ok(files.length <= 3, `docs/media/${dir} has ${files.length} files`);
      for (const f of files) {
        assert.match(f, /\.jpg$/, `docs/media/${dir}/${f} is a JPEG`);
        assert.ok(statSync(join(media, dir, f)).size < 200 * 1024, `docs/media/${dir}/${f} is under 200 KB`);
      }
    }
  }
  const walk = (dir) => {
    for (const name of readdirSync(join(root, dir))) {
      if (name === '.git' || name === 'node_modules') continue;
      const rel = dir ? `${dir}/${name}` : name;
      if (statSync(join(root, rel)).isDirectory()) walk(rel);
      else assert.ok(!/\.(webm|mp4|mov|gif)$/i.test(name), `${rel} is a video`);
    }
  };
  walk('');
});
