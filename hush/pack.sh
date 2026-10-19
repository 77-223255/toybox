#!/usr/bin/env bash
# Hush — 本地打包（固定扩展 ID）
#
# 用法：./pack.sh
#   1) 用签名私钥打包 src/ 成 hush.crx（扩展 ID 保持不变）
#      私钥不入库：从 $HUSH_KEY 或 ~/.local/share/hush/hush.pem 读取
#   2) 校验扩展 ID == mdldpbdafiofeclcekinhcjgfhcnelcg
#   3) 顺带生成 hush.zip（“加载已解压”备用）
set -euo pipefail
cd "$(dirname "$0")"

SRC="src"
EXPECTED_ID="mdldpbdafiofeclcekinhcjgfhcnelcg"
# 签名私钥不入库：公开仓库里泄露 = 别人能用同一扩展 ID 签名。
# 查找顺序：$HUSH_KEY → ./keys/hush.pem → ~/.local/share/hush/hush.pem
KEY=""
for cand in "${HUSH_KEY:-}" "keys/hush.pem" "$HOME/.local/share/hush/hush.pem"; do
  if [ -n "$cand" ] && [ -f "$cand" ]; then KEY="$cand"; break; fi
done
case "$KEY" in
  "") echo "缺少签名私钥。设置 HUSH_KEY=/path/to/hush.pem，或放到 ~/.local/share/hush/hush.pem" >&2; exit 1 ;;
  /*) KEY_ABS="$KEY" ;;
  *)  KEY_ABS="$PWD/$KEY" ;;
esac
PROFILE="/tmp/cr-pack-profile"

CHROME="$(command -v chromium || command -v chromium-browser || command -v google-chrome || true)"
[ -n "$CHROME" ] || { echo "找不到 chromium / chromium-browser / google-chrome" >&2; exit 1; }
[ -f "$KEY_ABS" ] || { echo "缺少签名私钥 $KEY_ABS" >&2; exit 1; }
[ -d "$SRC" ] || { echo "缺少源码目录 $SRC" >&2; exit 1; }

rm -f src.crx hush.crx hush.zip

# 独立的 user-data-dir：避免被正在运行的 chromium 实例转发而静默不做事
"$CHROME" --user-data-dir="$PROFILE" --no-first-run --no-default-browser-check \
  --pack-extension="$PWD/$SRC" --pack-extension-key="$KEY_ABS" >/dev/null 2>&1 || true

[ -f src.crx ] || { echo "打包失败：没有生成 src.crx" >&2; exit 1; }
mv -f src.crx hush.crx

# 由公钥 DER 推导扩展 ID，核对是否还是老 ID
ID="$(python3 - "$KEY_ABS" <<'PY'
import hashlib, subprocess, sys
der = subprocess.check_output(
    ["openssl", "rsa", "-in", sys.argv[1], "-pubout", "-outform", "DER"],
    stderr=subprocess.DEVNULL,
)
h = hashlib.sha256(der).hexdigest()[:32]
print("".join(chr(ord("a") + int(c, 16)) for c in h))
PY
)"
if [ "$ID" != "$EXPECTED_ID" ]; then
  echo "扩展 ID 不匹配：$ID（应为 $EXPECTED_ID）" >&2
  exit 1
fi
echo "扩展 ID OK: $ID"

if command -v zip >/dev/null 2>&1; then
  (cd "$SRC" && zip -qr ../hush.zip .)
else
  echo "（未安装 zip，跳过 hush.zip）"
fi

echo "生成："
ls -la hush.crx 2>/dev/null || true
ls -la hush.zip 2>/dev/null || true
