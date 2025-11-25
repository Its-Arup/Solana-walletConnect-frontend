import { useAppKit, useAppKitAccount, useAppKitProvider, useDisconnect } from '@reown/appkit/react'
import { useEffect, useState, useCallback, useRef } from 'react'
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import bs58 from 'bs58'
import { TokenTransfer } from './TokenTransfer'
import { TransactionHistory } from './TransactionHistory'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export const SignAndConnect = () => {
  const { open } = useAppKit()
  const { address, isConnected } = useAppKitAccount()
  const { walletProvider } = useAppKitProvider('solana')
  const { disconnect } = useDisconnect()
  const [isSigned, setIsSigned] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [balance, setBalance] = useState<number | null>(null)
  const [user, setUser] = useState<{
    walletAddress: string
    createdAt: string
    lastLoginAt: string
    isNewUser?: boolean
  } | null>(null)
  const [authToken, setAuthToken] = useState<string | null>(() => {
    // Initialize from sessionStorage on mount
    return sessionStorage.getItem('authToken')
  })
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const userDisconnectedRef = useRef(false)

  // Load and verify existing session on mount
  useEffect(() => {
    const verifySession = async () => {
      const storedToken = sessionStorage.getItem('authToken')
      
      if (storedToken && isConnected && address) {
        try {
          const response = await fetch(`${API_URL}/api/auth/me`, {
            headers: {
              'Authorization': `Bearer ${storedToken}`,
            },
          })
          
          if (response.ok) {
            const data = await response.json()
            
            // ⭐ IMPORTANT: Check if the connected wallet matches the token's wallet
            if (data.user.walletAddress.toLowerCase() === address.toLowerCase()) {
              setUser(data.user)
              setIsSigned(true)
              setAuthToken(storedToken)
              console.log('✅ Session restored from sessionStorage')
            } else {
              // Wallet address changed - clear old session and require new sign-in
              console.log('⚠️ Wallet address mismatch - requiring new authentication')
              sessionStorage.removeItem('authToken')
              setAuthToken(null)
              setIsSigned(false)
              setUser(null)
            }
          } else {
            // Token is invalid, clear it
            sessionStorage.removeItem('authToken')
            setAuthToken(null)
            setIsSigned(false)
            setUser(null)
          }
        } catch (error) {
          console.error('Session verification error:', error)
          sessionStorage.removeItem('authToken')
          setAuthToken(null)
          setIsSigned(false)
        }
      }
    }

    if (isConnected && !userDisconnectedRef.current) {
      verifySession()
    }
  }, [isConnected, address])

  // Check if wallet address changed while connected
  useEffect(() => {
    if (isConnected && address && isSigned && user) {
      // If the current connected address doesn't match the authenticated user's address
      if (address.toLowerCase() !== user.walletAddress.toLowerCase()) {
        console.log('🔄 Wallet address changed - clearing session and requiring new authentication')
        // Clear authentication
        sessionStorage.removeItem('authToken')
        setAuthToken(null)
        setIsSigned(false)
        setUser(null)
        setBalance(null)
      }
    }
  }, [address, isConnected, isSigned, user])


  // Fetch balance when connected and signed
  useEffect(() => {
    const fetchBalance = async () => {
      if (isConnected && address && isSigned) {
        try {
          // Connect to Solana devnet
          const connection = new Connection('https://api.devnet.solana.com', 'confirmed')
          const publicKey = new PublicKey(address)
          const bal = await connection.getBalance(publicKey)
          setBalance(bal / LAMPORTS_PER_SOL)
        } catch (error) {
          console.error('Error fetching balance:', error)
          setBalance(null)
        }
      } else {
        setBalance(null)
      }
    }

    fetchBalance()
  }, [isConnected, address, isSigned])

  const handleSignMessage = useCallback(async () => {
    if (!walletProvider || !address) return

    setIsLoading(true)
    try {
      const message = `Sign this message to authenticate with Solana Wallet Connect.\n\nWallet: ${address}\nTimestamp: ${new Date().toISOString()}`
      const encodedMessage = new TextEncoder().encode(message)
      
      // Request signature from the wallet
      const provider = walletProvider as {
        signMessage: (message: Uint8Array) => Promise<Uint8Array>
        disconnect?: () => Promise<void>
      }
      const signatureUint8 = await provider.signMessage(encodedMessage)
      
      if (signatureUint8) {
        // Convert signature to base58
        const signature = bs58.encode(signatureUint8)
        console.log('Message signed successfully!')
        console.log('Signature:', signature)
        
        // Send to backend for verification
        const response = await fetch(`${API_URL}/api/auth/verify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            walletAddress: address,
            message,
            signature,
          }),
        })
        
        const data = await response.json()
        
        if (data.success) {
          console.log(data.message)
          setUser(data.user)
          setAuthToken(data.token)
          // Persist JWT token to sessionStorage
          sessionStorage.setItem('authToken', data.token)
          setIsSigned(true)
          
          if (data.user.isNewUser) {
            console.log('🎉 Welcome! New user created.')
          } else {
            console.log('👋 Welcome back!')
          }
        } else {
          console.error('Backend verification failed:', data.message)
          alert('Signature verification failed')
        }
      }
    } catch (error) {
      console.error('Error signing message:', error)
      // User rejected signature, disconnect wallet
      const provider = walletProvider as {
        disconnect?: () => Promise<void>
      }
      if (provider.disconnect) {
        await provider.disconnect()
      }
    } finally {
      setIsLoading(false)
    }
  }, [walletProvider, address])

  useEffect(() => {
    if (isConnected && !isSigned && walletProvider && address && !userDisconnectedRef.current && !authToken) {
      // Only prompt for signature if no valid token
      handleSignMessage()
    }
  }, [isConnected, walletProvider, isSigned, handleSignMessage, address, authToken])

  // Clear signed state when wallet disconnects
  useEffect(() => {
    if (!isConnected && userDisconnectedRef.current) {
      // Only clear session if user explicitly disconnected
      sessionStorage.removeItem('authToken')
      setIsSigned(false)
      setAuthToken(null)
      setUser(null)
    } else if (!isConnected && !userDisconnectedRef.current) {
      // Wallet disconnected unexpectedly, keep token for reconnection
      userDisconnectedRef.current = false
    }
  }, [isConnected, address])

  const handleConnect = () => {
    setIsSigned(false)
    userDisconnectedRef.current = false
    open()
  }

  const handleDisconnect = async () => {
    // Clear all auth state
    sessionStorage.removeItem('authToken')
    setIsSigned(false)
    setUser(null)
    setAuthToken(null)
    userDisconnectedRef.current = true
    // Use AppKit's disconnect method
    await disconnect()
  }

  const handleTransactionComplete = () => {
    // Refresh transaction history
    setRefreshTrigger(prev => prev + 1)
    
    // Refresh balance
    if (address) {
      const fetchBalance = async () => {
        try {
          const connection = new Connection('https://api.devnet.solana.com', 'confirmed')
          const publicKey = new PublicKey(address)
          const bal = await connection.getBalance(publicKey)
          setBalance(bal / LAMPORTS_PER_SOL)
        } catch (error) {
          console.error('Error fetching balance:', error)
        }
      }
      fetchBalance()
    }
  }

  return (
    <div style={{ padding: '20px' }}>
      {!isConnected ? (
        <button 
          onClick={handleConnect}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            backgroundColor: '#646cff',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          Connect Wallet
        </button>
      ) : (
        <div>
          {isLoading ? (
            <p>Please sign the message in your wallet...</p>
          ) : isSigned ? (
            <div>
              <p style={{ color: '#4ade80' }}>
                ✓ Wallet Connected & Authenticated
                {user?.isNewUser && <span style={{ marginLeft: '8px' }}>🎉 New User!</span>}
              </p>
              <p style={{ fontSize: '14px', marginTop: '8px' }}>
                <strong>Address:</strong> {address?.slice(0, 4)}...{address?.slice(-4)}
              </p>
              {balance !== null && (
                <p style={{ fontSize: '16px', marginTop: '8px', color: '#60a5fa' }}>
                  <strong>Balance:</strong> {balance.toFixed(4)} SOL
                </p>
              )}
              {user && (
                <p style={{ fontSize: '12px', marginTop: '8px', color: '#888' }}>
                  Member since: {new Date(user.createdAt).toLocaleDateString()}
                </p>
              )}
              
              {/* Token Transfer Component */}
              <div style={{ marginTop: '20px' }}>
                <TokenTransfer 
                  authToken={authToken}
                  onTransactionComplete={handleTransactionComplete}
                />
              </div>

              {/* Transaction History Component */}
              <div style={{ marginTop: '20px' }}>
                <TransactionHistory 
                  authToken={authToken}
                  refreshTrigger={refreshTrigger}
                />
              </div>

              <button 
                onClick={handleDisconnect}
                style={{
                  marginTop: '20px',
                  padding: '10px 20px',
                  fontSize: '14px',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                Disconnect Wallet
              </button>
            </div>
          ) : (
            <p>Waiting for signature...</p>
          )}
        </div>
      )}
    </div>
  )
}
