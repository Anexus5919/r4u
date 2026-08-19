#!/usr/bin/env bash
#
# Fails the build on any violation of the R4U design ban list.
# The rules and their reasons live in docs/DESIGN-SYSTEM.md section 2.
#
# Escape hatch: put "design-guard-allow" in a comment on the offending line. Use it rarely and
# say why in the same comment.

set -uo pipefail

# byte-oriented matching, so multi-byte patterns are predictable across platforms
export LC_ALL=C

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SCAN=()
for d in client/src server/src shared/src; do
  [ -d "$d" ] && SCAN+=("$d")
done

if [ ${#SCAN[@]} -eq 0 ]; then
  echo "design-guard: nothing to scan yet"
  exit 0
fi

FAILURES=0

# $1 label, $2 extended regex, $3 optional extra grep args
check() {
  local label="$1" pattern="$2"
  shift 2
  local hits
  hits="$(grep -rEn --binary-files=without-match "$pattern" "${SCAN[@]}" "$@" 2>/dev/null \
    | grep -v 'design-guard-allow' || true)"
  if [ -n "$hits" ]; then
    echo ""
    echo "  FAIL  $label"
    echo "$hits" | sed 's/^/        /'
    FAILURES=$((FAILURES + 1))
  fi
}

echo "design-guard: scanning ${SCAN[*]}"

# ---------------------------------------------------------------- colour

check "AI-purple family. The single loudest tell in the catalogue." \
  '(indigo|violet|purple|fuchsia)-[0-9]{2,3}|#6366f1|#7c3aed|#8b5cf6|#a855f7|#6d28d9'

check "Gradient. R4U has no gradients anywhere." \
  'bg-gradient-to-|from-[a-z]+-[0-9]{2,3}|linear-gradient|radial-gradient|bg-clip-text'

check "Foreign grey ramp. R4U uses ink-* exclusively." \
  '\b(slate|zinc|gray|grey|neutral|stone)-(50|[0-9]{3})\b'

# Matches 6 and 8 digit colours, and 3 digit colours only when they contain a letter.
# Lengths of 4, 5 and 7 are excluded so an issue reference such as #1325 or #2659 is not a hit.
check "Hex literal outside tokens.css." \
  '#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?\b|#[a-fA-F][0-9a-fA-F]{2}\b|#[0-9a-fA-F][a-fA-F][0-9a-fA-F]\b|#[0-9a-fA-F]{2}[a-fA-F]\b' \
  --include='*.ts' --include='*.tsx' --include='*.css' --exclude='tokens.css'

# ---------------------------------------------------------------- geometry

check "Banned radius. Only rounded-xs (2px) and rounded-sm (6px) exist." \
  'rounded-(full|md|lg|xl|2xl|3xl)\b'

check "Neon or offset-zero glow shadow." \
  'shadow-\[0_0'

# ---------------------------------------------------------------- motion

check "Scale on hover or tap." \
  'hover:scale-|whileHover=\{\{[^}]*scale|whileTap=\{\{[^}]*scale'

check "Attention-seeking animation on static data." \
  'animate-(pulse|bounce|ping|spin)\b'

check "Spring, bounce or elastic easing. R4U uses one ease-out curve." \
  "type:\s*'spring'|ease-in-out-back|cubic-bezier\([^)]*1\.[0-9]"

check "Animating a layout property. Only transform and opacity may animate." \
  'transition-\[?(width|height|padding|margin|top|left|right|bottom)'

check "Scroll-reveal library markup." \
  'data-aos|AOS\.init'

# ---------------------------------------------------------------- type and content

# U+1F000-U+1FFFF all begin F0 9F. The two E2 sequences cover the common BMP marks
# (check, sparkle, warning, bolt, star) that get reached for as pseudo-icons.
check "Emoji in source. The fallback for a missing glyph is a word, never an emoji." \
  $'\xf0\x9f|\xe2\x9c|\xe2\x9a|\xe2\xad'

check "Em dash. Use commas, colons, parentheses, or restructure." \
  $'—'

check "Banned marketing copy." \
  '(Supercharge|Unleash|Effortlessly|seamlessly|reimagined|world-class|enterprise-grade)'

check "Placeholder content. Every screen ships real content." \
  '(Lorem ipsum|lorem ipsum|Feature One|placeholder\.com|via\.placeholder)'

# ---------------------------------------------------------------- attribution

check "Tool or assistant attribution. Strictly prohibited in this repository." \
  '(Co-Authored-By|Generated with|Claude|Anthropic|Copilot|ChatGPT)'

# ----------------------------------------------------------------

echo ""
if [ "$FAILURES" -gt 0 ]; then
  echo "design-guard: $FAILURES rule(s) violated. See docs/DESIGN-SYSTEM.md section 2."
  exit 1
fi

echo "design-guard: clean"
