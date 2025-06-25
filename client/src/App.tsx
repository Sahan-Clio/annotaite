import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeToggle } from './components/ThemeToggle'
import { Home } from './components/Home'
import { Parse } from './components/Parse'
import { useTheme } from './hooks/useTheme'

const queryClient = new QueryClient()

function AppContent() {
  // Initialize theme on app load
  useTheme()
  
  return (
    <BrowserRouter>
      <ThemeToggle />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/parse" element={<Parse />} />
      </Routes>
    </BrowserRouter>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  )
}

export default App
