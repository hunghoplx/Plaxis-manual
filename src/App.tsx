import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, 
  BookOpen, 
  MessageSquare, 
  ChevronRight, 
  Cpu,
  RefreshCcw,
  Terminal,
  Info
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { chatWithAgent, Message, MANUALS } from './services/geminiService';
import { YieldSurfacePlot } from './components/YieldSurfacePlot';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    { 
      role: "model", 
      content: "Hello! I am your Material Science AI Agent. I can help you with material models, yield surfaces, and technical tutorials. How can I assist you today?" 
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeManual, setActiveManual] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await chatWithAgent([...messages, userMessage]);
      const content = response.text || "I'm sorry, I couldn't process that.";
      
      let plotData = null;
      if (response.functionCalls) {
        const call = response.functionCalls[0];
        if (call.name === "visualize_yield_surface") {
          plotData = {
            model_id: call.args.model_id,
            parameters: call.args.parameters || {},
            compare_with: call.args.compare_with
          };
        }
      }

      setMessages(prev => [...prev, { role: "model", content, plotData }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: "model", content: "Error: Failed to connect to the AI service." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#F8F9FB] text-slate-900 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-80 border-r border-slate-200 bg-white flex flex-col">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
            <Cpu size={24} />
          </div>
          <div>
            <h1 className="font-bold text-slate-800 tracking-tight">YieldSurface AI</h1>
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Technical Agent</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-6">
          <div>
            <div className="flex items-center gap-2 px-2 mb-3 text-slate-400">
              <BookOpen size={14} />
              <span className="text-[11px] font-bold uppercase tracking-wider">Technical Manuals</span>
            </div>
            <div className="space-y-1">
              {MANUALS.map(manual => (
                <button
                  key={manual.id}
                  onClick={() => setActiveManual(activeManual === manual.id ? null : manual.id)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center justify-between group",
                    activeManual === manual.id 
                      ? "bg-indigo-50 text-indigo-700 font-medium" 
                      : "text-slate-600 hover:bg-slate-50"
                  )}
                >
                  <span>{manual.title}</span>
                  <ChevronRight size={14} className={cn("transition-transform", activeManual === manual.id && "rotate-90")} />
                </button>
              ))}
            </div>
          </div>

          <AnimatePresence>
            {activeManual && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="p-4 bg-slate-50 rounded-xl border border-slate-100"
              >
                <div className="flex items-center gap-2 mb-2 text-indigo-600">
                  <Info size={14} />
                  <span className="text-xs font-bold uppercase">Quick Ref</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed mb-3">
                  {MANUALS.find(m => m.id === activeManual)?.content}
                </p>
                <div className="p-2 bg-white rounded border border-slate-200 font-mono text-[10px] text-slate-500 break-all">
                  {MANUALS.find(m => m.id === activeManual)?.formula}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="bg-slate-900 rounded-xl p-4 text-white">
            <div className="flex items-center gap-2 mb-2">
              <Terminal size={14} className="text-emerald-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">System Status</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-medium">Agent Active</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative">
        {/* Chat Area */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-8 space-y-8 scroll-smooth"
        >
          {messages.map((msg, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "flex gap-4 max-w-4xl",
                msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm",
                msg.role === "user" ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-indigo-600"
              )}>
                {msg.role === "user" ? <MessageSquare size={16} /> : <Cpu size={16} />}
              </div>
              
              <div className="space-y-4 flex-1">
                <div className={cn(
                  "p-4 rounded-2xl text-sm leading-relaxed shadow-sm border",
                  msg.role === "user" 
                    ? "bg-indigo-600 text-white border-indigo-500 rounded-tr-none" 
                    : "bg-white text-slate-700 border-slate-100 rounded-tl-none"
                )}>
                  <div className="markdown-body">
                    <ReactMarkdown>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                </div>

                {msg.plotData && (
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                  >
                    <YieldSurfacePlot 
                      modelId={msg.plotData.model_id} 
                      parameters={msg.plotData.parameters || {}} 
                    />
                  </motion.div>
                )}
              </div>
            </motion.div>
          ))}
          {isLoading && (
            <div className="flex gap-4 mr-auto">
              <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-indigo-600 flex items-center justify-center">
                <RefreshCcw size={16} className="animate-spin" />
              </div>
              <div className="p-4 bg-white rounded-2xl rounded-tl-none border border-slate-100 shadow-sm">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" />
                  <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-8 bg-gradient-to-t from-[#F8F9FB] via-[#F8F9FB] to-transparent">
          <div className="max-w-4xl mx-auto relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask about material models or request a yield surface plot..."
              className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-6 pr-16 shadow-xl shadow-slate-200/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="absolute right-2 top-2 bottom-2 w-12 bg-indigo-600 text-white rounded-xl flex items-center justify-center hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-200"
            >
              <Send size={18} />
            </button>
          </div>
          <p className="text-center mt-4 text-[10px] text-slate-400 font-medium uppercase tracking-widest">
            Powered by Gemini 3 Flash • Technical Engineering Agent
          </p>
        </div>
      </main>
    </div>
  );
}
