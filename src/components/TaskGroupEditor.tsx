import React, { useState } from 'react';
import { Chain, ChainType } from '../types';
import { ArrowLeft, Save, Tag, Calendar, Target, Clock, Bell, Coffee, Hash } from 'lucide-react';
import { ResponsiveContainer } from './ResponsiveContainer';
import { SettingSection } from './SettingSection';
import { SliderContainer } from './SliderContainer';
import { PureDOMSlider } from './PureDOMSlider';
import { useMobileOptimization, useTouchOptimization, useVirtualKeyboardAdaptation } from '../hooks/useMobileOptimization';

interface TaskGroupEditorProps {
  chain?: Chain;
  isEditing: boolean;
  initialParentId?: string;
  onSave: (chain: Omit<Chain, 'id' | 'currentStreak' | 'auxiliaryStreak' | 'totalCompletions' | 'totalFailures' | 'auxiliaryFailures' | 'createdAt' | 'lastCompletedAt'>) => void;
  onCancel: () => void;
}

const AUXILIARY_SIGNAL_TEMPLATES = [
  { icon: Target, text: '打响指', color: 'text-primary-500' },
  { icon: Clock, text: '设置手机闹钟', color: 'text-green-500' },
  { icon: Bell, text: '按桌上的铃铛', color: 'text-blue-500' },
  { icon: Coffee, text: '说"开始预约"', color: 'text-yellow-500' },
  { icon: Target, text: '自定义信号', color: 'text-gray-500' },
];

const AUXILIARY_DURATION_PRESETS = [5, 10, 15, 20, 30, 45];

export const TaskGroupEditor: React.FC<TaskGroupEditorProps> = ({
  chain,
  isEditing,
  initialParentId,
  onSave,
  onCancel,
}) => {
  const [name, setName] = useState(chain?.name || '');
  const [description, setDescription] = useState(chain?.description || '');
  const [auxiliarySignal, setAuxiliarySignal] = useState(chain?.auxiliarySignal || '打响指');
  const [customAuxiliarySignal, setCustomAuxiliarySignal] = useState('');
  const [auxiliaryDuration, setAuxiliaryDuration] = useState(chain?.auxiliaryDuration || 15);
  const [isCustomAuxiliaryDuration, setIsCustomAuxiliaryDuration] = useState(
    chain?.auxiliaryDuration ? !AUXILIARY_DURATION_PRESETS.includes(chain.auxiliaryDuration) : false
  );
  const [auxiliaryCompletionTrigger, setAuxiliaryCompletionTrigger] = useState(chain?.auxiliaryCompletionTrigger || '开始第一个子任务');
  const [errors, setErrors] = useState<{
    name?: string;
    description?: string;
    auxiliarySignal?: string;
    auxiliaryCompletionTrigger?: string;
  }>({});

  const handleAuxiliarySignalSelect = (value: string) => {
    setAuxiliarySignal(value);
    if (value !== '自定义信号') {
      setCustomAuxiliarySignal('');
    }
    // Clear auxiliary signal error when user makes a selection
    if (errors.auxiliarySignal && value) {
      setErrors(prev => ({ ...prev, auxiliarySignal: undefined }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('TaskGroupEditor - 提交表单');
    console.log('当前表单数据:', {
      name: name.trim(),
      description: description.trim(),
      auxiliarySignal: auxiliarySignal === '自定义信号' ? customAuxiliarySignal.trim() : auxiliarySignal,
      auxiliaryDuration,
      auxiliaryCompletionTrigger: auxiliaryCompletionTrigger.trim()
    });
    
    // Clear previous errors
    setErrors({});
    
    const newErrors: { 
      name?: string; 
      description?: string; 
      auxiliarySignal?: string; 
      auxiliaryCompletionTrigger?: string; 
    } = {};
    
    if (!name.trim()) {
      newErrors.name = '请输入任务群名称';
    }
    
    if (!description.trim()) {
      newErrors.description = '请输入任务群描述';
    }

    // Validate auxiliary signal
    if (!auxiliarySignal) {
      newErrors.auxiliarySignal = '请选择预约信号';
    } else if (auxiliarySignal === '自定义信号' && !customAuxiliarySignal.trim()) {
      newErrors.auxiliarySignal = '请输入自定义预约信号';
    }

    // Validate auxiliary completion trigger
    if (!auxiliaryCompletionTrigger.trim()) {
      newErrors.auxiliaryCompletionTrigger = '请输入预约完成条件';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      console.warn('TaskGroupEditor - 表单验证失败:', newErrors);
      return;
    }

    const finalAuxiliarySignal = auxiliarySignal === '自定义信号' 
      ? customAuxiliarySignal.trim() 
      : auxiliarySignal;

    const chainData = {
      name: name.trim(),
      type: 'group' as ChainType,
      parentId: chain?.parentId || initialParentId,
      sortOrder: chain?.sortOrder || Math.floor(Date.now() / 1000),
      trigger: '任务群容器',
      duration: 0,
      isDurationless: true,
      description: description.trim(),
      auxiliarySignal: finalAuxiliarySignal,
      auxiliaryDuration,
      auxiliaryCompletionTrigger: auxiliaryCompletionTrigger.trim(),
      exceptions: chain?.exceptions || [],
      auxiliaryExceptions: chain?.auxiliaryExceptions || [],
      // Task group specific properties - system managed
      isTaskGroup: true,
      groupRepeatCount: 0, // System starts at 0, increments on completion
      taskRepeatCount: 1,
      timeLimitHours: undefined,
      timeLimitExceptions: [],
    };
    
    console.log('TaskGroupEditor - 即将保存的任务群数据:', chainData);
    onSave(chainData);
  };

  // 移动端优化
  const mobileInfo = useMobileOptimization();
  useTouchOptimization();
  const { keyboardHeight, isKeyboardVisible } = useVirtualKeyboardAdaptation();

  return (
    <div 
      className={`min-h-screen bg-background overflow-x-hidden ${isKeyboardVisible ? 'keyboard-active' : ''}`}
      style={{ paddingBottom: isKeyboardVisible ? `${keyboardHeight}px` : '0' }}
    >
      <ResponsiveContainer 
        maxWidth="4xl" 
        className={`py-4 md:py-6 ${mobileInfo.isMobile ? 'px-4' : ''}`}
      >
        {/* Header */}
        <header className="flex items-center justify-between mb-12 animate-fade-in">
          <div className="flex items-center space-x-4">
            <button
              onClick={onCancel}
              className="p-3 text-gray-400 hover:text-[#161615] transition-colors rounded-2xl hover:bg-white/50"
            >
              <ArrowLeft size={24} />
            </button>
            <div>
              <h1 className="text-4xl md:text-5xl font-bold font-chinese text-[#161615] dark:text-slate-100 mb-2">
                {isEditing ? '编辑任务群' : '创建任务群'}
              </h1>
              <p className="text-sm font-mono text-gray-500 tracking-wider uppercase">
                {isEditing ? 'EDIT TASK GROUP' : 'CREATE TASK GROUP'}
              </p>
            </div>
          </div>
          
          {/* Task Group Completion Counter */}
          {chain && isEditing && (
            <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-700/50 rounded-2xl px-4 py-3">
              <div className="flex items-center space-x-2">
                <Hash className="text-primary-600 dark:text-primary-400" size={16} />
                <span className="text-primary-700 dark:text-primary-300 font-bold text-lg">
                  #{chain.totalCompletions || 0}
                </span>
              </div>
              <p className="text-xs text-primary-600 dark:text-primary-400 mt-1 font-chinese">
                完成次数
              </p>
            </div>
          )}
        </header>

        <form onSubmit={handleSubmit} className="space-y-8 animate-slide-up">
          {/* 基础信息区 */}
          <SettingSection
            title="基础信息"
            icon={<Tag className="text-primary-500" size={20} />}
            description="设置任务群的基本信息"
          >
            {/* Task Group Name */}
            <div className="bento-card animate-scale-in">
              <div className="mb-4">
                <label htmlFor="taskgroup-name" className="block text-lg font-semibold font-chinese text-gray-900 dark:text-slate-100 mb-2">
                  任务群名称
                </label>
                <p className="text-sm text-gray-500 dark:text-slate-400 mb-4 font-chinese">
                  为您的任务群起一个清晰易懂的名称
                </p>
              </div>
              <input
                type="text"
                id="taskgroup-name"
                name="taskGroupName"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  // Clear name error when user starts typing
                  if (errors.name && e.target.value.trim()) {
                    setErrors(prev => ({ ...prev, name: undefined }));
                  }
                }}
                placeholder="例如：期末复习计划、网站开发项目、健身训练计划"
                className={`w-full bg-gray-50 dark:bg-slate-700 border ${errors.name ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-gray-200 dark:border-slate-600 focus:border-primary-500 focus:ring-primary-500/20'} rounded-2xl px-6 py-4 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-400 focus:outline-none focus:ring-2 transition-all duration-300 font-chinese`}
                required
              />
              {errors.name && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400 font-chinese">{errors.name}</p>
              )}
            </div>

            {/* Task Group Description */}
            <div className="bento-card animate-scale-in">
              <div className="mb-4">
                <label htmlFor="taskgroup-description" className="block text-lg font-semibold font-chinese text-gray-900 dark:text-slate-100 mb-2">
                  任务群描述
                </label>
                <p className="text-sm text-gray-500 dark:text-slate-400 mb-4 font-chinese">
                  详细描述这个任务群的目标和范围
                </p>
              </div>
              <textarea
                id="taskgroup-description"
                name="taskGroupDescription"
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  // Clear description error when user starts typing
                  if (errors.description && e.target.value.trim()) {
                    setErrors(prev => ({ ...prev, description: undefined }));
                  }
                }}
                placeholder="描述这个任务群的目标和范围，例如：期末复习计划，包含各科目的复习、练习题和模拟考试等"
                rows={4}
                className={`w-full bg-gray-50 dark:bg-slate-700 border ${errors.description ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-gray-200 dark:border-slate-600 focus:border-primary-500 focus:ring-primary-500/20'} rounded-2xl px-6 py-4 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-400 focus:outline-none focus:ring-2 transition-all duration-300 resize-none font-chinese leading-relaxed`}
                required
              />
              {errors.description && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400 font-chinese">{errors.description}</p>
              )}
            </div>
          </SettingSection>

          {/* 辅助链设置区 */}
          <SettingSection
            title="预约功能设置"
            icon={<Calendar className="text-blue-500" size={20} />}
            description="配置预约信号、时长和完成条件"
          >
            {/* 预约信号 */}
            <div className="bento-card border-l-4 border-l-blue-500 animate-scale-in">
              <div className="flex items-center space-x-3 mb-4">
                <i className="fas fa-bell text-blue-500"></i>
                <div>
                  <h4 className="text-lg font-bold font-chinese text-gray-900 dark:text-slate-100">预约信号</h4>
                  <p className="text-xs font-mono text-gray-500">BOOKING SIGNAL</p>
                </div>
              </div>
              <select
                id="auxiliary-signal"
                name="auxiliarySignal"
                value={auxiliarySignal}
                onChange={(e) => handleAuxiliarySignalSelect(e.target.value)}
                className={`w-full bg-gray-50 dark:bg-slate-700 border ${errors.auxiliarySignal ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-gray-200 dark:border-slate-600 focus:border-blue-500 focus:ring-blue-500/20'} rounded-2xl px-4 py-3 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 transition-all duration-300 mb-4 font-chinese`}
                required
              >
                <option value="" disabled className="text-gray-400">
                  选择预约信号
                </option>
                {AUXILIARY_SIGNAL_TEMPLATES.map((template, index) => (
                  <option key={index} value={template.text} className="text-gray-900 dark:text-slate-100 bg-white dark:bg-slate-700">
                    {template.text}
                  </option>
                ))}
              </select>
              {auxiliarySignal === '自定义信号' && (
                <input
                  type="text"
                  id="custom-auxiliary-signal"
                  name="customAuxiliarySignal"
                  value={customAuxiliarySignal}
                  onChange={(e) => {
                    setCustomAuxiliarySignal(e.target.value);
                    if (errors.auxiliarySignal && e.target.value.trim()) {
                      setErrors(prev => ({ ...prev, auxiliarySignal: undefined }));
                    }
                  }}
                  placeholder="输入你的自定义预约信号"
                  className={`w-full bg-gray-50 dark:bg-slate-700 border ${errors.auxiliarySignal ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-gray-200 dark:border-slate-600 focus:border-blue-500 focus:ring-blue-500/20'} rounded-2xl px-4 py-3 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-400 focus:outline-none focus:ring-2 transition-all duration-300 font-chinese`}
                  required
                />
              )}
              {errors.auxiliarySignal && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400 font-chinese">{errors.auxiliarySignal}</p>
              )}
            </div>

            {/* 预约时长 */}
            <div className="bento-card border-l-4 border-l-blue-500 animate-scale-in">
              <div className="flex items-center space-x-3 mb-4">
                <i className="fas fa-hourglass-half text-blue-500"></i>
                <div>
                  <h4 className="text-lg font-bold font-chinese text-gray-900 dark:text-slate-100">预约时长</h4>
                  <p className="text-xs font-mono text-gray-500">BOOKING DURATION</p>
                </div>
              </div>
              <select
                id="auxiliary-duration"
                name="auxiliaryDuration"
                value={isCustomAuxiliaryDuration ? "custom" : auxiliaryDuration}
                onChange={(e) => {
                  if (e.target.value === "custom") {
                    setIsCustomAuxiliaryDuration(true);
                    setAuxiliaryDuration(25);
                  } else {
                    setIsCustomAuxiliaryDuration(false);
                    setAuxiliaryDuration(Number(e.target.value));
                  }
                }}
                className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-2xl px-4 py-3 text-gray-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-300 mb-4 font-chinese"
                required
              >
                {AUXILIARY_DURATION_PRESETS.map((preset) => (
                  <option key={preset} value={preset} className="text-gray-900 dark:text-slate-100 bg-white dark:bg-slate-700">
                    {preset}分钟
                  </option>
                ))}
                <option value="custom" className="text-gray-900 dark:text-slate-100 bg-white dark:bg-slate-700">自定义时长</option>
              </select>
              {isCustomAuxiliaryDuration && (
                <SliderContainer
                  label="自定义预约时长"
                  description="设置预约阶段的持续时间"
                  orientation="vertical"
                  showKeyboardInput={true}
                  keyboardInputProps={{
                    value: auxiliaryDuration,
                    onChange: setAuxiliaryDuration,
                    min: 1,
                    max: 120,
                    unit: '分钟',
                    placeholder: '输入时长'
                  }}
                >
                  <PureDOMSlider
                    id="auxiliary-duration-slider"
                    name="auxiliaryDurationSlider"
                    min={1}
                    max={120}
                    initialValue={auxiliaryDuration}
                    onValueChange={setAuxiliaryDuration}
                    valueFormatter={(v) => `${v}分钟`}
                    debounceMs={50}
                    showValue={true}
                  />
                </SliderContainer>
              )}
              <p className="text-gray-500 text-xs leading-relaxed">
                预约阶段的持续时间，用于准备和调整状态
              </p>
            </div>

            {/* 预约完成条件 */}
            <div className="bento-card border-l-4 border-l-blue-500 animate-scale-in">
              <div className="flex items-center space-x-3 mb-4">
                <i className="fas fa-check-circle text-blue-500"></i>
                <div>
                  <h4 className="text-lg font-bold font-chinese text-gray-900 dark:text-slate-100">预约完成条件</h4>
                  <p className="text-xs font-mono text-gray-500">COMPLETION CONDITION</p>
                </div>
              </div>
              <input
                type="text"
                id="auxiliary-completion-trigger"
                name="auxiliaryCompletionTrigger"
                value={auxiliaryCompletionTrigger}
                onChange={(e) => {
                  setAuxiliaryCompletionTrigger(e.target.value);
                  if (errors.auxiliaryCompletionTrigger && e.target.value.trim()) {
                    setErrors(prev => ({ ...prev, auxiliaryCompletionTrigger: undefined }));
                  }
                }}
                placeholder="例如：打开第一个子任务、准备好工作材料"
                className={`w-full bg-gray-50 dark:bg-slate-700 border ${errors.auxiliaryCompletionTrigger ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-gray-200 dark:border-slate-600 focus:border-blue-500 focus:ring-blue-500/20'} rounded-2xl px-4 py-3 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-400 focus:outline-none focus:ring-2 transition-all duration-300 font-chinese`}
                required
              />
              {errors.auxiliaryCompletionTrigger && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400 font-chinese">{errors.auxiliaryCompletionTrigger}</p>
              )}
              <p className="text-gray-500 text-xs mt-3 leading-relaxed">
                这是你在预约时间内必须完成的动作，标志着正式开始执行任务群
              </p>
            </div>
          </SettingSection>

          {/* 操作按钮区 */}
          <div className={`action-buttons flex ${mobileInfo.isMobile ? 'flex-col space-y-4' : 'flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-6'} animate-scale-in pt-4`}>
            <button
              type="button"
              onClick={onCancel}
              className={`mobile-touch-target flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-900 dark:text-slate-100 px-8 py-4 rounded-2xl font-medium transition-all duration-300 flex items-center justify-center space-x-3 ${mobileInfo.touchSupport ? 'active:scale-98' : 'hover:scale-105'} font-chinese ${mobileInfo.isMobile ? 'min-h-[48px] text-base' : ''}`}
            >
              <span>取消</span>
            </button>
            <button
              type="submit"
              className={`mobile-touch-target flex-1 gradient-primary hover:shadow-xl text-white px-8 py-4 rounded-2xl font-medium transition-all duration-300 flex items-center justify-center space-x-3 ${mobileInfo.touchSupport ? 'active:scale-98' : 'hover:scale-105'} shadow-lg font-chinese ${mobileInfo.isMobile ? 'min-h-[48px] text-base' : ''}`}
            >
              <Save size={20} />
              <span>{isEditing ? '保存更改' : '创建任务群'}</span>
            </button>
          </div>
        </form>
      </ResponsiveContainer>
    </div>
  );
};