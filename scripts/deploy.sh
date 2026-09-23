#!/usr/bin/env bash
# Публикация: тесты → сборка → содержимое dist/ в ветку gh-pages (GitHub Pages раздаёт её как сайт).
set -euo pipefail
cd "$(dirname "$0")/.."
REPO_URL="$(git remote get-url origin)"
npm test
npm run build
touch dist/.nojekyll
cd dist
rm -rf .git
git init -q -b gh-pages
git add -A
git commit -q -m "Публикация $(date +%Y-%m-%d\ %H:%M)"
git push -q -f "$REPO_URL" gh-pages
rm -rf .git
echo "Опубликовано: https://vik9123.github.io/trenirovki/"
