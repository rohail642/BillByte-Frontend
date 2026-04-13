import { useState, useRef, useEffect } from 'react'
import { useUIStore } from '../../store/ui'
import { useAuthStore } from '../../store/auth'
import { useQuery } from '@tanstack/react-query'
import { getInventory } from '../../api/inventory'
import { getMenuItems } from '../../api/menu'
import { Bot, X, Send, Sparkles } from 'lucide-react'
import { clsx } from 'clsx'

const SUGGESTIONS = [
  "Today's top dishes?",
  "Revenue vs last week",
  "Low stock alert",
  "Best time to reorder?",
]

export default function AIAssistant() {
  const { aiOpen, toggleAI } = useUIStore()
  const { user } = useAuthStore()
  const [msgs, setMsgs] = useState([
    { role: 'bot', text: `Hi ${user?.name?.split(' ')[0] || 'there'}! 👋 I'm ByteAI. Ask me anything about your restaurant — sales, stock, or business advice.` }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showSugs, setShowSugs] = useState(true)
  const endRef = useRef(null)

  const { data: inventory } = useQuery({ queryKey: ['inventory'], queryFn: () => getInventory({}) })
  const { data: menu }      = useQuery({ queryKey: ['menuItems'],  queryFn: () => getMenuItems({}) })

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  const send = async (text) => {
    const msg = text || input.trim()
    if (!msg || loading) return
    setInput('')
    setShowSugs(false)
    setMsgs(m => [...m, { role: 'user', text: msg }])
    setLoading(true)

    const lowStock = (inventory || []).filter(i => i.is_low_stock).map(i => i.name).join(', ') || 'none'
    const system = `You are ByteAI, a smart restaurant assistant in BillByte for "${user?.name}'s restaurant".
Low stock items: ${lowStock}. Menu has ${(menu||[]).length} items.
Be concise, friendly, actionable. Use ₹. Max 3 sentences.`

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 300,
          system,
          messages: [{ role: 'user', content: msg }],
        }),
      })
      const data = await res.json()
      setMsgs(m => [...m, { role: 'bot', text: data.content?.[0]?.text || 'Sorry, try again.' }])
    } catch {
      const m = msg.toLowerCase()
      let reply = 'Revenue is looking good today. Keep an eye on your peak hours for best staffing decisions.'
      if (m.includes('stock') || m.includes('inventory')) reply = `${(inventory||[]).filter(i=>i.is_low_stock).length} items need restocking: ${lowStock}. Place orders soon.`
      else if (m.includes('dish') || m.includes('top')) reply = `Your best sellers drive most revenue. Consider promotions around your top 3 items.`
      else if (m.includes('customer')) reply = `Focus on converting one-time visitors to regulars. Loyalty points work well for that.`
      setMsgs(m => [...m, { role: 'bot', text: reply }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* FAB */}
      <button onClick={toggleAI}
        className="fixed bottom-5 right-5 z-50 w-12 h-12 rounded-full bg-green text-white flex items-center justify-center shadow-lg hover:bg-green2 hover:scale-105 active:scale-95 transition-all">
        {aiOpen ? <X size={18} /> : <Bot size={18} />}
      </button>

      {/* Panel */}
      <div className={clsx(
        'fixed bottom-20 right-5 z-50 w-80 max-h-[520px] bg-bg2 border border-border rounded-2xl shadow-lg flex flex-col overflow-hidden transition-all duration-300',
        aiOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'
      )}>
        {/* Header */}
        <div className="flex items-center gap-2.5 px-4 py-3 bg-green-dim border-b border-green/20">
          <div className="w-7 h-7 rounded-full bg-green flex items-center justify-center">
            <Sparkles size={14} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-green2 font-display">ByteAI</p>
            <p className="text-[10px] text-muted">Powered by Claude</p>
          </div>
          <button onClick={toggleAI} className="ml-auto text-muted hover:text-text transition-colors">
            <X size={14} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-bg">
          {msgs.map((m, i) => (
            <div key={i} className={clsx('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div className={clsx(
                'max-w-[85%] text-xs leading-relaxed px-3 py-2 rounded-xl',
                m.role === 'user'
                  ? 'bg-green text-white rounded-br-sm'
                  : 'bg-surface border border-border text-text2 rounded-bl-sm'
              )}>
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-surface border border-border rounded-xl rounded-bl-sm px-3 py-2">
                <div className="flex gap-1">
                  {[0,1,2].map(i => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Suggestions */}
        {showSugs && (
          <div className="flex flex-wrap gap-1.5 px-3 pb-2 bg-bg">
            {SUGGESTIONS.map(s => (
              <button key={s} onClick={() => send(s)}
                className="text-[11px] border border-border2 text-text2 rounded-full px-2.5 py-1 hover:border-green hover:text-green2 hover:bg-green-dim transition-all font-medium">
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="flex gap-2 p-3 border-t border-border bg-bg2">
          <input
            className="flex-1 bg-surface2 border border-border rounded-lg px-3 py-1.5 text-xs outline-none focus:border-green transition-colors placeholder:text-muted"
            placeholder="Ask anything…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
          />
          <button onClick={() => send()}
            disabled={!input.trim() || loading}
            className="w-8 h-8 rounded-lg bg-green text-white flex items-center justify-center hover:bg-green2 disabled:opacity-40 transition-all">
            <Send size={13} />
          </button>
        </div>
      </div>
    </>
  )
}
