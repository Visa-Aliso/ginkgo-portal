# 配置指南

日常维护无需修改 TypeScript。配置都在根目录 `config/`，后缀为 `.config`，内部是标准 JSON：双引号、无注释、无尾逗号。保留文件里其他字段，只修改需要的值。

| 文件 | 修改内容 |
| --- | --- |
| `config/site.config` | 三页站点名、首页入口、默认主题、动画与全局银杏参数 |
| `config/profile.config` | 姓名、头像、简介、链接、五个履历栏目、页面落叶设置 |
| `config/notes.config` | 页面标题、副标题、列表说明、结束语、页面落叶密度 |
| `content/notes/*.md` | 随笔正文、日期、分类、摘要及单篇动画 |

开发模式保存配置会重新加载页面。执行 `npm run check:config` 可单独检查；错误信息会指出文件和字段，例如 `config/site.config.motion.softness`。发布时运行 `npm run verify`，部署整个 `dist/`。配置会在构建时编译为普通对象，访客不额外请求 `.config`，校验程序也不进入浏览器。修改源码目录中的配置后需要重新构建，不是在线管理后台。

## 站点与动画

`name` 是三页共用的字标，默认 Ginkgo，留空也使用 Ginkgo。`entries.blog/profile/notes` 各含 `label`、`caption`、`url`。URL 为空时只预览首页展开动画；相对路径支持子目录部署。

`defaultTheme` 可选 `light`、`dark`、`system`，访客已保存的选择优先。配置值也用于首帧，存储不可用时仍生效。

| 动画字段 | 默认 | 可填写范围 / 含义 |
| --- | --- | --- |
| `motion.responsiveMotion` | true | false 关闭纸张交互动效与页面过渡 |
| `motion.transitionSpeed` | 1 | 0.2–3；越小越慢，例如 0.8 |
| `motion.softness` | 1.1 | 0.1–5；越大越柔和 |
| `motion.breeze` | true | 纸张的轻微自然浮动 |

系统开启“减少动态效果”时优先减少动画。`leaves.enabled: false` 可彻底关闭银杏及吹风按钮。

## 银杏与资源占用

全局参数在 `site.config` 的 `leaves` 对象中。每页的 `leaves.desktopCount/mobileCount/size` 覆盖全局相应参数，其余参数沿用全局值。

| 字段 | 默认 | 含义 |
| --- | --- | --- |
| `desktopCount` / `mobileCount` | 40 / 26 | 首页目标数量；范围 0–120 |
| `mobileBreakpoint` | 600 | 移动端宽度分界，像素 |
| `maxFps` | 60 | 绘制帧率上限，15–60 |
| `maxPixelRatio` | 1.25 | Canvas 像素比上限，0.5–3；较小更省显存 |
| `pixelBudget` | 1048576 | 前景画布总像素预算，262144–4194304；越小越省内存、叶片越柔 |
| `size` | 1 | 叶片尺寸倍率，0.1–3 |
| `refillDelay` / `refillInterval` | 4 / 0.32 | 清场后补充延迟与相邻叶片间隔，秒 |
| `breezeSpeed` / `gustStrength` | 1 / 1 | 自然风与点击风力倍率，0–5 |
| `pointerRadius` / `clickRadius` | 90 / 225 | 鼠标与点击作用范围，像素 |

首次打开首页或 Notes 时统一逐片飘入，历史返回恢复原有叶片；减少动态效果模式直接显示静态叶片。Notes 默认 28 / 14 片；Profile 默认 20 / 10 片，且 `leavesPaused: true`，每次访问都从暂停开始，不修改其他页面的暂停偏好。三页统一单击吹风、长按恢复／暂停。

暂停并清空后、标签页隐藏时、离开页面时，释放 Canvas 像素缓冲和叶片贴图；保留少量位置数据，恢复时不重新撒一批叶子。窗口变化也保留落叶状态。运动时最高 60 帧，静止时停止逐帧刷新，用单个定时器等待下一阵风或补充。

前景默认最多 1,048,576 像素（`pixelBudget`），树影最多 262,144 像素且像素比不超过 0.5；高分屏仍受总像素预算约束。12 张贴图各 128×128，按 RGBA 计算，以上像素缓冲合计不超过约 5.75 MiB（不含浏览器合成缓存）。Profile 不分配树影画布。`maxPixelRatio` 可以进一步降低，但调高也不会绕过总像素预算。把 `pixelBudget` 调回 2097152 可换回更锐利的叶片，代价是约 4 MiB 像素缓冲和相应的合成层内存。

## Profile 和随笔

Profile 的字段和 JSON 示例见 [profile.md](profile.md)。栏目 `visible` 决定显示，`initialShow` 是首次显示条数（至少 1），`empty` 是该栏没有记录时的文字。请保留五个栏目各自的标准 `id`，不能重复。

Notes 的 `title` 控制浏览器标题，`subtitle` 是大标题下的说明，`collectionLabel` 是“全部”分类的列表说明，`footer` 是随笔集结束语。文章内容在 `content/notes/`，写作格式见 [README-CN.md](../README-CN.md#写一篇随笔)。
