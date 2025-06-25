import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useWelcomeQuery } from './api/welcomeApi'
import { ThemeToggle } from './components/ThemeToggle'
import { useTheme } from './hooks/useTheme'

const queryClient = new QueryClient()

function WelcomeContent() {
  const { data, isLoading, error } = useWelcomeQuery()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Error loading welcome message</p>
      </div>
    )
  }

  const message = data?.message || "ready to get annotating 🤖!"

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-mono font-bold mb-4">annot[ai]tor</h1>
        <p className="text-muted-foreground">{message}</p>
      </div>
    </div>
  )
}

function AppContent() {
  // Initialize theme on app load
  useTheme()
  
  return (
    <>
      <ThemeToggle />
      <WelcomeContent />
    </>
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
