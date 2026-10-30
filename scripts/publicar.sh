#!/usr/bin/env bash
# Publica a versão atual nos dois repositórios do GitHub:
#   1) CGB-ENERGIA/gestao-de-acidentalidade (privado, ligado ao Vercel): push normal da branch main
#   2) marcusvqueiros-hue/Gestao-Acidente (público): um commit por cima do último, SEM os arquivos sensíveis
# Uso: bash scripts/publicar.sh   (depois de commitar na main)
set -euo pipefail
cd "$(dirname "$0")/.."

CONTA_ORIGEM="CGB-ENERGIA"
CONTA_PESSOAL="marcusvqueiros-hue"
REPO_PESSOAL="https://github.com/marcusvqueiros-hue/Gestao-Acidente.git"
SENSIVEIS=(".env" "scripts/base.xlsx" "scripts/seed.json")

git diff --quiet && git diff --cached --quiet || { echo "Há alterações sem commit. Faça o commit antes."; exit 1; }

gh auth switch -u "$CONTA_ORIGEM" >/dev/null
git push origin main

gh auth switch -u "$CONTA_PESSOAL" >/dev/null
trap 'gh auth switch -u "$CONTA_ORIGEM" >/dev/null' EXIT
git remote get-url pessoal >/dev/null 2>&1 || git remote add pessoal "$REPO_PESSOAL"
git fetch -q pessoal main

idx="$(mktemp)"
GIT_INDEX_FILE="$idx" git read-tree HEAD
GIT_INDEX_FILE="$idx" git rm -q --cached --ignore-unmatch "${SENSIVEIS[@]}"
arvore="$(GIT_INDEX_FILE="$idx" git write-tree)"
rm -f "$idx"

if [ "$arvore" = "$(git rev-parse 'pessoal/main^{tree}')" ]; then
  echo "Repositório pessoal já está atualizado."
  exit 0
fi
msg="$(git log -1 --format=%B HEAD)"
novo="$(git commit-tree "$arvore" -p pessoal/main -m "$msg")"
git push pessoal "$novo:refs/heads/main"
echo "Publicado nos dois repositórios."
