# 银杏与风

[English](README.md) | 简体中文

一个独立的个人导航页。折叠文章摘页、名片与随笔纸页分别连接 Blog、Profile、Notes。保留白色 / 深色 / 跟随系统三种外观，以及可被鼠标和触碰吹开的银杏落叶。

## 本地运行

需要 Node.js 22.12 或以上版本。

```sh
npm install
npm run dev
```

打开终端显示的本地地址。生产构建与本地检查：

```sh
npm run check
npm run build
npm run preview
```

构建输出为 `dist/`，可以上传到静态网站托管或自己的服务器，也支持部署到子目录。页面不依赖服务器接口、账号或第三方字体服务。

## 配置

日常修改集中在 `src/config.ts`，参数带英文注释。名称和跳转地址默认留空：正常点击会完整预览展开动画，再返回入口。填入完整 `https://` 地址后，同一动画结束时会跳转。链接保留键盘访问、右键菜单和 Ctrl / Command 点击的原生行为。

| 配置                     | 默认值   | 含义                                 |
| ------------------------ | -------- | ------------------------------------ |
| `name`                   | 空       | 左上角名字，留空时隐藏               |
| `entries.*.url`          | 空       | 三个入口的独立站点地址               |
| `defaultTheme`           | `system` | 首次访问时的外观；访客选择会优先保存 |
| `leaves.desktopCount`    | 40       | 桌面目标叶子数量                     |
| `leaves.mobileCount`     | 26       | 手机目标叶子数量                     |
| `leaves.refillDelay`     | 4        | 吹散后开始补充的等待秒数             |
| `leaves.refillInterval`  | 0.32     | 相邻叶子重新飘入的间隔秒数           |
| `leaves.breezeSpeed`     | 1        | 自然风速倍率                         |
| `leaves.gustStrength`    | 1        | 点击风力倍率                         |
| `leaves.pointerRadius`   | 90       | 鼠标拨动叶子的影响范围，单位 px      |
| `leaves.clickRadius`     | 225      | 点击吹风范围，手机自动缩小           |
| `leaves.size`            | 1        | 叶子尺寸倍率                         |
| `leaves.maxFps`          | 45       | 叶子绘制频率上限                     |
| `motion.transitionSpeed` | 1        | 入口动画速度倍率，越大越快           |

颜色在 `src/styles.css` 中集中使用 CSS 变量：`--qp-*` 控制纸页与背景，`--leaf-*` 控制银杏。叶子形状、叶脉和阴影由 Canvas 绘制，无需额外图片。

## 交互与兼容性

- 鼠标经过会轻轻拨动叶子；点击叶子或空白处产生局部风；右上角风按钮清开整页。
- 点到覆盖在入口上的叶子会先吹走叶子，避免误跳转；露出的入口正常响应。
- 空白链接预览结束后回到原位；Escape 可以取消进入动画。
- 主题选择保存在浏览器本地；禁用本地存储时仍可使用。
- 页面不可见时暂停动画；系统开启减少动态效果时停止持续运动，吹风直接清除叶子。
- 手机独立限制叶子数量与绘制像素比，工具按钮提供 44px 触碰区域。

## 文件结构

- `src/config.ts`：日常配置与类型定义
- `src/main.ts`：内容与图标初始化
- `src/portal.ts`：主题、纸页弹簧手感、进入动画与跳转
- `src/leaves.ts`：银杏绘制、风力、补充与命中检测
- `src/styles.css`：页面材质、布局与明暗配色
