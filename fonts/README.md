# Fonts

The game uses two fonts. Both have all Vietnamese marks. The files are subsets (Latin and Vietnamese characters only) in the WOFF2 format.

| Font | Use | License |
| --- | --- | --- |
| Alegreya Bold | Titles and names (display) | SIL Open Font License 1.1 (`OFL-Alegreya.txt`) |
| Be Vietnam Pro (Regular, SemiBold, Bold) | All other text (body) | SIL Open Font License 1.1 (`OFL-BeVietnamPro.txt`) |

The fonts are not under the licenses of the code or the content. They keep their own license.

A test (`tests/fonts.test.js`) checks that the fonts have each character of `i18n/vi.json` and `i18n/en.json`.
