# avatar_generator

> 🧸 **old toy** —— 早年的小玩具，**不再维护**，留作存档。
> Archived toy. Not maintained.

基于 Python 的抽象头像生成器，通过递归矩形分割算法将画布划分为多个区域，并使用 matplotlib 色图着色输出。

## 核心功能

- **6 种分割算法**：random / average / complete_down / complete_line / mondrian / vertical_horizontal
- **100+ 色图**：支持 matplotlib 所有可用 colormap
- **GUI 预览**：基于 Tkinter 实时调整参数并预览
- **图片导出**：支持 PNG / JPG 等常见格式

## 分割算法说明

| 算法 | 说明 |
|------|------|
| `random` | 随机选取区域随机分割 |
| `average` | 均匀分割为近似等面积区域 |
| `complete_down` | 完全垂直分割 |
| `complete_line` | 完全水平分割 |
| `mondrian` | 类蒙德里安风格递归分割 |
| `vertical_horizontal` | 纵横交替分割 |

## 依赖

```
pip install pillow matplotlib
```

## 使用

```bash
python avatar_generator.py
```

在 GUI 中选择算法、分割次数、色图，点击生成后导出。

## 仓库贡献

- 这是存档项目，**不打算继续维护**。
- 若真要改动：保持单文件结构，Commit message 用英文 conventional 风格（`feat:` / `fix:` / `docs:`），与仓库历史一致。

