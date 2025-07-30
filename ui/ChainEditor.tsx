import React, { useState } from 'react';
import { Chain } from '../types';
import { ArrowLeft, Save, Headphones, Code, BookOpen, Dumbbell, Coffee, Target, Clock, Bell } from 'lucide-react';

interface ChainEditorProps {
  chain?: Chain;
  isEditing: boolean;
  onSave: (chain: Omit<Chain, 'id' | 'currentStreak' | 'auxiliaryStreak' | 'totalCompletions' | 'totalFailures' | 'auxiliaryFailures' | 'createdAt' | 'lastCompletedAt'>) => void;
  onCancel: () => void;
}

const TRIGGER_TEMPLATES = [
  { icon: Headphones, text: '戴上降噪耳机', color: 'text-primary-500' },
  { icon: Code, text: '打开编程软件', color: 'text-green-500' },
  { icon: BookOpen, text: '坐到书房书桌前', color: 'text-blue-500' },
  { icon: Dumbbell, text: '换上运动服', color: 'text-red-500' },
  { icon: Coffee, text: '准备一杯咖啡', color: 'text-yellow-500' },
  { icon: Target, text: '自定义触发器', color: 'text-gray-500' },
];

const AUXILIARY_SIGNAL_TEMPLATES = [
  { icon: Target, text: '打响指', color: 'text-primary-500' },
  { icon: Clock, text: '设置手机闹钟', color: 'text-green-500' },
  { icon: Bell, text: '按桌上的铃铛', color: 'text-blue-500' },
  { icon: Coffee, text: '说"开始预约"', color: 'text-yellow-500' },
  { icon: Target, text: '自定义信号', color: 'text-gray-500' },
];

const AUXILIARY_DURATION_PRESETS = [5, 10, 15, 20, 30, 45];
const DURATION_PRESETS = [25, 30, 45, 60, 90, 120];

export const ChainEditor: React.FC<ChainEditorProps> = ({
  chain,
  isEditing,
  onSave,
  onCancel,
}) => {
  const [name, setName] = useState(chain?.name || '');
  const [trigger, setTrigger] = useState(chain?.trigger || '');
  const [customTrigger, setCustomTrigger] = useState('');
  const [duration, setDuration] = useState(chain?.duration || 45);
  const [description, setDescription] = useState(chain?.description || '');
  
  // 辅助链状态
  const [auxiliarySignal, setAuxiliarySignal] = useState(chain?.auxiliarySignal || '');
  const [customAuxiliarySignal, setCustomAuxiliarySignal] = useState('');
  const [auxiliaryDuration, setAuxiliaryDuration] = useState(chain?.auxiliaryDuration || 15);
  const [auxiliaryCompletionTrigger, setAuxiliaryCompletionTrigger] = useState(
    chain?.auxiliaryCompletionTrigger || ''
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !trigger.trim() || !description.trim() || 
        !auxiliarySignal.trim() || !auxiliaryCompletionTrigger.trim()) return;

    onSave({
      name: name.trim(),
      trigger: trigger === '自定义触发器' ? customTrigger.trim() : trigger,
      duration,
      description: description.trim(),
      auxiliarySignal: auxiliarySignal === '自定义信号' ? customAuxiliarySignal.trim() : auxiliarySignal,
      auxiliaryDuration,
      auxiliaryCompletionTrigger: auxiliaryCompletionTrigger.trim(),
      exceptions: chain?.exceptions || [],
      auxiliaryExceptions: chain?.auxiliaryExceptions || [],
    });
  };

  const handleTriggerSelect = (triggerText: string) => {
    setTrigger(triggerText);
    if (triggerText !== '自定义触发器') {
      setCustomTrigger('');
      // 自动设置辅助链完成条件为主链触发器
      setAuxiliaryCompletionTrigger(triggerText);
    }
  };

  const handleAuxiliarySignalSelect = (signalText: string) => {
    setAuxiliarySignal(signalText);
    if (signalText !== '自定义信号') {
      setCustomAuxiliarySignal('');
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="flex items-center space-x-4 mb-12 animate-fade-in">
          <button
            onClick={onCancel}
            className="p-3 text-gray-400 hover:text-[#161615] transition-colors rounded-2xl hover:bg-white/50"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-4xl md:text-5xl font-bold font-chinese text-[#161615] mb-2">
              {isEditing ? '编辑链条' : '创建新链条'}
            </h1>
            <p className="text-sm font-mono text-gray-500 tracking-wider uppercase">
              {isEditing ? 'EDIT CHAIN' : 'CREATE NEW CHAIN'}
            </p>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="space-y-8 animate-slide-up">
          {/* Chain Name */}
          <div className="bento-card animate-scale-in">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-primary-500/10 flex items-center justify-center">
                <i className="fas fa-tag text-primary-500"></i>
              </div>
              <div>
                <h3 className="text-xl font-bold font-chinese text-[#161615]">链名称</h3>
                <p className="text-sm font-mono text-gray-500 tracking-wide">CHAIN NAME</p>
              </div>
            </div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：学习Python、健身30分钟、无干扰写作"
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-6 py-4 text-[#161615] placeholder-gray-400 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all duration-300 font-chinese"
              required
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {/* 主链设置 */}
            <div className="space-y-6">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary-500/20 to-primary-600/10 flex items-center justify-center">
                  <i className="fas fa-fire text-primary-500"></i>
                </div>
                <div>
                  <h3 className="text-2xl font-bold font-chinese text-[#161615]">主链设置</h3>
                  <p className="text-sm font-mono text-gray-500 tracking-wide">MAIN CHAIN</p>
                </div>
              </div>
              
              {/* 神圣座位 */}
              <div className="bento-card border-l-4 border-l-primary-500 animate-scale-in">
                <div className="flex items-center space-x-3 mb-4">
                  <i className="fas fa-crown text-primary-500"></i>
                  <div>
                    <h4 className="text-lg font-bold font-chinese text-[#161615]">神圣座位</h4>
                    <p className="text-xs font-mono text-gray-500">SACRED SEAT TRIGGER</p>
                  </div>
                </div>
                <select
                  value={trigger}
                  onChange={(e) => handleTriggerSelect(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-[#161615] focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all duration-300 mb-4 font-chinese"
                  required
                >
                  <option value="" disabled className="text-gray-400">
                    选择触发动作
                  </option>
                  {TRIGGER_TEMPLATES.map((template, index) => (
                    <option key={index} value={template.text} className="text-[#161615]">
                      {template.text}
                    </option>
                  ))}
                </select>
                {trigger === '自定义触发器' && (
                  <input
                    type="text"
                    value={customTrigger}
                    onChange={(e) => setCustomTrigger(e.target.value)}
                    placeholder="输入你的自定义触发动作"
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-[#161615] placeholder-gray-400 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all duration-300 font-chinese"
                    required
                  />
                )}
              </div>

              {/* 任务时长 */}
              <div className="bento-card border-l-4 border-l-primary-500 animate-scale-in">
                <div className="flex items-center space-x-3 mb-4">
                  <Clock className="text-primary-500" size={20} />
                  <div>
                    <h4 className="text-lg font-bold font-chinese text-[#161615]">任务时长</h4>
                    <p className="text-xs font-mono text-gray-500">TASK DURATION</p>
                  </div>
                </div>
                <select
                  value={DURATION_PRESETS.includes(duration) ? duration : "custom"}
                  onChange={(e) => {
                    if (e.target.value === "custom") {
                      setDuration(60);
                    } else {
                      setDuration(Number(e.target.value));
                    }
                  }}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-[#161615] focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all duration-300 mb-4 font-chinese"
                  required
                >
                  {DURATION_PRESETS.map((preset) => (
                    <option key={preset} value={preset} className="text-[#161615]">
                      {preset}分钟
                    </option>
                  ))}
                  <option value="custom" className="text-[#161615]">自定义时长</option>
                </select>
                {!DURATION_PRESETS.includes(duration) && (
                  <input
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    placeholder="输入自定义时长（分钟）"
                    min="1"
                    max="300"
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-[#161615] placeholder-gray-400 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all duration-300 font-chinese"
                    required
                  />
                )}
              </div>
            </div>

            {/* 辅助链设置 */}
            <div className="space-y-6">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 flex items-center justify-center">
                  <i className="fas fa-calendar-alt text-blue-500"></i>
                </div>
                <div>
                  <h3 className="text-2xl font-bold font-chinese text-[#161615]">辅助链设置</h3>
                  <p className="text-sm font-mono text-gray-500 tracking-wide">AUXILIARY CHAIN</p>
                </div>
              </div>
              
              {/* 预约信号 */}
              <div className="bento-card border-l-4 border-l-blue-500 animate-scale-in">
                <div className="flex items-center space-x-3 mb-4">
                  <i className="fas fa-bell text-blue-500"></i>
                  <div>
                    <h4 className="text-lg font-bold font-chinese text-[#161615]">预约信号</h4>
                    <p className="text-xs font-mono text-gray-500">BOOKING SIGNAL</p>
                  </div>
                </div>
                <select
                  value={auxiliarySignal}
                  onChange={(e) => handleAuxiliarySignalSelect(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-[#161615] focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-300 mb-4 font-chinese"
                  required
                >
                  <option value="" disabled className="text-gray-400">
                    选择预约信号
                  </option>
                  {AUXILIARY_SIGNAL_TEMPLATES.map((template, index) => (
                    <option key={index} value={template.text} className="text-[#161615]">
                      {template.text}
                    </option>
                  ))}
                </select>
                {auxiliarySignal === '自定义信号' && (
                  <input
                    type="text"
                    value={customAuxiliarySignal}
                    onChange={(e) => setCustomAuxiliarySignal(e.target.value)}
                    placeholder="输入你的自定义预约信号"
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-[#161615] placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-300 font-chinese"
                    required
                  />
                )}
              </div>

              {/* 预约时长 */}
              <div className="bento-card border-l-4 border-l-blue-500 animate-scale-in">
                <div className="flex items-center space-x-3 mb-4">
                  <i className="fas fa-hourglass-half text-blue-500"></i>
                  <div>
                    <h4 className="text-lg font-bold font-chinese text-[#161615]">预约时长</h4>
                    <p className="text-xs font-mono text-gray-500">BOOKING DURATION</p>
                  </div>
                </div>
                <select
                  value={AUXILIARY_DURATION_PRESETS.includes(auxiliaryDuration) ? auxiliaryDuration : "custom"}
                  onChange={(e) => {
                    if (e.target.value === "custom") {
                      setAuxiliaryDuration(25);
                    } else {
                      setAuxiliaryDuration(Number(e.target.value));
                    }
                  }}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-[#161615] focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-300 mb-4 font-chinese"
                  required
                >
                  {AUXILIARY_DURATION_PRESETS.map((preset) => (
                    <option key={preset} value={preset} className="text-[#161615]">
                      {preset}分钟
                    </option>
                  ))}
                  <option value="custom" className="text-[#161615]">自定义时长</option>
                </select>
                {!AUXILIARY_DURATION_PRESETS.includes(auxiliaryDuration) && (
                  <input
                    type="number"
                    value={auxiliaryDuration}
                    onChange={(e) => setAuxiliaryDuration(Number(e.target.value))}
                    placeholder="输入自定义时长（分钟）"
                    min="1"
                    max="120"
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-[#161615] placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-300 font-chinese"
                    required
                  />
                )}
              </div>

              {/* 预约完成条件 */}
              <div className="bento-card border-l-4 border-l-blue-500 animate-scale-in">
                <div className="flex items-center space-x-3 mb-4">
                  <i className="fas fa-check-circle text-blue-500"></i>
                  <div>
                    <h4 className="text-lg font-bold font-chinese text-[#161615]">预约完成条件</h4>
                    <p className="text-xs font-mono text-gray-500">COMPLETION CONDITION</p>
                  </div>
                </div>
                <input
                  type="text"
                  value={auxiliaryCompletionTrigger}
                  onChange={(e) => setAuxiliaryCompletionTrigger(e.target.value)}
                  placeholder="例如：打开编程软件、坐到书房书桌前"
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-[#161615] placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-300 font-chinese"
                  required
                />
                <p className="text-gray-500 text-xs mt-3 leading-relaxed">
                  这是你在预约时间内必须完成的动作，通常就是主链的"神圣座位"触发器
                </p>
              </div>
            </div>
          </div>

          {/* 任务描述 */}
          <div className="bento-card animate-scale-in">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-gray-500/10 flex items-center justify-center">
                <i className="fas fa-align-left text-gray-500"></i>
              </div>
              <div>
                <h3 className="text-xl font-bold font-chinese text-[#161615]">任务描述</h3>
                <p className="text-sm font-mono text-gray-500 tracking-wide">TASK DESCRIPTION</p>
              </div>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="具体要做什么？例如：完成CS61A项目的第一部分"
              rows={4}
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-6 py-4 text-[#161615] placeholder-gray-400 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all duration-300 resize-none font-chinese leading-relaxed"
              required
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-6 animate-scale-in">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-[#161615] px-8 py-4 rounded-2xl font-medium transition-all duration-300 flex items-center justify-center space-x-3 hover:scale-105 font-chinese"
            >
              <span>取消</span>
            </button>
            <button
              type="submit"
              className="flex-1 gradient-primary hover:shadow-xl text-white px-8 py-4 rounded-2xl font-medium transition-all duration-300 flex items-center justify-center space-x-3 hover:scale-105 shadow-lg font-chinese"
            >
              <Save size={20} />
              <span>{isEditing ? '保存更改' : '创建链条'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};