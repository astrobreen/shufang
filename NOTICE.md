# Third-party data and licences

The code is MIT (see `LICENSE`). The data the app ships is derived from the sources below, and their terms apply to it.

| What | Source | Licence | Used for |
|---|---|---|---|
| HSK 3.0 word list, levels, frequencies | [drkameleon/complete-hsk-vocabulary](https://github.com/drkameleon/complete-hsk-vocabulary) | MIT | `site/vocab.json`, word levels |
| Definitions | [CC-CEDICT](https://cc-cedict.org/) (via the list above and [krmanik/cedict-json](https://github.com/krmanik/cedict-json)) | **CC BY-SA 4.0** | glosses in `site/vocab.json` and the lesson bundle, and the full dictionary in `site/dict.json` |
| Pinyin readings | [mozillazg/pinyin-data](https://github.com/mozillazg/pinyin-data), [mozillazg/phrase-pinyin-data](https://github.com/mozillazg/phrase-pinyin-data) | MIT | choosing readings for polyphonic characters |
| Stroke outlines, stroke order, character structure | [skishore/makemeahanzi](https://github.com/skishore/makemeahanzi) | Arphic Public License (fonts: Arphic PL KaitiM GB, UKai) | `site/strokes/*.json`, `site/chars.json`, `site/hw.json` (handwriting index derived from the stroke centre-lines), the 书 icon |
| Poem cross-checking (optional, not shipped) | [chinese-poetry](https://github.com/chinese-poetry/chinese-poetry) | MIT | manual verification only |

## What this means for you

* **CC-CEDICT is share-alike.** The glosses are redistributed in `site/vocab.json`, `site/dict.json` and `site/index.html`. If you publish a fork, keep this notice and license those data files under CC BY-SA 4.0 (the code stays MIT).
* **Make Me a Hanzi** data must keep the Arphic Public License notice; see the upstream `LICENSE`/`APL` files.
* **Lesson texts** (`src/content`): the dialogues, articles and story retellings were written for this project, and the poems and classical passages are public-domain works. Unless you decide otherwise, treat the original texts as CC BY-SA 4.0 so they sit comfortably with the dictionary data. Change this line if you want a different licence for your fork.

HSK is a trademark of its owners; this project is not affiliated with or endorsed by them.
