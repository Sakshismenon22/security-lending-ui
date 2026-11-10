import BorrowerWorkflow from './pages/borrower/BorrowerWorkflow'
import LenderWorkflow from './pages/lender/LenderWorkflow'

function App() {
  const isLenderWorkspace = window.location.pathname.startsWith('/lender')
  return isLenderWorkspace ? <LenderWorkflow /> : <BorrowerWorkflow />
}

export default App
