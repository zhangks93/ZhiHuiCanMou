// Configuration Prompt Component - shown when LLM not configured

import { Bot, Settings, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export function ConfigurationPrompt() {
  const navigate = useNavigate()

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <div className="p-4 bg-primary/10 rounded-full">
            <Bot size={48} className="text-primary" />
          </div>
        </div>

        <h2 className="text-xl font-semibold text-gray-800 mb-3">
          AI 分析功能需要配置
        </h2>

        <p className="text-gray-600 mb-6 leading-relaxed">
          智能分析功能需要配置 AI 模型才能使用。
          <br />
          请前往设置页面配置 OpenAI 或 Claude API。
        </p>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 text-left">
          <div className="text-sm text-gray-700 font-medium mb-2">配置步骤：</div>
          <ol className="text-sm text-gray-600 space-y-1.5 list-decimal list-inside">
            <li>前往设置页面</li>
            <li>选择模型提供商（OpenAI 或 Claude）</li>
            <li>输入 API Key</li>
            <li>保存配置</li>
            <li>返回此页面开始使用</li>
          </ol>
        </div>

        <button
          onClick={() => navigate('/settings')}
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-700 transition-colors shadow-sm font-medium"
        >
          <Settings size={18} />
          前往设置
          <ArrowRight size={18} />
        </button>

        <div className="mt-6 text-xs text-gray-500">
          配置完成后，此页面将自动激活
        </div>
      </div>
    </div>
  )
}
