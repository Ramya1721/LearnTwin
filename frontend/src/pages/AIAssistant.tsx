import { FormEvent, useRef, useState, useEffect } from "react";
import { Send, Bot, User as UserIcon } from "lucide-react";
import { DashboardLayout } from "../layouts/DashboardLayout";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";

interface Message {
  role: "user" | "assistant";
  text: string;
}

const SUGGESTED_QUESTIONS = [
  "Why did my learning path change?",
  "Why am I struggling with this topic?",
  "What should I learn next?",
  "Am I ready to move forward?",
];

export default function AIAssistantPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "Hi! I'm your LearnTwin assistant. I can see your Digital Twin — ask me why your path changed, where you're struggling, or what to learn next.",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(question: string) {
    if (!question.trim() || sending) return;
    setMessages((m) => [...m, { role: "user", text: question }]);
    setInput("");
    setSending(true);
    try {
      const res = await api.post("/ai/ask", { question });
      setMessages((m) => [...m, { role: "assistant", text: res.data.answer }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: "Something went wrong reaching your Digital Twin. Try again." }]);
    } finally {
      setSending(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  return (
    <DashboardLayout title="AI Learning Assistant" subtitle="Grounded in your actual Digital Twin data — not generic advice.">
      <div className="flex flex-col h-[600px] overflow-hidden bg-graphite-800/60 border border-graphite-600 rounded-xl shadow-panel">
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  m.role === "assistant" ? "bg-twin-soft text-twin" : "bg-graphite-600 text-mist-200"
                }`}
              >
                {m.role === "assistant" ? <Bot size={15} /> : <UserIcon size={15} />}
              </div>
              <div
                className={`max-w-[75%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                  m.role === "assistant"
                    ? "bg-graphite-900/80 border border-graphite-700 text-mist-100"
                    : "bg-signal-soft text-mist-50 border border-signal-dim/30"
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-twin-soft text-twin flex items-center justify-center">
                <Bot size={15} />
              </div>
              <div className="bg-graphite-900/80 border border-graphite-700 rounded-xl px-4 py-2.5 text-sm text-mist-400 font-mono">
                Reading your Digital Twin…
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-graphite-700 p-4">
          <div className="flex flex-wrap gap-2 mb-3">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                className="text-xs px-3 py-1.5 rounded-full bg-graphite-800 border border-graphite-600 text-mist-300 hover:bg-graphite-700 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Ask about ${user?.name?.split(" ")[0] || "your"} learning journey…`}
              className="flex-1 bg-graphite-900 border border-graphite-600 rounded-lg px-4 py-2.5 text-sm text-mist-50 placeholder:text-mist-500 outline-none focus:border-signal-dim"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="px-4 py-2.5 rounded-lg bg-signal text-graphite-950 disabled:opacity-50 hover:bg-signal-dim transition-colors"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}
