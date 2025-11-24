import './App.css'
import { SignAndConnect } from './components/SignAndConnect'
import ContextProvider from './context'

function App() {
  
  return (
    <div style={{ width: '100%', minHeight: '100vh', backgroundColor: '#242424', color: 'white', padding: '20px' }}>
      <h1>Solana Wallet Connect</h1>
      <p>Connect your wallet and sign a message to authenticate</p>
      <ContextProvider>
        <SignAndConnect />
      </ContextProvider>
    </div>
  )
}

export default App
