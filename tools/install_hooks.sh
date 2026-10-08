#!/bin/sh
# Installs this repo's git hooks. .git/hooks is never tracked by git, so a
# fresh clone has none of this until it is run once:
#
#   Tools/install_hooks.sh

set -eu
root="$(cd "$(dirname "$0")/.." && pwd)"
hook="$root/.git/hooks/pre-commit"

cat > "$hook" <<'HOOK'
#!/bin/sh
# Installed by Tools/install_hooks.sh. Edit Tools/check_brand.sh, not this file.
exec "$(git rev-parse --show-toplevel)/Tools/check_brand.sh"
HOOK

chmod +x "$hook"
echo "installed: $hook"
