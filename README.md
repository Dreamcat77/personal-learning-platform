# 个人知识点库

离线可打开的 HTML 学习笔记站：左侧分类切换，右侧本页目录跳转，支持「深挖 / 场景解析」与知识点互跳。

在线仓库：https://github.com/Dreamcat77/personal-learning-platform

---

## 怎么打开

直接用浏览器打开根目录的 `index.html` 即可（不需要构建）。

本地文件：

| 文件 | 作用 |
|------|------|
| `index.html` | 页面骨架 |
| `styles.css` | 样式 |
| `app.js` | 导航、目录、跳转逻辑 |
| `data.js` | **所有知识点内容（主要改这里）** |
| `assets/` | 图片等静态资源 |

---

## 怎么更新内容（给任意 AI / 协作者）

### 1. 新增一篇知识点

编辑 `data.js`，在 `window.KNOWLEDGE` 数组里追加一个对象：

```js
{
  id: "unique-id",              // 唯一，英文短横线，用于 URL #hash
  category: "分类名",           // 左侧分组，相同 category 会归在一起
  title: "标题",
  summary: "侧栏一行摘要",
  related: ["other-id"],        // 可选，文末「相关知识点」
  content: `
    <span class="article-tag">分类名</span>
    <h1>标题</h1>
    <p class="lead">导语</p>
    <h2 id="sec-1" data-toc="目录显示名">章节</h2>
    <p>...</p>
  `,
}
```

注意：

- `content` 是 HTML 字符串；代码里的 `<` `>` 写成 `&lt;` `&gt;`
- 章节用 `<h2 id="..." data-toc="...">`：右侧「本页目录」会自动生成；`data-toc` 是目录上显示的短名称
- 同一段对话的追问默认**合并进同一篇**，用「深挖」块区分，不要无故拆成很多篇

### 2. 深挖块（同一对话里的追问）

```html
<section class="dig">
  <div class="dig-head">
    <span class="dig-label">深挖</span>
    <p class="dig-ask"><strong>疑问方向：</strong>用一句话总结追问点</p>
  </div>
  <h2>小节标题</h2>
  <p>内容...</p>
</section>
```

### 3. 场景解析（独立分支 + 含义跳转）

场景案例的「我的回答 + 解析」做成**独立条目**，分类建议用 `场景解析`。

同时：

1. 若还没有对应「含义」文，先补一篇讲清概念（分类放在对应知识域，如 `高并发 / 架构`）
2. 在含义讲解处加跳转按钮：

```html
<p class="jump-row">
  <button class="jump-link" type="button" data-id="含义文章id">含义：xxx →</button>
  <button class="jump-link" type="button" data-id="场景文章id">场景解析：xxx →</button>
</p>
```

跳到某篇文章的某一节：

```html
<button class="jump-link" type="button" data-id="java-spring-annotations/ann-tx">...</button>
```

场景文顶部可用「你的回答要点」样式：

```html
<div class="case-answer">
  <p class="case-answer-title">你的回答要点</p>
  <p>...</p>
</div>
```

### 4. 图片

放到 `assets/`，在内容里引用：

```html
<figure>
  <img src="assets/xxx.png" alt="说明" />
  <figcaption>图注</figcaption>
</figure>
```

### 5. 改完自检

1. 浏览器强制刷新 `index.html`（避免缓存旧 `data.js`）
2. 左侧能看到新分类 / 新标题
3. 多章节文章右侧有目录，点击能滚动
4. `jump-link` / 相关知识点能跳转

---

## 分类约定（可增改）

当前常见分类：

- `Java / Spring`
- `认证与安全`
- `项目实战`
- `高并发 / 架构`
- `场景解析`

新内容优先归入已有分类；主题独立再开新分类。

---

## 同步到 GitHub

在项目目录执行：

```bash
git status
git add .
git commit -m "简述这次改了什么"
git push origin main
```

仓库地址：

```text
https://github.com/Dreamcat77/personal-learning-platform
```

若推送需要登录，使用 GitHub CLI 或 Personal Access Token（勾选 `repo`），**不要把 token 发到聊天里**。

```bash
gh auth login
git push origin main
```

---

## 给 AI 的简短指令模板

可以把下面这段直接发给协助你的 AI：

```text
这是我的个人知识点 HTML 站。请把下面内容整理进 data.js：
- 同一对话默认合并成一篇；追问用「深挖」块，并写清「疑问方向」
- 场景案例的回答解析做成「场景解析」独立条目，并在含义讲解处加 jump-link
- 若缺少对应含义文，请先补充含义文再互跳
- 章节加 h2 + id + data-toc，方便右侧目录
- 不要无故新建 markdown；内容进 data.js
- 改完后如需提交 git，等我明确说再 commit / push
```
