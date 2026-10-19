# avatar_generator

> 🧸 **old toy** — an early toy, **no longer maintained**, kept for the archive.

中文: [`README.md`](./README.md)

A Python abstract avatar generator: recursively split a canvas into rectangles and fill each one with a colour from a colormap. The output looks like an abstract modern painting — good enough to use as a profile picture.

## Features

- **5 splitting algorithms**: random / average / mondrian / complete_down / complete_line
- **3 colour modes**: `colormap` (sample a colormap as a whole) / `random` (fully random RGB) / `grayscale` (random greys)
- **Every matplotlib colormap**: whatever `plt.colormaps()` returns, minus the reversed `*_r` and `*_shifted` variants and five hard-excluded ones (`flag`, `prism`, `Pastel1`, `Pastel2`, `Accent`)
- **Tkinter GUI** with live preview and parameter controls
- **Sizes**: 256 / 512 / 1024 / 2048
- **Export**: JPEG / PNG / WebP

## Splitting algorithms

| Algorithm | Behaviour |
|------|------|
| `random` | Pick a random region, cut it randomly horizontally or vertically — the loosest of the five |
| `average` | Split into roughly equal-area regions; the "average mode" option can force each region towards a square |
| `complete_down` | All cuts are vertical |
| `complete_line` | All cuts are horizontal |
| `mondrian` | Mondrian-ish recursive splitting: large blocks containing small blocks, with a bias towards elongated proportions |

"Average mode" (`rectangle` / `square`) only appears when `average` is selected — it decides whether regions get corrected towards squares.

## Colour modes

| Mode | Behaviour |
|------|------|
| `colormap` | Each block samples a random position on the colormap, so one image stays colour-harmonised — visually the closest to a painting |
| `random` | Fully random RGB per block — noisy but lively |
| `grayscale` | Random greys per block |

The code also accepts a comma-separated list of colormap names (`"viridis,plasma"`), picking one at random per block — but the GUI dropdown only offers a single choice.

## Dependencies

```bash
pip install pillow "matplotlib>=3.5,<3.9"
```

| Dependency | Notes |
|------|------|
| **Python 3** | Uses f-strings and Tkinter; anything 3.8+ should work (written on a 3.x of that era, never verified on 3.13) |
| **Pillow** | Canvas and export |
| **matplotlib 3.5 – 3.8** | The upper bound is hard: the code calls `matplotlib.cm.get_cmap`, deprecated in 3.7 and **removed in 3.9** — on 3.9+ it raises `AttributeError`. The lower bound comes from `plt.colormaps()`, introduced in 3.5 |
| **Tkinter** | Part of the standard library, but some Linux distros package it separately (Arch: `tk`, Debian: `python3-tk`) |

## Usage

```bash
python avatar_generator.py
```

In the GUI: pick an algorithm → size → colour mode → colormap → split count → hit "实时预览" (live preview) for a quick look → hit "生成图像" (generate) and choose an output path.

The UI labels are in Chinese, so the two buttons above are worth recognising.

## Known issues

Archived code — noting these so nobody rediscovers them the hard way:

1. **`vertical_horizontal` does not exist.** An older version of the README advertised a sixth algorithm; it was never implemented and the dropdown has only five entries.
2. **`border_size` is a dead parameter.** It is still in the `generate_avatar()` signature, but the border-drawing block is commented out, so any value is ignored.
3. **matplotlib ≥ 3.9 crashes**, for the reason in the dependency table.
4. The preview always writes a `preview_temp.jpg` into the working directory and never cleans it up.

## Contributing

- Archived project — **not maintained**. Issues are welcome but there is no guarantee of a fix.
- If you do touch it: keep the single-file structure, and update both this file and `README.md` when you change an algorithm or a parameter.
- Use English conventional commit messages (`feat:` / `fix:` / `docs:`), matching repo history.
- To make it run again, the minimal fix is replacing `cm.get_cmap(x)` with `plt.get_cmap(x)` or `matplotlib.colormaps[x]`.

## License

Not declared.
