import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWelcomeQuery } from '../api/welcomeApi'

export function Home() {
  const { data, isLoading, error } = useWelcomeQuery()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const navigate = useNavigate()

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file)
    } else {
      alert('Please select a PDF file')
    }
  }

  const handleUpload = () => {
    if (selectedFile) {
      navigate(`/parse?filename=${encodeURIComponent(selectedFile.name)}`)
    }
  }

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
      <div className="text-center max-w-md mx-auto p-6">
        <h1 className="text-4xl font-mono font-bold mb-4">annot[ai]tor</h1>
        <p className="text-muted-foreground mb-8">{message}</p>
        
        <div className="space-y-4">
          <div className="border-2 border-dashed border-border rounded-lg p-6">
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileSelect}
              className="hidden"
              id="pdf-upload"
            />
            <label
              htmlFor="pdf-upload"
              className="cursor-pointer block text-center"
            >
              <div className="text-4xl mb-2">📄</div>
              <p className="text-sm text-muted-foreground">
                Click to select a PDF file
              </p>
            </label>
          </div>
          
          {selectedFile && (
            <div className="text-sm text-muted-foreground">
              Selected: {selectedFile.name}
            </div>
          )}
          
          <button
            onClick={handleUpload}
            disabled={!selectedFile}
            className="w-full bg-primary text-primary-foreground px-4 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
          >
            Upload & Parse PDF
          </button>
        </div>
      </div>
    </div>
  )
} 