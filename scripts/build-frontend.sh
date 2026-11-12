#!/usr/bin/env bash
# Compile le front à côté de la version en ligne, puis l'échange d'un coup :
# le site ne sert jamais une version à moitié écrite.
set -euo pipefail
cd "$(dirname "$0")/../frontend"

LIVE=dist/frontend/browser
rm -rf dist-next dist-old
npx ng build --output-path dist-next/frontend

# les onglets restés ouverts sur l'ancienne version réclament encore ses fichiers JS/CSS (noms uniques) :
# on les garde une semaine (cp -p conserve la date, donc ils finissent par expirer)
if [ -d "$LIVE" ]; then
  find "$LIVE" -maxdepth 1 -type f \( -name '*.js' -o -name '*.css' \) -mtime -7 -exec cp -n -p {} dist-next/frontend/browser/ \;
fi

# échange quasi instantané (deux renommages)
[ -d dist ] && mv dist dist-old
mv dist-next dist
rm -rf dist-old
echo "front en ligne : $(ls dist/frontend/browser | wc -l) fichiers"
