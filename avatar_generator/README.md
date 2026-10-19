# avatar_generator

> 🧸 **old toy** —— 早年的小玩具，**不再维护**，留作存档。
> Archived toy. Not maintained.

English: [`README.en.md`](./README.en.md)

基于 Python 的抽象头像生成器：递归地把画布切成矩形，每块从色图里取一个颜色。输出纹路接近抽象的现代画，适合当头像。

## 核心功能

- **5 种分割算法**：random / average / mondrian / complete_down / complete_line
- **3 种颜色模式**：`colormap`（取自色图）/ `random`（全随机 RGB）/ `grayscale`（随机灰阶）
- **matplotlib 全套色图**：可用的是 `plt.colormaps()` 去掉反向 `*_r`、`*_shifted` 变体，再硬排除 `flag` / `prism` / `Pastel1` / `Pastel2` / `Accent` 之后的全部
- **Tkinter GUI**：实时预览 + 参数调整
- **尺寸**：256 / 512 / 1024 / 2048
- **导出**：JPEG / PNG / WebP

## 分割算法

| 算法 | 说明 |
|------|------|
| `random` | 随机挑一块区域，随机横向或纵向切开——最"随手"的一种 |
| `average` | 均匀切成近似等面积的小块；配合「平均模式」可要求每块接近正方形 |
| `complete_down` | 完全垂直分割：所有切线都是竖的 |
| `complete_line` | 完全水平分割：所有切线都是横的 |
| `mondrian` | 类蒙德里安风格递归分割——大块套小块，比例偏向长条 |

「平均模式」（`rectangle` / `square`）只在选中 `average` 时出现，用来决定是否把区域修正成方形。

## 颜色模式

| 模式 | 说明 |
|------|------|
| `colormap` | 每块随机取色图上的一个位置，同一次生成的颜色彼此协调，效果最像"画" |
| `random` | 每块 RGB 全随机，杂乱但跳脱 |
| `grayscale` | 每块随机灰阶 |

代码里还支持传逗号分隔的多个色图名（`"viridis,plasma"`），每块随机挑一个用，不过 GUI 下拉框只给单选。

## 依赖

```bash
pip install pillow "matplotlib>=3.5,<3.9"
```

| 依赖 | 说明 |
|------|------|
| **Python 3** | 用了 f-string 与 Tkinter，3.8+ 应该都没问题（当年在 3.x 上写的，未在 3.13 验证） |
| **Pillow** | 画布与导出 |
| **matplotlib 3.5 – 3.8** | 上界是硬约束：代码调用 `matplotlib.cm.get_cmap`，该函数 **3.7 起弃用、3.9 被移除**；装 3.9+ 会直接 `AttributeError`。下界来自 `plt.colormaps()`（3.5 引入） |
| **Tkinter** | 标准库自带，但部分 Linux 发行版要单独装（Arch: `tk`，Debian: `python3-tk`） |

## 使用

```bash
python avatar_generator.py
```

在 GUI 里选分割算法 → 尺寸 → 颜色模式 → 色图 → 分割次数 → 点「实时预览」看效果 → 点「生成图像」按指定路径导出。

## 已知问题

存档代码，记下来免得下次踩：

1. **`vertical_horizontal` 算法并不存在** —— 旧版 README 写过第 6 种算法，但代码里没有实现，下拉框也只有 5 项。
2. **`border_size` 是死参数** —— `generate_avatar()` 签名里还留着，但绘制边框的那段代码已被注释掉，传任何值都没效果。
3. **matplotlib ≥ 3.9 会崩**，原因见上面的依赖表。
4. 预览固定输出一份 `preview_temp.jpg` 到工作目录，不会自己清理。

## 仓库贡献

- 这是存档项目，**不打算继续维护**；提 issue 可以，但不保证修。
- 若真要改动：保持单文件结构；改了算法或参数记得同步更新本文件和 `README.en.md`。
- Commit message 用英文 conventional 风格（`feat:` / `fix:` / `docs:`），与仓库历史一致。
- 想让它重新可用，最小改法是把 `cm.get_cmap(x)` 换成 `plt.get_cmap(x)` 或 `matplotlib.colormaps[x]`。

## License

MIT —— 见仓库根目录 [`LICENSE`](../LICENSE)。
