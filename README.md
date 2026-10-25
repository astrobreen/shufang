# Shufang 书房

A graded Chinese reader and study room. HSK 3.0 levels 1 to 9, tap-to-define reading, audio, idioms, spaced-repetition flashcards, stroke-order writing, and tone and listening drills. No account and no tracking.

* **Coverage:** 156 lessons, about 11,000 HSK words, about 3,000 characters with stroke order, 146 idioms
* **Stack:** plain HTML, CSS and JavaScript. No framework and no server.
* **Data:** stays on your device, with backup and restore.

## What is in it

* **Read.** 156 lessons from HSK 1 to 9: dialogues, articles, stories, Tang and Song poems, and classical prose. Tap any word for pinyin, meaning, example and characters. Smart pinyin hides words at or below your level. Simplified or traditional, pinyin / numbered pinyin / zhuyin, tone colours, sentence translations, sentence-by-sentence audio, listening mode, grammar notes and a short quiz per lesson.
* **Words.** The full HSK 3.0 list (about 11,000 words) with search by character, pinyin or English. Save words to your own list.
* **Practice.** SM-2 style flashcards, stroke-order animation and handwriting check for about 3,000 characters, a tone drill, a listening drill, a grammar index (268 patterns) and a pinyin chart with audio.
* **Idioms (成语, chéngyǔ).** Four-character sayings, many from old stories, such as 画蛇添足 ("draw a snake and add feet", to ruin something by overdoing it). 146 idioms in nine topics, each with an example sentence, a story or usage note, and a daily idiom on the Today screen. Filter by topic and by how common the idiom is.
* **Placement test.** A real test, not a self-rating: it asks what words mean, moves up or down a level by bisection and finds your HSK level in about 18 to 24 questions. "I don't know" counts as wrong, so guessing does not help.
* **Today and Me.** Daily goal, streak, 10-week activity map, placement test, backup and restore.
* Light and dark themes, works at phone width, keyboard shortcuts for flashcards.

## Run it

The site is static, so any file server works (opening `index.html` from disk will not, because data files are fetched).

```bash
npm run serve          # python3 -m http.server 8080 --directory site
# then open http://localhost:8080
```

## Put it online

**GitHub Pages.** Push to a repository, then *Settings, Pages, Source: GitHub Actions*. The included workflow (`.github/workflows/pages.yml`) publishes `site/` on every push to `main`. Any static host (Netlify, Cloudflare Pages, S3) also works: serve the `site/` folder.

Progress lives in the browser (`localStorage`). *Me, Your data* saves and restores a backup file, and you can merge backups from several devices.

## Project layout

```
src/app/            the app: core.js (pure logic), app.css, js/*.js (one file per area, concatenated in order)
src/content/        lesson texts (texts/*.txt), the older hand-annotated lessons (legacy/), lexicon and compound lists
tools/              Python build pipeline and helpers
build/              committed intermediate data (legacy lessons, traditional-character map, inline bundle)
site/               the built, deployable site (committed so Pages works without a build)
tests/              unit, data and browser tests
docs/               screenshots and the content guide
```

## Build from source

Only needed when you change lessons or data. Editing the UI needs no Python at all:

```bash
python3 tools/make.py --no-data     # rebuild site/ from src/app and the committed data bundle
```

Full rebuild (re-annotate all lessons, rebuild the vocabulary and stroke data):

```bash
tools/fetch_sources.sh              # clones the upstream datasets into ./vendor (pinned commits, sparse checkout, about 120 MB)
python3 tools/make.py
```

The pipeline is deterministic; re-running it on the committed sources reproduces `site/` byte for byte.
How lessons are written and annotated is in [`docs/CONTENT.md`](docs/CONTENT.md).

## Tests

```bash
npm test                  # core logic and lesson-data integrity (Node only)
npm i -D playwright && npx playwright install chromium
npm run test:smoke        # boots the built site in Chromium, walks every tab, and checks the placement test on simulated learners
```

## Accuracy, and what to double-check

This is a learning tool, so it is worth saying where it can be wrong.

* **Pinyin, glosses and grammar notes** are produced by software (dictionary lookup, phrase-based reading selection, hand-written rules for common polyphones) and reviewed by the author. There is no native-speaker editor, so mistakes are possible, most of all with rare readings and classical texts. There is a *Report a mistake* button in every word sheet; reports are kept on the device and can be copied from the Me tab.
* **Classical prose** (Analects, Daodejing and similar) was written down from memory and is marked as unverified in the app. The poems were cross-checked against the open chinese-poetry corpus. Compare with a printed edition before quoting either.
* **HSK 7 to 9** are one official band. The app splits it into three levels by word frequency, which is an estimate.
* **A lesson's level** is the lowest HSK level that covers at least 90% of its words.
* **Audio** uses the Chinese voices installed on your device (the Web Speech API), so quality and availability vary.

## Contributing

Fixes to readings, glosses and lessons are the most useful contributions. Edit the text files in `src/content/texts`, run `python3 tools/make.py`, check the diff of `build/` and `site/`, and open a pull request. New lessons need a title, a summary, a translation for every sentence, at least one grammar note and three quiz questions; `npm test` enforces this.

## Licence

Code: MIT, see [`LICENSE`](LICENSE). Data and texts: see [`NOTICE.md`](NOTICE.md). The dictionary data (CC-CEDICT) is CC BY-SA 4.0 and the stroke data (Make Me a Hanzi) is under the Arphic Public License, so a fork that redistributes `site/` must keep those notices.
