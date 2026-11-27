# Chain tags 链条标签

链条的分类由用户自定义的标签承担。一条链可以有多个标签，每个标签有名称和颜色；
界面上标签总会显示名称，颜色只是辅助区分。

## 结构类型与标签

`chain.type` 现在只区分结构：

| 值      | 含义           |
| ------- | -------------- |
| `unit`  | 单条链         |
| `group` | 任务组（容器） |

早期版本还有 6 种"兵种"类型（`assault`、`recon`、`command`、`special_ops`、
`engineering`、`quartermaster`）。这些值仍保存在旧链条的 `type` 里，数据库约束和导入
也继续接受，但界面不再按它们区分，而是把它们迁移成默认标签。

## 默认标签与迁移

| 旧类型          | 默认标签 | 颜色 | 标签 id                |
| --------------- | -------- | ---- | ---------------------- |
| `assault`       | 突击单元 | 红   | `legacy:assault`       |
| `recon`         | 侦查单元 | 绿   | `legacy:recon`         |
| `command`       | 指挥单元 | 紫   | `legacy:command`       |
| `special_ops`   | 特勤单元 | 黄   | `legacy:special_ops`   |
| `engineering`   | 工程单元 | 橙   | `legacy:engineering`   |
| `quartermaster` | 炊事单元 | 粉   | `legacy:quartermaster` |

迁移不改写任何链条：

- 用户第一次修改标签之前，标签库就是这 6 个默认标签（名称取当前界面语言）；第一次
  修改时连同默认标签一起保存。
- 一条链在 `assignments` 里没有记录时，显示与其旧类型对应的默认标签；用户为它设置
  过标签后（包括清空），以记录为准。`unit` 是"未分类"，不对应任何标签。
- 默认标签的 id 在所有设备上一致，两台设备各自初始化也能对上。用户可以重命名、
  改色或删除它们；删除后，依赖它的旧链条不再显示该标签。

## 主页筛选

主页"你的任务链"上方的标签栏只列出至少一条链在用的标签，后面的数字是带该标签的链条数。

- 选中多个标签时，显示带其中**任意一个**标签的链条。
- 任务组里有一条链匹配，就显示整个任务组。
- 某个标签不再有链条使用时，它会自动退出筛选。
- 筛选只影响链条列表，不影响上方的推荐，也不会保存；刷新后回到"全部"。

## 存储与同步

标签库和分配关系是一个文档（`ChainTagSet`，见 `src/types/chainTag.ts`），由
`ChainTagStore` 端口整体读写：

- 本地模式：`localStorage` 的 `momentum_chain_tags`。
- 云端模式：每个用户一行 `chain_tag_sets`。保存时带上读取时的 `revision`，另一台设备
  改过后保存会失败并重新加载，避免覆盖。表尚未迁移时退回本地存储。
- 其他设备改了标签，切回前台的"数据已更新"提示同样会出现。

导出文件包含 `chainTags`。导入时按 id 或同名（不区分大小写）合并标签，分配关系改写
到导入后的新链条 id；重复执行导入不会产生重复。

## 代码位置

| 内容                               | 位置                                                        |
| ---------------------------------- | ----------------------------------------------------------- |
| 类型                               | `src/types/chainTag.ts`                                     |
| 纯函数（默认、显示、增删改、筛选） | `src/domain/chainTags.ts`                                   |
| 领域 Hook                          | `src/hooks/domains/useChainTagsDomain.ts`                   |
| 界面组件                           | `src/components/chain-tags/`                                |
| 云端存储                           | `src/infra/storage/supabase/chainTags.ts`                   |
| 迁移                               | `supabase/migrations/20261125000000_add_chain_tag_sets.sql` |
