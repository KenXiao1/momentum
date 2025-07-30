[EN README](./README_EN.md)
# Momentum - 心理学驱动的专注力应用

基于链式时延协议（CTDP）理论的自控力训练工具，通过"神圣座位原理"、"下必为例原理"和"线性时延原理"帮助用户建立强大的习惯链条。
详情请见：
https://www.zhihu.com/question/19888447/answer/1930799480401293785
<br>
<img width="3000" height="1130" alt="image" src="https://github.com/user-attachments/assets/8765b5c0-4f7a-4d69-a826-d7a6bcef853f" />
你也可以在知乎上阅读此README：https://zhuanlan.zhihu.com/p/1932530006774505748

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

## 🚀 本地使用


### 环境要求
- Node.js 18+ 
- npm 或 yarn

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

3. **启动开发服务器**
```bash
npm run dev
```

4. **构建生产版本**
```bash
npm run build
```

5. **预览生产版本**
```bash
npm run preview
```

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## TO DO

- [ ] **增加链式可嵌套工作单元**
  *示意图：*
  <img width="600" alt="嵌套单元示例1" src="https://github.com/user-attachments/assets/39522b04-f284-449b-80d5-21434862f3ee" />
  <img width="600" alt="嵌套单元示例2" src="https://github.com/user-attachments/assets/f54b2816-9869-46bf-8714-bdaee0c6423e" />

- [ ] **增加开箱即用的预设**
  - 如：考试周专用等

- [ ] **防止日常摆烂的改进版本（递归稳态迭代协议, RSIP）实现**
  *示意图：*
  <img width="700" alt="RSIP 设计图" src="https://github.com/user-attachments/assets/29b5274a-e207-476a-ba31-e45affb73bb6" />


## 📞 联系方式

如有问题或建议，发送邮件至：kenx@andrew.cmu.edu
<br>
我的知乎账号：https://www.zhihu.com/people/blues-68-53
