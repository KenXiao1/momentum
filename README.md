[EN README](./README_EN.md)

# Momentum - 心理学驱动的专注力应用

开发与验证流程见 [CONTRIBUTING.md](CONTRIBUTING.md)，架构和领域说明见 [文档索引](docs/README.md)。

基于链式时延协议（CTDP）理论的自控力训练工具，通过"神圣座位原理"、"下必为例原理"和"线性时延原理"帮助用户建立强大的习惯链条。支持 Web（PWA）和 Tauri v2 桌面端（Windows/macOS/Linux）；移动端（iOS/Android）适配进行中。

详情请见：https://www.zhihu.com/question/19888447/answer/1930799480401293785

<img width="3000" height="1130" alt="image" src="https://github.com/user-attachments/assets/8765b5c0-4f7a-4d69-a826-d7a6bcef853f" />

你也可以在知乎上阅读此README：https://zhuanlan.zhihu.com/p/1932530006774505748

## ✨ 功能亮点

| 功能             | 描述                                   |
| ---------------- | -------------------------------------- |
| 🔗 链式任务管理  | 基于CTDP理论的习惯链条系统             |
| 📦 任务组/嵌套链 | 支持将多个任务组合成任务组，循环执行   |
| 🏛️ RSIP 国策系统 | 递归稳态迭代协议，建立个人生活规则体系 |
| 🐾 虚拟宠物系统  | 完成任务获得奖励，培养专属宠物         |
| 🎰 押注模式      | 可选的激励机制，为任务增加额外动力     |
| ⏱️ 正向计时器    | 支持无时长限制的任务                   |
| 🗑️ 回收站        | 软删除机制，可恢复误删的链条           |
| 📤 导入/导出     | 完整的数据备份与迁移支持               |
| ☁️ 云同步        | 支持 Supabase 多设备同步               |
| 🎨 玻璃拟态UI    | 现代化的毛玻璃界面设计                 |

## 🔀 Tauri 存储模式（v0.3.2）

- `tauri-desktop` / `tauri-mobile` 首次启动默认进入 **本地模式**。
- 当检测到 Supabase 配置时，会出现一次非阻塞提示卡，可选“继续本地模式”或“连接云端同步”。
- 设置页可随时在 **本地模式** 和 **云端模式** 间切换。
- 切换仅更换数据源，不做自动导入、导出或合并。
- 虚拟宠物数据在两种模式下都只保存在本机，不参与多端同步。

## 🎯 核心理念

Momentum基于Edmond在知乎上提出的链式时延协议（Chained Time-Delay Protocol, CTDP）理论，通过数学模型解决自制力问题：

$$I = \int_{0}^{\infty} V(\tau) \cdot W(\tau) d\tau$$

其中：

- `V(τ)` 是未来价值函数
- `W(τ)` 是权重贴现函数

<img width="931" height="676" alt="image" src="https://github.com/user-attachments/assets/138e50b6-4421-40bb-a214-017c588d832e" />

## 🔬 三大核心原理

### 1. 神圣座位原理

通过指定特定的触发动作（如"戴上降噪耳机"、"坐到书房书桌前"），创建一个"神圣座位"。一旦触发这个动作，就必须以最好的状态完成专注任务。每次成功完成任务，链条记录增长（#1 → #2 → #3...），形成强大的心理约束力。
<img width="1232" height="568" alt="image" src="https://github.com/user-attachments/assets/78cb2b9b-1eb1-4c0a-80d1-6a9500a3f4ab" />
<img width="1442" height="1652" alt="image" src="https://github.com/user-attachments/assets/4c68a170-31c8-4404-a3ea-a670a7090f2e" />
<img width="1178" height="1627" alt="image" src="https://github.com/user-attachments/assets/7b4593db-1c3e-414d-b0ea-24f55755cb56" />

### 2. 下必为例原理

当面临疑似违规行为时，只能选择：

- **判定失败**：链条清零，从#1重新开始
- **判定允许**：该行为永久加入例外规则，未来必须一律允许

这种"判例法"机制防止破窗效应，让规则边界收敛到最理性的状态。
<img width="2880" height="1370" alt="image" src="https://github.com/user-attachments/assets/f360fc69-0f33-4aab-bb1a-d5092d3f6133" />
<img width="1971" height="1551" alt="image" src="https://github.com/user-attachments/assets/692dda50-8265-4f56-97bd-11de5818ddcb" />

### 3. 线性时延原理

通过"预约链"解决启动困难：

- 设定预约信号（如"打响指"）
- 预约后必须在指定时间内开始主任务
- 利用时间延迟降低启动阻力<img width="911" height="890" alt="image" src="https://github.com/user-attachments/assets/247aec14-ec69-4fc7-aa14-112632814ca8" />

## 直接使用

https://momentumctdp.netlify.app/
<img width="1806" height="1218" alt="image" src="https://github.com/user-attachments/assets/6dcd2b1b-3cc8-4cc1-8e8c-57a2f97b1878" />

## 📖 使用指南

### 创建第一条链

1. 点击"创建第一条链"或"新建链"
2. 设置链名称（如"学习Python"）
3. 选择神圣座位触发动作（如"戴上降噪耳机"）
4. 设定任务时长
5. 配置预约链设置：
   - 预约信号（如"打响指"）
   - 预约时长（如15分钟）
   - 预约完成条件（通常与主链触发器相同）

### 使用预约功能

1. 在任务卡片上点击"预约"
2. 执行预约信号（如打响指）
3. 在预约时间内完成预约条件
4. 自动进入专注模式

### 直接开始任务

1. 点击"开始任务"
2. 执行神圣座位触发动作
3. 进入全屏专注模式

<img width="3181" height="1792" alt="image" src="https://github.com/user-attachments/assets/b2251bab-9876-4efa-a94f-4d6a6b8a8f2d" />

4. 专注完成设定时长

### 处理中断情况

当需要中断任务时：

1. 点击"中断/规则判定"
2. 描述具体行为
3. 选择处理方式：
   - **判定失败**：链条清零
   - **判定允许**：加入例外规则
     <img width="1107" height="1249" alt="image" src="https://github.com/user-attachments/assets/c4dee7e4-9448-47e0-9a95-9bd78de94ad5" />

### 管理卡片

<img width="1696" height="1632" alt="image" src="https://github.com/user-attachments/assets/058cb3a0-0eed-41a4-9413-f41fa8b849a7" />

## 📦 任务组功能

任务组允许你将多个相关任务组合在一起，按顺序循环执行。

### 创建任务组

1. 点击"新建任务组"
2. 设置任务组名称和描述
3. 配置时间限制（可选）
4. 设置重复次数
5. 添加子任务单元

### 任务组特性

- **循环执行**：子任务按顺序执行，完成后自动进入下一个
- **时间限制**：可设置整组的总时间限制
- **重复控制**：每个子任务可设置独立的重复次数
- **进度追踪**：实时显示当前进度和剩余任务

## 🏛️ RSIP 国策系统

递归稳态迭代协议（Recursive Steady-state Iteration Protocol）是一套个人规则管理系统，帮助你建立和维护生活中的各种规则。

### 核心概念

- **国策节点**：代表一条生活规则或习惯
- **层级结构**：规则可以有父子关系，形成规则树
- **每日限制**：默认每天只能添加一条新规则，避免过度承诺
- **违规回滚**：违反规则时，该节点及其所有子节点将被删除

### 使用方式

1. 进入 RSIP 视图
2. 创建根节点或子节点
3. 设置规则标题和描述
4. 可选配置计时器
5. 日常遵守规则，建立稳定的生活秩序

## 🐾 虚拟宠物系统

完成任务可以获得奖励，培养你的专属虚拟宠物。

### 宠物成长阶段

1. 🥚 蛋 (Lv.1-9)
2. 🐣 幼崽 (Lv.10-24)
3. 🐥 幼年 (Lv.25-49)
4. 🐤 少年 (Lv.50-74)
5. 🐔 成年 (Lv.75-99)
6. 🦅 长者 (Lv.100)

### 宠物属性

- **饥饿度**：随时间增加，需要喂食降低
- **快乐度**：随时间降低，完成任务可提升
- **健康度**：受饥饿和快乐影响
- **经验值**：完成任务获得，升级后进化

## 🎰 押注模式（可选）

为任务增加额外的激励机制。

- 任务开始前可以押注积分
- 成功完成任务获得奖励
- 设有每日押注上限
- 仅在 Supabase 云同步模式下可用

## 🗑️ 回收站

误删的链条可以恢复。

- 删除的链条移入回收站
- 可随时恢复或永久删除
- 自动清理过期项目

## 📤 导入/导出

完整的数据管理功能。

- 导出所有链条、历史记录、RSIP 节点、例外规则
- 支持增量合并导入
- 智能处理 ID 冲突
- 支持本地和云端模式

## 🚀 本地使用

### 环境要求

- Node.js: see `.nvmrc` and `package.json` (`engines.node`)
- npm 或 yarn
- **桌面/移动端构建额外需要**：Rust 工具链（[rustup.rs](https://rustup.rs/)）
- 启用 Supabase 云端模式时需要配置：
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

### 安装步骤

1. **克隆项目**

```bash
git clone https://github.com/KenXiao1/momentum.git
cd momentum
```

2. **安装依赖**

```bash
npm install
```

3. **启动开发服务器（Web）**

```bash
npm run dev
```

4. **启动桌面应用（Tauri）**

```bash
npm run tauri dev
```

5. **构建生产版本**

```bash
# Web 版本
npm run build

# 桌面安装包（Windows/macOS/Linux）
npm run tauri build
```

## Sponsors

谢谢赞助者们的支持！我会继续努力哒 (≧▽≦)ゞ💖

- [旅行青呱](https://www.zhihu.com/people/mo-cun-dan-tui-ren)

![alt text](image.png)

## 📄 许可证

本项目采用 GPL-3.0-only license 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 已完成功能 ✅

- [x] **链式可嵌套工作单元（任务组）**
  - 支持将多个任务组合成任务组
  - 循环执行、时间限制、重复控制

- [ ] **开箱即用的预设**
  - 触发器模板和辅助信号模板
  - 中英文双语支持
  - 例外规则预设
  - still working

- [x] **RSIP 实现（递归稳态迭代协议）**
  - 完整的个人规则管理系统
  - 层级结构、每日限制、违规回滚

- [x] **虚拟宠物系统**
  - 6个成长阶段，100级成长系统
  - 饥饿度、快乐度、健康度属性
  - 任务完成奖励机制

- [x] **押注模式**
  - 可选的任务激励机制
  - 积分系统和每日限制

- [x] **回收站**
  - 软删除机制
  - 恢复和永久删除功能

- [x] **导入/导出**
  - 完整数据备份与迁移
  - 增量合并支持

## TO DO

- [x] **桌面端原生应用（Tauri v2）** — Windows/macOS/Linux
- [ ] **移动端原生应用（Tauri v2）** — iOS/Android（进行中）
- [ ] **更多宠物外观和动画**
- [ ] **社交功能（排行榜、好友系统）**
- [ ] **更详细的统计分析面板**

## 📞 联系方式

如有问题或建议，发送邮件至：xiaofucheng1@gmail.com
<br>
我的知乎账号：https://www.zhihu.com/people/blues-68-53
<br>
我的个人网站：https://kenxiao.netlify.app/
