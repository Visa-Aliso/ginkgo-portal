# Profile 配置

编辑根目录 `config/profile.config`。这是标准 JSON，不是 TypeScript；字段名和字符串使用双引号，不支持注释和尾逗号。开发时保存自动重载；发布前执行 `npm run verify`。

## 基本资料

`name`、`title`、`affiliation`、`bio` 分别是姓名、身份描述、机构和简介。`bio` 支持本站的 Markdown 子集；换段写 `\n\n`。默认姓名为 Ginkgo，各栏目均为脱敏示例。

`avatar` 为空时显示姓名首字母。图片放在 `public/profile/avatar.jpg`，配置写 `./profile/avatar.jpg`。图片加载失败时保留首字母。

`links` 默认为空数组，可加入：

```json
{ "name": "Email", "url": "mailto:hello@example.com", "icon": "mail" }
```

链接支持 HTTP(S)、相对路径和 mailto。图标支持 `github`、`book-open`、`mail`、`globe`、`file-text`。

## 栏目记录

各栏目 `id` 保留为 `education`、`publications`、`opensource`、`awards`、`projects`。`title` 与 `english` 是标题，`visible: false` 隐藏栏目，`initialShow` 指定首次显示条数，超出部分可展开／收起。空数组显示 `empty` 配置的文字。打印时显示全部条目。

下列是放入各栏目 `items` 数组的对象示例，可按需删掉可选字段：

教育经历：

```json
{ "years": "20XX — 20XX", "school": "学校名称", "schoolUrl": "https://example.org", "dept": "院系", "degree": "学位", "logo": "./profile/institute.png" }
```

论文：

```json
{ "title": "论文标题", "authors": "作者甲，**Ginkgo**，作者乙", "venue": "会议或期刊", "type": "Conference", "links": [{ "name": "Paper", "url": "https://example.org/paper" }], "award": "可选的论文奖项" }
```

开源：

```json
{ "title": "项目名称", "organization": "开源社区", "year": "20XX", "description": "项目说明", "url": "https://example.org/project" }
```

奖项：

```json
{ "title": "奖项名称", "organization": "颁奖机构", "year": "20XX", "description": "可选说明" }
```

项目：

```json
{ "title": "项目名称", "description": "项目说明", "url": "https://example.org/project" }
```

## 外观与交互

`leaves` 覆盖此页叶片数量和尺寸，`leavesPaused: true` 让每次打开时默认暂停。单击吹风，长按恢复／暂停；暂停时显示“Ⅱ”标记，不修改其他页面的落叶偏好。主题在三页共享。

左上角站点字标取自 `site.config` 的 `name`，资料姓名取自本文件的 `name`。斜杠后的“关于我”不可点击。单栏网页自然延展，打印使用 A4 版式，隐藏导航与动效，内容较长时自然分页。
