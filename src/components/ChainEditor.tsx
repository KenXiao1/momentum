import React, { useState } from 'react';
import { Chain, ExceptionRule } from '../types';
import { ArrowLeft, Save, Headphones, Code, BookOpen, Dumbbell, Coffee, Target, Clock, Bell } from 'lucide-react';

interface ChainEditorProps {
  chain?: Chain;
  isEditing: boolean;
  onSave: (chain: Omit<Chain, 'id' | 'currentStreak' | 'auxiliaryStreak' | 'totalCompletions' | 'totalFailures' | 'auxiliaryFailures' | 'createdAt' | 'lastCompletedAt'>) => void;
  onCancel: () => void;
}

const TRIGGER_TEMPLATES = [
  { icon: Headphones, text: '戴上降噪耳机', color: 'text-blue-400' },
  { icon: Code, text: '打开编程软件', color: 'text-green-400' },
  { icon: BookOpen, text: '坐到书房书桌前', color: 'text-purple-400' },
  { icon: Dumbbell, text: '换上运动服', color: 'text-red-400' },
  { icon: Coffee, text: '准备一杯咖啡', color: 'text-yellow-400' },
  { icon: Target, text: '自定义触发器', color: 'text-gray-400' },
];

const AUXILIARY_SIGNAL_TEMPLATES = [
  { icon: Target, text: '打响指', color: 'text-blue-400' },
  { icon: Clock, text: '设置手机闹钟', color: 'text-green-400' },
  { icon: Bell, text: '按桌上的铃铛', color: 'text-purple-400' },
  { icon: Coffee, text: '说"开始预约"', color: 'text-yellow-400' },
  { icon: Target, text: '自定义信号', color: 'text-gray-400' },
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
  const [exceptions, setExceptions] = useState(chain?.exceptions || []);
  const [editingException, setEditingException] = useState<number | null>(null);
  const [newException, setNewException] = useState<{
    name: string;
    condition: string;
    editable: boolean;
  }>({
    name: '',
    condition: '',
    editable: true
  });

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
      exceptions,
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
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-2xl mx-auto">
        <header className="flex items-center space-x-4 mb-8">
          <button
            onClick={onCancel}
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-3xl font-bold text-white">
            {isEditing ? '编辑链条' : '创建新链条'}
          </h1>
        </header>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* 例外规则编辑 */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 border-l-4 border-l-green-500">
            <h3 className="text-lg font-semibold text-green-300 mb-4">例外规则</h3>
            
            <div className="space-y-4 mb-4">
              {exceptions.map((rule, index) => (
                <div key={rule.id} className="bg-gray-700 p-4 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-white">{rule.name}</span>
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          setNewException({...rule});
                          setEditingException(index);
                        }}
                        className="text-blue-400 hover:text-blue-300"
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setExceptions(exceptions.filter((_, i) => i !== index));
                        }}
                        className="text-red-400 hover:text-red-300"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                  <div className="text-sm text-gray-300">
                    <p>条件: {String(rule.condition || '')}</p>
                    <p>动作: 跳过</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-gray-700 p-4 rounded-lg">
              <h4 className="text-white mb-3">
                {editingException !== null ? '编辑规则' : '添加新规则'}
              </h4>
              <div className="space-y-3">
                <input
                  type="text"
                  value={newException.name}
                  onChange={(e) => setNewException({...newException, name: e.target.value})}
                  placeholder="规则名称"
                  className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white"
                />
                <input
                  type="text"
                  value={newException.condition}
                  onChange={(e) => setNewException({...newException, condition: e.target.value})}
                  placeholder="触发条件"
                  className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white"
                />
                <div className="flex justify-end space-x-2">
                  {editingException !== null && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingException(null);
                        setNewException({
                          name: '',
                          condition: '',
                          editable: true
                        });
                      }}
                      className="px-3 py-1 bg-gray-500 text-white rounded"
                    >
                      取消
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (!newException.name || !newException.condition) return;
                      
                      const updatedRule: ExceptionRule = {
                        ...newException,
                        id: editingException !== null ? 
                            exceptions[editingException].id : 
                            Date.now().toString(),
                      };

                      if (editingException !== null) {
                        setExceptions(exceptions.map((r, i) => 
                          i === editingException ? updatedRule : r
                        ));
                      } else {
                        setExceptions([...exceptions, updatedRule]);
                      }
                      
                      setNewException({
                        name: '',
                        condition: '',
                        editable: true
                      });
                      setEditingException(null);
                    }}
                    className="px-3 py-1 bg-green-500 text-white rounded"
                  >
                    {editingException !== null ? '更新' : '添加'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <label className="block text-sm font-medium text-gray-300 mb-3">
              链名称
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：学习Python、健身30分钟、无干扰写作"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
              required
            />
          </div>

          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <label className="block text-sm font-medium text-gray-300 mb-4">
              神圣座位（触发动作）
            </label>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {TRIGGER_TEMPLATES.map((template, index) => {
                const Icon = template.icon;
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleTriggerSelect(template.text)}
                    className={`p-4 rounded-lg border-2 transition-all duration-200 flex items-center space-x-3 ${
                      trigger === template.text
                        ? 'border-orange-500 bg-orange-500/10'
                        : 'border-gray-600 hover:border-gray-500'
                    }`}
                  >
                    <Icon className={template.color} size={20} />
                    <span className="text-white text-sm">{template.text}</span>
                  </button>
                );
              })}
            </div>
            {trigger === '自定义触发器' && (
              <input
                type="text"
                value={customTrigger}
                onChange={(e) => setCustomTrigger(e.target.value)}
                placeholder="输入你的自定义触发动作"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                required
              />
            )}
          </div>

          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <label className="block text-sm font-medium text-gray-300 mb-4">
              任务时长
            </label>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {DURATION_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setDuration(preset)}
                  className={`p-3 rounded-lg border-2 transition-all duration-200 ${
                    duration === preset
                      ? 'border-orange-500 bg-orange-500/10 text-orange-300'
                      : 'border-gray-600 hover:border-gray-500 text-white'
                  }`}
                >
                  {preset}分钟
                </button>
              ))}
            </div>
            <div className="flex items-center space-x-4">
              <label className="text-gray-300 text-sm">自定义：</label>
              <input
                type="range"
                min="5"
                max="180"
                step="5"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-white font-medium w-16">{duration}分钟</span>
            </div>
          </div>

          {/* 辅助链设置 */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 border-l-4 border-l-blue-500">
            <h3 className="text-lg font-semibold text-blue-300 mb-6">辅助链（预约链）设置</h3>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-4">
                  预约信号
                </label>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {AUXILIARY_SIGNAL_TEMPLATES.map((template, index) => {
                    const Icon = template.icon;
                    return (
                      <button
                        key={index}
                        type="button"
                        onClick={() => handleAuxiliarySignalSelect(template.text)}
                        className={`p-4 rounded-lg border-2 transition-all duration-200 flex items-center space-x-3 ${
                          auxiliarySignal === template.text
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-gray-600 hover:border-gray-500'
                        }`}
                      >
                        <Icon className={template.color} size={20} />
                        <span className="text-white text-sm">{template.text}</span>
                      </button>
                    );
                  })}
                </div>
                {auxiliarySignal === '自定义信号' && (
                  <input
                    type="text"
                    value={customAuxiliarySignal}
                    onChange={(e) => setCustomAuxiliarySignal(e.target.value)}
                    placeholder="输入你的自定义预约信号"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    required
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-4">
                  预约时长
                </label>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {AUXILIARY_DURATION_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAuxiliaryDuration(preset)}
                      className={`p-3 rounded-lg border-2 transition-all duration-200 ${
                        auxiliaryDuration === preset
                          ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                          : 'border-gray-600 hover:border-gray-500 text-white'
                      }`}
                    >
                      {preset}分钟
                    </button>
                  ))}
                </div>
                <div className="flex items-center space-x-4">
                  <label className="text-gray-300 text-sm">自定义：</label>
                  <input
                    type="range"
                    min="5"
                    max="60"
                    step="5"
                    value={auxiliaryDuration}
                    onChange={(e) => setAuxiliaryDuration(Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-white font-medium w-16">{auxiliaryDuration}分钟</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  预约完成条件（通常与主链触发器相同）
                </label>
                <input
                  type="text"
                  value={auxiliaryCompletionTrigger}
                  onChange={(e) => setAuxiliaryCompletionTrigger(e.target.value)}
                  placeholder="例如：打开编程软件、坐到书房书桌前"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  required
                />
                <p className="text-gray-400 text-xs mt-2">
                  这是你在预约时间内必须完成的动作，通常就是主链的"神圣座位"触发器
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <label className="block text-sm font-medium text-gray-300 mb-3">
              任务描述
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="具体要做什么？例如：完成CS61A项目的第一部分"
              rows={4}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 resize-none"
              required
            />
          </div>

          <div className="flex space-x-4">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-gray-600 hover:bg-gray-500 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200"
            >
              取消
            </button>
            <button
              type="submit"
              className="flex-1 bg-orange-500 hover:bg-orange-400 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center space-x-2"
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
