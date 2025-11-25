import { useState, useEffect } from 'react'
import { useAppKitProvider, useAppKitAccount } from '@reown/appkit/react'
import { Connection, PublicKey, LAMPORTS_PER_SOL, Transaction, SystemProgram } from '@solana/web3.js'
import { getAssociatedTokenAddress, createTransferInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

interface TokenTransferProps {
  authToken: string | null
  onTransactionComplete?: () => void
}

export const TokenTransfer = ({ authToken, onTransactionComplete }: TokenTransferProps) => {
  const { walletProvider } = useAppKitProvider('solana')
  const { address } = useAppKitAccount()
  const [transferType, setTransferType] = useState<'SOL' | 'SPL'>('SOL')
  const [recipientAddress, setRecipientAddress] = useState('')
  const [amount, setAmount] = useState('')
  const [tokenMint, setTokenMint] = useState('')
  const [isTransferring, setIsTransferring] = useState(false)
  const [balance, setBalance] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Fetch balance
  useEffect(() => {
    const fetchBalance = async () => {
      if (address) {
        try {
          const connection = new Connection('https://api.devnet.solana.com', 'confirmed')
          const publicKey = new PublicKey(address)
          const bal = await connection.getBalance(publicKey)
          setBalance(bal / LAMPORTS_PER_SOL)
        } catch (error) {
          console.error('Error fetching balance:', error)
        }
      }
    }
    fetchBalance()
  }, [address])

  const validateInputs = (): boolean => {
    setError(null)

    if (!recipientAddress.trim()) {
      setError('Recipient address is required')
      return false
    }

    try {
      new PublicKey(recipientAddress)
    } catch {
      setError('Invalid recipient address')
      return false
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError('Amount must be greater than 0')
      return false
    }

    if (transferType === 'SPL' && !tokenMint.trim()) {
      setError('Token mint address is required for SPL transfers')
      return false
    }

    if (transferType === 'SPL') {
      try {
        new PublicKey(tokenMint)
      } catch {
        setError('Invalid token mint address')
        return false
      }
    }

    if (transferType === 'SOL' && balance !== null && parseFloat(amount) > balance) {
      setError(`Insufficient balance. You have ${balance.toFixed(4)} SOL`)
      return false
    }

    return true
  }

  const handleTransferSOL = async () => {
    if (!walletProvider || !address) return

    try {
      const connection = new Connection('https://api.devnet.solana.com', 'confirmed')
      const senderPublicKey = new PublicKey(address)
      const recipientPublicKey = new PublicKey(recipientAddress)

      // Create SOL transfer transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: senderPublicKey,
          toPubkey: recipientPublicKey,
          lamports: parseFloat(amount) * LAMPORTS_PER_SOL,
        })
      )

      // Get recent blockhash
      const { blockhash } = await connection.getLatestBlockhash()
      transaction.recentBlockhash = blockhash
      transaction.feePayer = senderPublicKey

      // Sign and send transaction
      const provider = walletProvider as any
      const signedTransaction = await provider.signTransaction(transaction)
      const signature = await connection.sendRawTransaction(signedTransaction.serialize())

      console.log('SOL Transfer sent:', signature)

      // Wait for confirmation
      await connection.confirmTransaction(signature, 'confirmed')

      console.log('SOL Transfer confirmed:', signature)

      // Verify with backend
      await verifyTransactionWithBackend(signature, null, recipientAddress)

      return signature
    } catch (error: any) {
      console.error('SOL Transfer error:', error)
      throw error
    }
  }

  const handleTransferSPL = async () => {
    if (!walletProvider || !address) return

    try {
      const connection = new Connection('https://api.devnet.solana.com', 'confirmed')
      const mintPublicKey = new PublicKey(tokenMint)
      const senderPublicKey = new PublicKey(address)
      const recipientPublicKey = new PublicKey(recipientAddress)

      // Get token accounts
      const senderTokenAccount = await getAssociatedTokenAddress(
        mintPublicKey,
        senderPublicKey
      )

      const recipientTokenAccount = await getAssociatedTokenAddress(
        mintPublicKey,
        recipientPublicKey
      )

      // Amount in smallest units (assuming 9 decimals)
      const transferAmount = parseFloat(amount) * Math.pow(10, 9)

      // Create transfer instruction
      const transferInstruction = createTransferInstruction(
        senderTokenAccount,
        recipientTokenAccount,
        senderPublicKey,
        transferAmount,
        [],
        TOKEN_PROGRAM_ID
      )

      // Create transaction
      const transaction = new Transaction().add(transferInstruction)

      // Get recent blockhash
      const { blockhash } = await connection.getLatestBlockhash()
      transaction.recentBlockhash = blockhash
      transaction.feePayer = senderPublicKey

      // Sign and send transaction
      const provider = walletProvider as any
      const signedTransaction = await provider.signTransaction(transaction)
      const signature = await connection.sendRawTransaction(signedTransaction.serialize())

      console.log('SPL Token Transfer sent:', signature)

      // Wait for confirmation
      await connection.confirmTransaction(signature, 'confirmed')

      console.log('SPL Token Transfer confirmed:', signature)

      // Verify with backend
      await verifyTransactionWithBackend(signature, tokenMint, recipientAddress)

      return signature
    } catch (error: any) {
      console.error('SPL Transfer error:', error)
      throw error
    }
  }

  const verifyTransactionWithBackend = async (
    txHash: string,
    tokenMint: string | null,
    recipient: string
  ) => {
    try {
      const response = await fetch(`${API_URL}/api/transactions/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          txHash,
          tokenMint,
          recipient,
        }),
      })

      const data = await response.json()

      if (data.success) {
        console.log('Transaction verified and stored in backend')
        return data.transaction
      } else {
        console.error('Backend verification failed:', data.message)
      }
    } catch (error) {
      console.error('Error verifying with backend:', error)
    }
  }

  const handleTransfer = async () => {
    if (!validateInputs()) return

    setIsTransferring(true)
    setError(null)

    try {
      let signature: string

      if (transferType === 'SOL') {
        signature = await handleTransferSOL()
      } else {
        signature = await handleTransferSPL()
      }

      // Clear form
      setRecipientAddress('')
      setAmount('')
      setTokenMint('')

      // Show success message
      alert(`Transfer successful!\nSignature: ${signature.slice(0, 8)}...${signature.slice(-8)}`)

      // Callback for parent component
      if (onTransactionComplete) {
        onTransactionComplete()
      }

      // Refresh balance
      if (address) {
        const connection = new Connection('https://api.devnet.solana.com', 'confirmed')
        const publicKey = new PublicKey(address)
        const bal = await connection.getBalance(publicKey)
        setBalance(bal / LAMPORTS_PER_SOL)
      }
    } catch (error: unknown) {
      console.error('Transfer error:', error)
      
      // Handle specific authorization error
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      if (errorMessage.includes('not been authorized') || 
          errorMessage.includes('User rejected') ||
          errorMessage.includes('denied')) {
        setError('Transaction rejected. Please approve the transaction in your wallet.')
      } else if (errorMessage.includes('insufficient')) {
        setError('Insufficient funds for this transaction.')
      } else {
        setError(errorMessage || 'Transfer failed. Please try again.')
      }
    } finally {
      setIsTransferring(false)
    }
  }

  return (
    <div style={{
      padding: '20px',
      backgroundColor: '#1a1a1a',
      borderRadius: '12px',
      maxWidth: '500px',
    }}>
      <h2 style={{ fontSize: '20px', marginBottom: '20px', color: '#fff' }}>
        Send Tokens
      </h2>

      {balance !== null && (
        <p style={{ fontSize: '14px', color: '#60a5fa', marginBottom: '15px' }}>
          Balance: {balance.toFixed(4)} SOL
        </p>
      )}

      {/* Transfer Type */}
      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px', color: '#ccc' }}>
          Transfer Type
        </label>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setTransferType('SOL')}
            style={{
              flex: 1,
              padding: '10px',
              fontSize: '14px',
              backgroundColor: transferType === 'SOL' ? '#646cff' : '#2a2a2a',
              color: 'white',
              border: `1px solid ${transferType === 'SOL' ? '#646cff' : '#444'}`,
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            SOL
          </button>
          <button
            onClick={() => setTransferType('SPL')}
            style={{
              flex: 1,
              padding: '10px',
              fontSize: '14px',
              backgroundColor: transferType === 'SPL' ? '#646cff' : '#2a2a2a',
              color: 'white',
              border: `1px solid ${transferType === 'SPL' ? '#646cff' : '#444'}`,
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            SPL Token
          </button>
        </div>
      </div>

      {/* Recipient Address */}
      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px', color: '#ccc' }}>
          Recipient Address
        </label>
        <input
          type="text"
          value={recipientAddress}
          onChange={(e) => setRecipientAddress(e.target.value)}
          placeholder="Enter Solana address"
          disabled={isTransferring}
          style={{
            width: '100%',
            padding: '10px',
            fontSize: '14px',
            borderRadius: '8px',
            border: '1px solid #444',
            backgroundColor: '#2a2a2a',
            color: 'white',
          }}
        />
      </div>

      {/* Token Mint (SPL only) */}
      {transferType === 'SPL' && (
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px', color: '#ccc' }}>
            Token Mint Address
          </label>
          <input
            type="text"
            value={tokenMint}
            onChange={(e) => setTokenMint(e.target.value)}
            placeholder="Enter token mint address"
            disabled={isTransferring}
            style={{
              width: '100%',
              padding: '10px',
              fontSize: '14px',
              borderRadius: '8px',
              border: '1px solid #444',
              backgroundColor: '#2a2a2a',
              color: 'white',
            }}
          />
        </div>
      )}

      {/* Amount */}
      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px', color: '#ccc' }}>
          Amount
        </label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          disabled={isTransferring}
          step="0.001"
          min="0"
          style={{
            width: '100%',
            padding: '10px',
            fontSize: '14px',
            borderRadius: '8px',
            border: '1px solid #444',
            backgroundColor: '#2a2a2a',
            color: 'white',
          }}
        />
      </div>

      {/* Error Message */}
      {error && (
        <div style={{
          padding: '10px',
          marginBottom: '15px',
          backgroundColor: '#ff444420',
          border: '1px solid #ff4444',
          borderRadius: '8px',
          color: '#ff6b6b',
          fontSize: '14px',
        }}>
          {error}
        </div>
      )}

      {/* Transfer Button */}
      <button
        onClick={handleTransfer}
        disabled={isTransferring || !recipientAddress || !amount}
        style={{
          width: '100%',
          padding: '12px',
          fontSize: '16px',
          backgroundColor: isTransferring || !recipientAddress || !amount ? '#555' : '#10b981',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: isTransferring || !recipientAddress || !amount ? 'not-allowed' : 'pointer',
          fontWeight: 'bold',
        }}
      >
        {isTransferring ? 'Sending...' : `Send ${transferType}`}
      </button>
    </div>
  )
}
