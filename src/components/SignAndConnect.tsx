import { useAppKit, useAppKitAccount, useAppKitProvider, useDisconnect } from '@reown/appkit/react'
import { useEffect, useState, useCallback, useRef } from 'react'
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'

export const SignAndConnect = () => {
  const { open } = useAppKit()
  const { address, isConnected } = useAppKitAccount()
  const { walletProvider } = useAppKitProvider('solana')
  const { disconnect } = useDisconnect()
  const [isSigned, setIsSigned] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [balance, setBalance] = useState<number | null>(null)
  const userDisconnectedRef = useRef(false)

  // Load signed state from localStorage on mount
  useEffect(() => {
    if (address) {
      const signedState = localStorage.getItem(`wallet_signed_${address}`)
      if (signedState === 'true') {
        setIsSigned(true)
      }
    }
  }, [address])
  

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
      const provider = walletProvider as any
      const signature = await provider.signMessage(encodedMessage)
      
      if (signature) {
        console.log('Message signed successfully!')
        console.log('Signature:', signature)
        setIsSigned(true)
        // Persist signed state to localStorage
        localStorage.setItem(`wallet_signed_${address}`, 'true')
      }
    } catch (error) {
      console.error('Error signing message:', error)
      // User rejected signature, disconnect wallet
      const provider = walletProvider as any
      if (provider.disconnect) {
        await provider.disconnect()
      }
    } finally {
      setIsLoading(false)
    }
  }, [walletProvider, address])

  useEffect(() => {
    if (isConnected && !isSigned && walletProvider && address && !userDisconnectedRef.current) {
      // Check if already signed
      const signedState = localStorage.getItem(`wallet_signed_${address}`)
      if (signedState !== 'true') {
        handleSignMessage()
      }
    }
  }, [isConnected, walletProvider, isSigned, handleSignMessage, address])

  // Clear signed state when wallet disconnects
  useEffect(() => {
    if (!isConnected) {
      if (address) {
        localStorage.removeItem(`wallet_signed_${address}`)
      }
      setIsSigned(false)
    } else {
      // Reset the flag when user reconnects
      userDisconnectedRef.current = false
    }
  }, [isConnected, address])

  const handleConnect = () => {
    setIsSigned(false)
    userDisconnectedRef.current = false
    open()
  }

  const handleDisconnect = async () => {
    if (address) {
      localStorage.removeItem(`wallet_signed_${address}`)
    }
    setIsSigned(false)
    userDisconnectedRef.current = true
    // Use AppKit's disconnect method
    await disconnect()
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
              <p style={{ color: '#4ade80' }}>✓ Wallet Connected & Authenticated</p>
              <p style={{ fontSize: '14px', marginTop: '8px' }}>
                <strong>Address:</strong> {address?.slice(0, 4)}...{address?.slice(-4)}
              </p>
              {balance !== null && (
                <p style={{ fontSize: '16px', marginTop: '8px', color: '#60a5fa' }}>
                  <strong>Balance:</strong> {balance.toFixed(4)} SOL
                </p>
              )}
              <button 
                onClick={handleDisconnect}
                style={{
                  marginTop: '10px',
                  padding: '8px 16px',
                  fontSize: '14px',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                Disconnect
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
