你是一名资深前端架构师和全栈工程师，擅长用 Vite + React + TypeScript + PWA 构建面向移动端的 Web 应用，也熟悉 Web Bluetooth / Web Audio / IndexedDB / LLM API 集成。

我需要你帮我从零设计并实现一个“类 App”的手机健康应用（PWA），用网页技术实现，但体验尽量接近原生 App。

这个应用的核心目标：
	•	连接支持心率数据的蓝牙耳机/心率设备；
	•	在手机端实时计算并显示 HRV（RMSSD、SDNN、pNN50）；
	•	基于 HRV 数据，用一个“AI 节拍模型”（可以先用规则 + 模拟数据）生成节拍训练方案，并在手机上播放节拍；
	•	在本地记录用户的历史数据（Session 记录），支持离线查看；
	•	接入大语言模型，为老年用户提供“AI 健康顾问”，根据 HRV 趋势给出温和、可执行的生活建议（非医疗诊断）。

请你一步步给出架构设计 + 文件结构 + 核心代码实现示例，并保证代码可以在真实项目中直接运行或稍作修改即可运行。

⸻

一、技术栈 & 项目基础要求
	1.	使用的前端技术栈：
	•	构建工具：Vite
	•	语言：TypeScript
	•	框架：React（函数组件 + Hooks）
	•	状态管理：可以使用 React 自带状态 + 自定义 hooks + Context，如有需要可建议使用轻量库（如 Zustand / Jotai），但请说明理由。
	•	UI：可以使用 Tailwind CSS 或简单的 CSS Modules，风格偏简洁、适合移动端。
	•	PWA：使用 vite-plugin-pwa 实现 manifest + Service Worker 缓存 + “添加到主屏幕”能力。
	2.	目标运行环境：
	•	手机浏览器（优先 Android Chrome）；
	•	支持安装为 PWA 后以全屏“类 App”形式运行；
	•	要考虑 离线可用：在无网络时至少可以打开应用、查看历史记录、使用本地节拍训练（不含 LLM）。
	3.	请给出一个清晰的 src/ 目录结构建议，例如：

src/
  main.tsx
  App.tsx
  routes/
    index.tsx
  features/
    device/       // 蓝牙设备连接 & 心率数据
    hrv/          // HRV 计算逻辑
    beat/         // 节拍生成 & 播放
    history/      // 历史 Session 存储与展示
    advisor/      // AI 健康顾问
  components/     // 通用 UI 组件
  lib/            // 工具函数（时间、统计、HRV 算法等）
  storage/        // IndexedDB 封装
  styles/

请解释每个目录的职责，并在后续代码示例中遵守这一结构。

⸻

二、主要功能模块 & 详细要求

下面是每一个功能模块的详细要求，请针对每个模块：
	•	先给出接口设计 / TypeScript 类型；
	•	再给出核心实现思路与关键代码示例；
	•	必要时提供示例组件代码。

⸻

模块 1：心率设备连接（蓝牙 & 模拟）
	1.	我希望提供一个设备抽象层 HeartRateDevice，统一真实蓝牙设备与模拟设备的接口。
请设计如下接口（可适当扩展）：

export type DeviceMode = 'ble-real' | 'demo-simulated'

export interface HeartRateSample {
  timestamp: number   // ms
  bpm: number         // 当前心率
  rrMs?: number       // 如果设备支持，提供 RR 间期；支持则用于更精准 HRV
}

export interface HeartRateDevice {
  mode: DeviceMode
  isConnected: boolean
  connect(): Promise<void>
  disconnect(): Promise<void>
  onSample(callback: (sample: HeartRateSample) => void): void
  offSample(callback: (sample: HeartRateSample) => void): void
}


	2.	需要两个具体实现：
	•	BleHeartRateDevice：使用 Web Bluetooth API 连接支持 Heart Rate Service 的 BLE 设备。
	•	使用标准 Heart Rate Service UUID 0x180D 和 characteristic 0x2A37（heart_rate_measurement）为例。
	•	实现心率包解析：从 characteristic value 中解析出 bpm，如果数据中存在 RR interval（单位为 1/1024 秒），转换成 rrMs。
	•	需要考虑错误处理：
	•	用户拒绝授权；
	•	浏览器不支持 navigator.bluetooth；
	•	设备断开连接时的回调处理。
	•	DemoHeartRateDevice：模拟一个看起来逼真、可用于开发与展示的心率/HRV 数据流。
	•	模拟一个基础 BPM 在 65–80 之间的序列；
	•	模拟 RR 间期：围绕 60000/BPM 加入高斯或均匀随机扰动；
	•	让 HRV（RMSSD）在 15–80ms 区间内缓慢变化，以模拟“紧张/放松”不同状态；
	•	需要定时推送 HeartRateSample 给 onSample 回调，比如每 1 秒推送一次。
	3.	在 UI 层实现一个 DeviceConnectPage：
	•	当浏览器支持 Web Bluetooth 时，提供“连接蓝牙心率设备”的按钮；
	•	同时提供一个“使用演示模式（模拟数据）”的按钮。
	•	用一个简单的状态（例如 deviceMode）区分真实设备与 demo 设备。

请给出：
	•	HeartRateDevice 与实现类的 TypeScript 代码示例；
	•	DeviceConnectPage 的组件示例（包括基本 UI 和连接逻辑）。

⸻

模块 2：HRV 计算引擎
	1.	我希望有一个独立的 HRV 计算类，用来接收心跳时间戳/ RR 间期，并可以随时查询当前 HRV 指标。
请设计如下接口：

export interface HRVMetrics {
  rmssd: number      // 毫秒
  sdnn: number       // 毫秒
  pnn50: number      // 百分比 (0-100)
  sampleCount: number
}

export class HRVCalculator {
  constructor(maxBeats?: number) // 比如默认保留最近 256 个 RR
  addBeat(timestamp: number): void              // 用 beat 时间推导 RR
  addRRInterval(rrMs: number, timestamp: number): void // 如果设备直接提供 RR
  getMetrics(): HRVMetrics
  reset(): void
}


	2.	HRV 算法要求：
	•	按 RR 间期序列计算：
	•	RMSSD：相邻 RR 差分的均方根；
	•	SDNN：RR 间期的标准差；
	•	pNN50：相邻 RR 差值 > 50ms 的比例。
	•	需要做基本的生理范围过滤：
	•	RR 间期小于 300ms 或大于 2000ms 的样本视为异常，不进入计算。
	3.	集成方式：
	•	当 HeartRateDevice 提供了 rrMs，优先调用 addRRInterval；
	•	否则可以用相邻心跳时间戳差值来推导 RR（精度略低，但保持功能流程连贯）。

请给出 HRVCalculator 的完整 TypeScript 实现，包括：
	•	内部如何存储 RR 序列；
	•	如何计算 RMSSD / SDNN / pNN50；
	•	一个简单的使用示例（如何在监听到新心跳/新 RR 时更新 HRV 指标）。

⸻

模块 3：实时监测页面（LiveMonitorPage）
	1.	功能：
	•	显示当前：
	•	心率（BPM）；
	•	HRV 三个指标：RMSSD / SDNN / pNN50；
	•	显示最近 1–5 分钟的折线图：
	•	一条心率曲线；
	•	一条 RMSSD 曲线；
	•	支持开始/停止监测。
	2.	要求：
	•	使用 React Hooks 实现一个 useLiveMetrics hook：
	•	接收 HeartRateDevice 与 HRVCalculator；
	•	内部订阅心率样本；
	•	维护当前 BPM / HRV / 历史数据（用于绘图）。
	•	折线图可以用最简单可用的库（如 recharts），或者你可以写一个简单的 Canvas 绘图组件。

请给出：
	•	useLiveMetrics 的实现示例；
	•	LiveMonitorPage 组件示例（包含基本布局和数值展示/图表）。

⸻

模块 4：AI 节拍器（BeatTrainerPage）
	1.	目标：
	•	基于当前/近期 HRV 数据和用户目标（放松 / 激活 / 维持），生成一个节拍训练方案；
	•	用 Web Audio API 播放节拍音（metronome / drum-like sound）；
	•	节拍方案要结构化，便于将来实际接 AI 模型。
	2.	请设计节拍参数结构：

export type TrainingGoal = 'relax' | 'activate' | 'balance'

export interface BeatPattern {
  baseBpm: number
  durationMinutes: number
  accents: number[]   // 小节内重音分布，例如 [1, 0, 0, 0] 表示 4 拍中第 1 拍重音
  bpmSchedule?: { timeMinute: number; bpm: number }[]
  description: string // 对用户的自然语言解释，用于 UI 显示
}


	3.	需要一个本地的“规则引擎”作为 AI 的兜底策略，如：
	•	若 RMSSD 较低（例如 < 20ms，压力偏高）：
	•	生成 baseBpm 在 50–65 之间；
	•	建议 duration 5–10 分钟；
	•	bpmSchedule 可从略快逐渐减缓，引导逐步放松。
	•	若 RMSSD 较高且用户选择“激活”：
	•	生成 baseBpm 在 80–95；
	•	持续节拍帮助提高唤醒和专注。
请实现一个函数：

export function generateBeatPatternFromHRV(
  metrics: HRVMetrics,
  goal: TrainingGoal
): BeatPattern


	4.	节拍播放实现：
	•	使用 Web Audio API（AudioContext + OscillatorNode 或简易 Buffer 音色）；
	•	封装一个 useBeatPlayer hook 或 BeatPlayer 组件，支持：
	•	start(pattern: BeatPattern)
	•	stop()
	•	isPlaying 状态
	•	节拍定时逻辑要尽量使用 AudioContext 的时间基准，而不是仅使用 setInterval，以降低节拍抖动。
	5.	BeatTrainerPage：
	•	显示当前 HR / HRV 摘要；
	•	用户选择目标（relax / activate / balance）；
	•	点击“生成节拍方案”按钮：
	•	调用 generateBeatPatternFromHRV 得出 BeatPattern；
	•	在 UI 中展示节拍方案的描述；
	•	提供“开始训练 / 停止训练”按钮，控制节拍播放。

请给出：
	•	generateBeatPatternFromHRV 的实现示例；
	•	useBeatPlayer 或 BeatPlayer 的核心实现；
	•	BeatTrainerPage 的基本 UI 示例。

⸻

模块 5：历史记录（HistoryPage）
	1.	我希望记录每一次训练/监测 Session，结构如下：

export interface SessionRecord {
  id: string
  startTime: number
  endTime: number
  avgBpm: number
  avgRmssd: number
  avgSdnn: number
  avgPnn50: number
  beatPatternUsed?: BeatPattern
  userMood?: 'relaxed' | 'neutral' | 'stressed'
  notes?: string
}


	2.	存储方式：
	•	使用 IndexedDB，建议用 localforage 或 idb 封装；
	•	实现一个 SessionStore 模块，提供：

export async function saveSession(record: SessionRecord): Promise<void>
export async function listSessions(): Promise<SessionRecord[]>
export async function getSession(id: string): Promise<SessionRecord | null>
export async function deleteSession(id: string): Promise<void>


	3.	UI 要求：
	•	HistoryPage：
	•	列表展示所有 Session，按时间倒序；
	•	每条显示日期、平均 HR、平均 RMSSD、用户标注的心情。
	•	SessionDetailPage：
	•	展示该次 Session 的详细数据与所用节拍方案摘要；
	•	可以有一个简单的“导出为 JSON”按钮，将该 Session 的数据以 JSON 文本形式展示（方便复制/分享/研究）。

请给出：
	•	IndexedDB 封装代码示例；
	•	HistoryPage 和 SessionDetailPage 的组件示例。

⸻

模块 6：AI 健康顾问（AIAdvisorPage）
	1.	目标：
	•	允许用户（尤其是老人）在应用内向一个 AI 顾问提问，例如“我最近睡眠不好，HRV 有什么变化？我应该怎么调整生活习惯？”
	•	AI 顾问可以读取最近一段时间的 HR/HRV 统计摘要 + 用户自述情况，给出温和、具体、可执行的生活建议。
	•	明确 不是医疗诊断，不能推荐药物或替代医生。
	2.	前端侧设计：
	•	实现一个简易的对话 UI：
	•	顶部展示最近 7 天的 HR/HRV 概览（例如平均 HR、平均 RMSSD 的变化箭头）；
	•	中间是对话气泡（用户/AI）；
	•	底部是一个文本输入框和发送按钮。
	•	封装一个 askHealthAdvisor(question: string): Promise<string> 函数：
	•	该函数内部暂时可以调用一个假 API（使用 setTimeout + 返回模拟文本），但接口签名要为将来接入真实 LLM API 做好准备；
	•	请在代码中明确标注此处为“LLM 集成扩展点”。
	3.	请提供一个英文的 system prompt 示例，用于后端在调用大模型时使用，要求包括：
	•	模型角色：面向老年人的温和健康生活顾问；
	•	只能根据 HR/HRV 趋势和生活习惯给出一般性建议；
	•	避免给出任何诊断、药物、急救指导；
	•	在需要就医时，明确建议用户咨询医生。

请给出：
	•	AIAdvisorPage 的 UI 组件示例；
	•	askHealthAdvisor 的前端封装示例；
	•	system prompt 文本。

⸻

三、PWA 配置与移动端体验
	1.	使用 vite-plugin-pwa 配置 PWA：
	•	给出 vite.config.ts 中集成 VitePWA 的完整示例；
	•	配置 manifest：
	•	name: “HRV Companion” 或类似；
	•	short_name: “HRVApp”；
	•	display: “standalone”；
	•	start_url: “/”；
	•	theme_color / background_color；
	•	icons 示例（192x192 和 512x512）。
	•	Service Worker 配置：
	•	缓存基本静态资源（HTML/CSS/JS/图标）；
	•	示例：如何在更新后让用户获得新版本（可使用 registerType: 'autoUpdate'）。
	2.	移动端 UI 细节：
	•	使用响应式布局适配小屏幕；
	•	按钮与文字采用较大尺寸，适合老年人使用；
	•	提供底部导航或顶部 Tab，在主要模块之间切换：
	•	实时监测（Live）；
	•	节拍训练（Training）；
	•	历史记录（History）；
	•	AI 顾问（Advisor）；

请在最终答案中展示一个 App.tsx 或路由入口示例，说明各页面如何组织与导航。

⸻

四、质量要求
	1.	所有 TypeScript 代码要类型明确，不要用 any。
	2.	需要适当的错误处理和用户提示（例如：蓝牙不支持、连接失败、无心率数据、IndexedDB 操作失败等）。
	3.	对于核心逻辑（HRV 计算、BeatPattern 生成），请在注释中简要说明算法思路。
	4.	不需要写完整的单元测试，但可以在关键函数前说明可以如何测试。

⸻

