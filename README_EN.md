# Momentum - A Psychology-Driven Focus Application

For development and verification, see [CONTRIBUTING.md](CONTRIBUTING.md); see the [documentation index](docs/README.md) for architecture and domain behavior.

A self-control training tool based on the Chained Time-Delay Protocol (CTDP) theory, designed to help users build powerful habit chains through the "Sacred Seat Principle," the "Principle of Precedent," and the "Linear Time-Delay Principle."

For more details, please see: https://www.zhihu.com/question/19888447/answer/1930799480401293785

<img width="3000" height="1130" alt="image" src="https://github.com/user-attachments/assets/8765b5c0-4f7a-4d69-a826-d7a6bcef853f" />

You can also read this README on Zhihu: https://zhuanlan.zhihu.com/p/1932530006774505748

## ✨ Feature Highlights

| Feature                      | Description                                                       |
| ---------------------------- | ----------------------------------------------------------------- |
| 🔗 Chain Task Management     | Habit chain system based on CTDP theory                           |
| 📦 Task Groups/Nested Chains | Combine multiple tasks into groups with cyclic execution          |
| 🏛️ RSIP System               | Recursive Steady-state Iteration Protocol for personal life rules |
| 🐾 Virtual Pet System        | Earn rewards by completing tasks, raise your own pet              |
| 🎰 Betting Mode              | Optional incentive mechanism for extra motivation                 |
| ⏱️ Forward Timer             | Support for tasks without time limits                             |
| 🗑️ Recycle Bin               | Soft delete mechanism with recovery option                        |
| 📤 Import/Export             | Complete data backup and migration support                        |
| ☁️ Cloud Sync                | Multi-device sync via Supabase                                    |
| 🎨 Glassmorphism UI          | Modern frosted glass interface design                             |

## 🔀 Tauri Storage Modes (v0.3.2)

- `tauri-desktop` and `tauri-mobile` now default to **Local mode** on first launch.
- If Supabase is configured, users see a one-time non-blocking prompt: keep local mode or connect cloud sync.
- Users can switch between **Local mode** and **Cloud mode** at any time in settings.
- Mode switching only changes the data source; there is no automatic import/export/merge.
- Virtual pet data remains device-local in both modes and is not synced cross-device.

## 🎯 Core Concept

Momentum is based on the Chained Time-Delay Protocol (CTDP) theory proposed by Edmond on Zhihu, which uses a mathematical model to solve self-control problems:

$$I = \int_{0}^{\infty} V(\tau) \cdot W(\tau) d\tau$$

Where:

- `V(τ)` is the future value function
- `W(τ)` is the weight discount function

<img width="931" height="676" alt="image" src="https://github.com/user-attachments/assets/138e50b6-4421-40bb-a214-017c588d832e" />

## 🔬 The Three Core Principles

### 1. Sacred Seat Principle

By designating a specific trigger action (e.g., "put on noise-canceling headphones," "sit down at the study desk"), you create a "sacred seat." Once this action is triggered, you must complete the focus task in your best possible state. Each time you successfully complete the task, the chain record grows (#1 → #2 → #3...), forming a powerful psychological constraint.
<img width="1232" height="568" alt="image" src="https://github.com/user-attachments/assets/78cb2b9b-1eb1-4c0a-80d1-6a9500a3f4ab" />
<img width="1442" height="1652" alt="image" src="https://github.com/user-attachments/assets/4c68a170-31c8-4404-a3ea-a670a7090f2e" />
<img width="1178" height="1627" alt="image" src="https://github.com/user-attachments/assets/7b4593db-1c3e-414d-b0ea-24f55755cb56" />

### 2. Principle of Precedent

When faced with a potential rule violation, you have only two choices:

- **Rule as Failure**: The chain is reset to zero and you start over from #1.
- **Rule as Permitted**: The behavior is permanently added to the exception rules and must be allowed in all future instances.

This "case law" mechanism prevents the broken windows effect, allowing the rule boundaries to converge to their most rational state.
<img width="2880" height="1370" alt="image" src="https://github.com/user-attachments/assets/f360fc69-0f33-4aab-bb1a-d5092d3f6133" />
<img width="1971" height="1551" alt="image" src="https://github.com/user-attachments/assets/692dda50-8265-4f56-97bd-11de5818ddcb" />

### 3. Linear Time-Delay Principle

This principle overcomes the difficulty of getting started by using a "pre-commitment chain":

- Set a pre-commitment signal (e.g., "snap your fingers").
- After giving the signal, you must start the main task within a specified time.
- This utilizes a time delay to lower the initial resistance to starting the task.
  <img width="911" height="890" alt="image" src="https://github.com/user-attachments/assets/247aec14-ec69-4fc7-aa14-112632814ca8" />

## Use It Directly

https://momentumctdp.netlify.app/
<img width="1806" height="1218" alt="image" src="https://github.com/user-attachments/assets/6dcd2b1b-3cc8-4cc1-8e8c-57a2f97b1878" />

## 📖 User Guide

### Create Your First Chain

1. Click "Create Your First Chain" or "New Chain."
2. Set a name for the chain (e.g., "Learn Python").
3. Choose a "Sacred Seat" trigger action (e.g., "Put on noise-canceling headphones").
4. Set the task duration.
5. Configure the pre-commitment chain settings:
   - Pre-commitment signal (e.g., "Snap fingers").
   - Pre-commitment duration (e.g., 15 minutes).
   - Pre-commitment completion condition (usually the same as the main chain's trigger).

### Using the Pre-commitment Feature

1. Click "Pre-commit" on the task card.
2. Perform the pre-commitment signal (e.g., snap your fingers).
3. Fulfill the pre-commitment condition within the specified time.
4. You will automatically enter focus mode.

### Starting a Task Directly

1. Click "Start Task."
2. Perform the "Sacred Seat" trigger action.
3. Enter the full-screen focus mode.

<img width="3181" height="1792" alt="image" src="https://github.com/user-attachments/assets/b2251bab-9876-4efa-a94f-4d6a6b8a8f2d" />

4. Stay focused for the set duration.

### Handling Interruptions

When you need to interrupt a task:

1. Click "Interrupt/Rule Adjudication."
2. Describe the specific behavior.
3. Choose how to handle it:
   - **Rule as Failure**: Resets the chain to zero.
   - **Rule as Permitted**: Adds the behavior to the exception rules.
     <img width="1107" height="1249" alt="image" src="https://github.com/user-attachments/assets/c4dee7e4-9448-47e0-9a95-9bd78de94ad5" />

### Managing Cards

<img width="1696" height="1632" alt="image" src="https://github.com/user-attachments/assets/058cb3a0-0eed-41a4-9413-f41fa8b849a7" />

## 📦 Task Groups

Task Groups allow you to combine multiple related tasks and execute them in sequence.

### Creating a Task Group

1. Click "New Task Group"
2. Set the group name and description
3. Configure time limits (optional)
4. Set repeat counts
5. Add child task units

### Task Group Features

- **Cyclic Execution**: Child tasks execute in order, automatically moving to the next upon completion
- **Time Limits**: Set a total time limit for the entire group
- **Repeat Control**: Each child task can have its own repeat count
- **Progress Tracking**: Real-time display of current progress and remaining tasks

## 🏛️ RSIP System

The Recursive Steady-state Iteration Protocol (RSIP) is a personal rule management system that helps you establish and maintain various life rules.

### Core Concepts

- **Policy Nodes**: Represent a life rule or habit
- **Hierarchical Structure**: Rules can have parent-child relationships, forming a rule tree
- **Daily Limits**: By default, only one new rule can be added per day to prevent over-commitment
- **Violation Rollback**: When a rule is violated, the node and all its children are deleted

### How to Use

1. Enter the RSIP view
2. Create root or child nodes
3. Set the rule title and description
4. Optionally configure a timer
5. Follow the rules daily to establish a stable life order

## 🐾 Virtual Pet System

Complete tasks to earn rewards and raise your exclusive virtual pet.

### Pet Growth Stages

1. 🥚 Egg (Lv.1-9)
2. 🐣 Baby (Lv.10-24)
3. 🐥 Child (Lv.25-49)
4. 🐤 Teen (Lv.50-74)
5. 🐔 Adult (Lv.75-99)
6. 🦅 Elder (Lv.100)

### Pet Attributes

- **Hunger**: Increases over time, needs feeding to reduce
- **Happiness**: Decreases over time, completing tasks increases it
- **Health**: Affected by hunger and happiness
- **Experience**: Earned by completing tasks, levels up and evolves

## 🎰 Betting Mode (Optional)

Add extra incentive mechanisms to your tasks.

- Place bets with points before starting a task
- Earn rewards upon successful completion
- Daily betting limits apply
- Only available in Supabase cloud sync mode

## 🗑️ Recycle Bin

Accidentally deleted chains can be recovered.

- Deleted chains are moved to the recycle bin
- Can be restored or permanently deleted at any time
- Automatic cleanup of expired items

## 📤 Import/Export

Complete data management functionality.

- Export all chains, history, RSIP nodes, and exception rules
- Support for incremental merge imports
- Smart ID conflict handling
- Works with both local and cloud modes

## 🚀 Use Locally

### Prerequisites

- Node.js: see `.nvmrc` and `package.json` (`engines.node`)
- npm or yarn
- To enable Supabase cloud mode, configure:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

### Installation Steps

1.  **Clone the project**

```bash
git clone https://github.com/KenXiao1/momentum.git
cd momentum
```

2.  **Install dependencies**

```bash
npm install
```

3.  **Start the development server**

```bash
npm run dev
```

4.  **Build for production**

```bash
npm run build
```

5.  **Preview the production build**

```bash
npm run preview
```

## Sponsors

Big love to our sponsors for making continued maintenance possible (๑>◡<๑)ﾉ ❤️

- [旅行青呱](https://www.zhihu.com/people/mo-cun-dan-tui-ren)

![alt text](image.png)

## 📄 License

This project is licensed under the GPL-3.0-only license - see the [LICENSE](LICENSE) file for details.

## Completed Features ✅

- [x] **Chainable Nested Work Units (Task Groups)**
  - Combine multiple tasks into task groups
  - Cyclic execution, time limits, repeat control

- [ ] **Out-of-the-box Presets**
  - Trigger templates and auxiliary signal templates
  - Bilingual support (Chinese/English)
  - Exception rule presets
  - still working

- [x] **RSIP Implementation (Recursive Steady-state Iteration Protocol)**
  - Complete personal rule management system
  - Hierarchical structure, daily limits, violation rollback

- [x] **Virtual Pet System**
  - 6 growth stages, 100-level progression system
  - Hunger, happiness, and health attributes
  - Task completion reward mechanism

- [x] **Betting Mode**
  - Optional task incentive mechanism
  - Points system with daily limits

- [x] **Recycle Bin**
  - Soft delete mechanism
  - Restore and permanent delete functionality

- [x] **Import/Export**
  - Complete data backup and migration
  - Incremental merge support

## TO DO

- [ ] **Mobile Optimization**
- [ ] **More Pet Appearances and Animations**
- [ ] **Social Features (Leaderboards, Friends System)**
- [ ] **More Detailed Statistics Dashboard**

## 📞 Contact

If you have any questions or suggestions, please send an email to: xiaofucheng1@gmail.com
<br>
My Zhihu Account: https://www.zhihu.com/people/blues-68-53
<br>
My personal website: https://kenxiao.netlify.app/
