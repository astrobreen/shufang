#!/usr/bin/env bash
# Fetch the upstream datasets the build needs into ./vendor.
# Blobless + sparse checkouts pinned to the commits used for the shipped data, so only the needed files download (about 120 MB).
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p vendor
clone() { # name url commit path...
  local name=$1 url=$2 commit=$3; shift 3
  local dir="vendor/$name"
  if [ ! -d "$dir/.git" ]; then
    git clone --quiet --filter=blob:none --no-checkout "$url" "$dir"
  fi
  git -C "$dir" sparse-checkout set --no-cone "$@"
  git -C "$dir" checkout --quiet "$commit"
  echo "ok  $name @ ${commit:0:8}"
}
clone complete-hsk-vocabulary https://github.com/drkameleon/complete-hsk-vocabulary.git 7ac65bf1a6387d35f1ade478906172a19311c7f9 /complete.json /LICENSE
clone pinyin-data             https://github.com/mozillazg/pinyin-data.git             9e5e9bdfe8add694300e0cc93a27b803b68377f9 /kMandarin_8105.txt /cc_cedict.txt /LICENSE
clone phrase-pinyin-data      https://github.com/mozillazg/phrase-pinyin-data.git      cee0ed6e6e4898580cafd2bd5e3723e20b214aa0 /pinyin.txt /cc_cedict.txt /LICENSE
clone makemeahanzi            https://github.com/skishore/makemeahanzi.git             bddc96d41bef78427ed0e034e9f7e31d71fd1b92 /dictionary.txt /graphics.txt /LICENSE /COPYING /APL
clone cedict-json             https://github.com/krmanik/cedict-json.git               63c2569948629323b515833930fdd10f285401b6 /all_cedict.json /cedict_ts.u8 /README.md
# Optional, only for checking poems by hand (large):
#   git clone --depth 1 https://github.com/chinese-poetry/chinese-poetry.git vendor/chinese-poetry
