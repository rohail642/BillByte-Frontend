import { useQuery } from '@tanstack/react-query'
import { getDashboardSummary } from '../../api/orders'
import { getQrRequests, getQrCalls } from '../../api/tableOrdering'

export function qrBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const o = ctx.createOscillator(); const g = ctx.createGain()
    o.connect(g); g.connect(ctx.destination); o.type = 'sine'
    o.frequency.setValueAtTime(988, ctx.currentTime); o.frequency.setValueAtTime(1319, ctx.currentTime + 0.12)
    g.gain.setValueAtTime(0.35, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    o.start(); o.stop(ctx.currentTime + 0.4)
  } catch { /* no audio */ }
}

// The waiting counts ride on /orders/summary, which the Topbar (and the waiter
// screen) already poll. The lists are only fetched while a count is above zero,
// so a quiet restaurant makes no extra calls.
// pollMs: pass it on screens that don't otherwise poll the summary.
export function usePendingQr({ pollMs } = {}) {
  const { data: summary } = useQuery({
    queryKey: ['summary'], queryFn: getDashboardSummary,
    ...(pollMs ? { refetchInterval: pollMs } : {}),
  })
  const count = summary?.qr_pending || 0
  const callCount = summary?.qr_calls || 0
  const q = useQuery({
    queryKey: ['qrRequests', 'pending'],
    queryFn: () => getQrRequests('pending'),
    enabled: count > 0,
    refetchInterval: count > 0 ? 10000 : false,
  })
  const c = useQuery({
    queryKey: ['qrCalls'],
    queryFn: getQrCalls,
    enabled: callCount > 0,
    refetchInterval: callCount > 0 ? 10000 : false,
  })
  return {
    count, callCount,
    requests: count > 0 ? (q.data || []) : [],
    calls: callCount > 0 ? (c.data || []) : [],
    isLoading: (count > 0 && q.isLoading) || (callCount > 0 && c.isLoading),
  }
}
