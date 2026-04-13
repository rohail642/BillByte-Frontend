import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getOrders, updateStatus } from '../api/orders'
import toast from 'react-hot-toast'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Spinner from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import { Check, X, CheckCheck } from 'lucide-react'
import { formatINR, timeAgo } from '../utils'

export default function OnlineOrders() {
  const qc = useQueryClient()
  const refetch = () => qc.invalidateQueries({ queryKey: ['onlineOrders'] })

  const { data: orders, isLoading } = useQuery({
    queryKey: ['onlineOrders'],
    queryFn: () => getOrders({ order_type: 'delivery', limit: 50 }),
    refetchInterval: 20000,
  })

  const statusMut = useMutation({
    mutationFn: ({ id, status }) => updateStatus(id, status),
    onSuccess: (_, { status }) => {
      toast.success(status === 'cancelled' ? '❌ Order rejected' : status === 'preparing' ? '✅ Order accepted!' : '✅ Order completed!')
      refetch()
    },
    onError: e => toast.error(String(e)),
  })

  const pending  = (orders || []).filter(o => o.status === 'pending')
  const accepted = (orders || []).filter(o => ['preparing', 'kot_sent', 'ready'].includes(o.status))
  const done     = (orders || []).filter(o => ['paid', 'served'].includes(o.status)).slice(0, 5)

  const OrderCard = ({ order, actions }) => (
    <div className={`border rounded-xl p-4 transition-all ${order.status === 'pending' ? 'border-orange/30 bg-orange-dim/30' : 'border-border bg-surface2'}`}>
      <div className="flex items-start justify-between mb-2.5">
        <div>
          <p className="font-display font-bold text-sm text-text">{order.platform || 'Direct'} · {order.order_number}</p>
          <p className="text-[11px] text-muted">{timeAgo(order.created_at)}</p>
        </div>
        <Badge color={order.status === 'pending' ? 'orange' : order.status === 'paid' ? 'green' : 'blue'}>
          {order.status.replace('_', ' ')}
        </Badge>
      </div>
      <p className="text-xs text-text2 mb-3 leading-relaxed">
        {order.items?.map(i => `${i.name} ×${i.quantity}`).join(', ')}
      </p>
      <div className="flex items-center justify-between">
        <p className="font-display font-bold text-base text-green2">{formatINR(order.total_amount)}</p>
        {actions && (
          <div className="flex gap-1.5">
            {actions}
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="space-y-4 h-full overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-text">Online Orders</h2>
          <p className="text-xs text-muted mt-0.5">Auto-refreshes every 20 seconds</p>
        </div>
        <div className="flex items-center gap-1.5 bg-green-dim border border-green/25 text-green2 rounded-full px-3 py-1 text-xs font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" />
          {pending.length} pending
        </div>
      </div>

      {isLoading
        ? <div className="flex justify-center py-20"><Spinner size="lg" /></div>
        : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Pending */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Badge color="orange" dot>Pending</Badge>
                <span className="text-xs text-muted">{pending.length} need action</span>
              </div>
              <div className="space-y-3">
                {pending.length === 0
                  ? <Card><EmptyState icon="🛵" title="No pending orders" description="New orders will appear here" /></Card>
                  : pending.map(o => (
                    <OrderCard key={o.id} order={o} actions={<>
                      <Button variant="danger" size="sm" icon={<X size={13} />}
                        loading={statusMut.isPending} onClick={() => statusMut.mutate({ id: o.id, status: 'cancelled' })}>
                        Reject
                      </Button>
                      <Button variant="primary" size="sm" icon={<Check size={13} />}
                        loading={statusMut.isPending} onClick={() => statusMut.mutate({ id: o.id, status: 'preparing' })}>
                        Accept
                      </Button>
                    </>} />
                  ))}
              </div>
            </div>

            {/* Accepted / Preparing */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Badge color="blue" dot>Preparing</Badge>
                <span className="text-xs text-muted">{accepted.length} in kitchen</span>
              </div>
              <div className="space-y-3">
                {accepted.length === 0
                  ? <Card><EmptyState icon="🍳" title="Nothing cooking" description="Accepted orders appear here" /></Card>
                  : accepted.map(o => (
                    <OrderCard key={o.id} order={o} actions={
                      <Button variant="secondary" size="sm" icon={<CheckCheck size={13} />}
                        loading={statusMut.isPending} onClick={() => statusMut.mutate({ id: o.id, status: 'paid' })}>
                        Mark Done
                      </Button>
                    } />
                  ))}
              </div>
            </div>

            {/* Completed */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Badge color="green" dot>Completed</Badge>
                <span className="text-xs text-muted">Recent</span>
              </div>
              <div className="space-y-3">
                {done.length === 0
                  ? <Card><EmptyState icon="✅" title="No completed orders" description="Completed orders appear here" /></Card>
                  : done.map(o => <OrderCard key={o.id} order={o} />)
                }
              </div>
            </div>
          </div>
        )}
    </div>
  )
}
