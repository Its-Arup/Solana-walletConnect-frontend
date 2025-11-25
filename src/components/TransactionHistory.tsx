import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

interface Transaction {
  _id: string
  txHash: string
  type: 'SOL' | 'SPL_TOKEN'
  tokenMint?: string
  tokenSymbol?: string
  amount: string
  sender: string
  recipient: string
  status: 'pending' | 'confirmed' | 'failed'
  blockTime?: string
  fee?: number
  createdAt: string
}

interface TransactionHistoryProps {
  authToken: string | null
  refreshTrigger?: number
}

export const TransactionHistory = ({ authToken, refreshTrigger }: TransactionHistoryProps) => {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'confirmed' | 'pending' | 'failed'>('all')
  const [stats, setStats] = useState<any>(null)

  const fetchTransactions = async () => {
    if (!authToken) return

    setIsLoading(true)
    setError(null)

    try {
      const statusParam = filter !== 'all' ? `&status=${filter}` : ''
      const response = await fetch(`${API_URL}/api/transactions?limit=50${statusParam}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      })

      const data = await response.json()

      if (data.success) {
        setTransactions(data.data.transactions)
      } else {
        setError(data.message)
      }
    } catch (err: any) {
      console.error('Error fetching transactions:', err)
      setError('Failed to load transactions')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchStats = async () => {
    if (!authToken) return

    try {
      const response = await fetch(`${API_URL}/api/transactions/stats/summary`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      })

      const data = await response.json()

      if (data.success) {
        setStats(data.stats)
      }
    } catch (err) {
      console.error('Error fetching stats:', err)
    }
  }

  useEffect(() => {
    fetchTransactions()
    fetchStats()
  }, [authToken, filter, refreshTrigger])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return '#10b981'
      case 'pending':
        return '#f59e0b'
      case 'failed':
        return '#ef4444'
      default:
        return '#6b7280'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return '✓'
      case 'pending':
        return '⏳'
      case 'failed':
        return '✗'
      default:
        return '?'
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`
  }

  const openExplorer = (txHash: string) => {
    window.open(`https://explorer.solana.com/tx/${txHash}?cluster=devnet`, '_blank')
  }

  return (
    <div style={{
      padding: '20px',
      backgroundColor: '#1a1a1a',
      borderRadius: '12px',
      maxWidth: '900px',
    }}>
      <h2 style={{ fontSize: '20px', marginBottom: '20px', color: '#fff' }}>
        Transaction History
      </h2>

      {/* Stats */}
      {stats && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '10px',
          marginBottom: '20px',
        }}>
          <div style={{
            padding: '12px',
            backgroundColor: '#2a2a2a',
            borderRadius: '8px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#60a5fa' }}>
              {stats.totalTransactions}
            </div>
            <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
              Total
            </div>
          </div>
          <div style={{
            padding: '12px',
            backgroundColor: '#2a2a2a',
            borderRadius: '8px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981' }}>
              {stats.confirmed}
            </div>
            <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
              Confirmed
            </div>
          </div>
          <div style={{
            padding: '12px',
            backgroundColor: '#2a2a2a',
            borderRadius: '8px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f59e0b' }}>
              {stats.pending}
            </div>
            <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
              Pending
            </div>
          </div>
          <div style={{
            padding: '12px',
            backgroundColor: '#2a2a2a',
            borderRadius: '8px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ef4444' }}>
              {stats.failed}
            </div>
            <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
              Failed
            </div>
          </div>
        </div>
      )}

      {/* Filter Buttons */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {['all', 'confirmed', 'pending', 'failed'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status as any)}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              backgroundColor: filter === status ? '#646cff' : '#2a2a2a',
              color: 'white',
              border: `1px solid ${filter === status ? '#646cff' : '#444'}`,
              borderRadius: '8px',
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div style={{ textAlign: 'center', padding: '20px', color: '#888' }}>
          Loading transactions...
        </div>
      )}

      {/* Error State */}
      {error && (
        <div style={{
          padding: '15px',
          backgroundColor: '#ff444420',
          border: '1px solid #ff4444',
          borderRadius: '8px',
          color: '#ff6b6b',
          fontSize: '14px',
        }}>
          {error}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && transactions.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
          <p style={{ fontSize: '16px', marginBottom: '8px' }}>No transactions found</p>
          <p style={{ fontSize: '14px' }}>Start by sending your first transaction!</p>
        </div>
      )}

      {/* Transactions List */}
      {!isLoading && !error && transactions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {transactions.map((tx) => (
            <div
              key={tx._id}
              onClick={() => openExplorer(tx.txHash)}
              style={{
                padding: '15px',
                backgroundColor: '#2a2a2a',
                borderRadius: '8px',
                border: '1px solid #444',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#333'
                e.currentTarget.style.borderColor = '#555'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#2a2a2a'
                e.currentTarget.style.borderColor = '#444'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '10px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{
                      display: 'inline-block',
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      backgroundColor: getStatusColor(tx.status),
                      color: 'white',
                      fontSize: '12px',
                      textAlign: 'center',
                      lineHeight: '20px',
                    }}>
                      {getStatusIcon(tx.status)}
                    </span>
                    <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff' }}>
                      {tx.type === 'SOL' ? 'SOL Transfer' : 'SPL Token Transfer'}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#888' }}>
                    {formatDate(tx.blockTime || tx.createdAt)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#60a5fa' }}>
                    {parseFloat(tx.amount).toFixed(4)} {tx.type === 'SOL' ? 'SOL' : tx.tokenSymbol || 'tokens'}
                  </div>
                  {tx.fee && (
                    <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>
                      Fee: {(tx.fee / 1e9).toFixed(6)} SOL
                    </div>
                  )}
                </div>
              </div>

              <div style={{ fontSize: '12px', color: '#ccc', marginBottom: '6px' }}>
                <span style={{ color: '#888' }}>To:</span> {truncateAddress(tx.recipient)}
              </div>

              <div style={{ fontSize: '12px', color: '#888' }}>
                <span>Signature:</span> {truncateAddress(tx.txHash)}
              </div>

              {tx.tokenMint && (
                <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
                  <span>Token:</span> {truncateAddress(tx.tokenMint)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
