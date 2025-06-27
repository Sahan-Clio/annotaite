import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWelcomeQuery } from '../api/welcomeApi'

export function Home() {
  const { data, isLoading, error } = useWelcomeQuery()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const navigate = useNavigate()

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file)
    } else {
      alert('Please select a PDF file')
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const files = e.dataTransfer.files
    const file = files[0]
    
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file)
    } else {
      alert('Please select a PDF file')
    }
  }

  const handleUpload = () => {
    if (selectedFile) {
      navigate('/parse', { 
        state: { 
          file: selectedFile 
        } 
      })
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 animate-pulse">Loading...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-white to-orange-50">
        <div className="text-center p-8 bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-red-100">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-red-600 font-medium">Error loading welcome message</p>
          <p className="text-red-400 text-sm mt-2">Please try refreshing the page</p>
        </div>
      </div>
    )
  }

  const message = data?.message || "ready to get annotating 🤖!"

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-4 -right-4 w-72 h-72 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse"></div>
        <div className="absolute -bottom-8 -left-4 w-72 h-72 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-pink-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse delay-500"></div>
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-4xl mx-auto">
          {/* Header Section */}
          <div className="mb-10">
            <div className="mb-6">
              <h1 className="text-6xl md:text-7xl font-mono font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 bg-clip-text text-transparent mb-4 tracking-tight">
                annot[ai]tor
              </h1>
              <div className="w-24 h-1 bg-gradient-to-r from-blue-500 to-purple-500 mx-auto rounded-full"></div>
            </div>
            <p className="text-xl md:text-2xl text-gray-600 font-light leading-relaxed">
              {message}
            </p>
          </div>

          {/* Upload Section */}
          <div className="max-w-xl mx-auto mb-10">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-white/30">
              <div className="space-y-4">
                {/* Drag and Drop Area */}
                <div 
                  className={`relative border-2 border-dashed rounded-xl p-8 transition-all duration-300 ${
                    isDragOver 
                      ? 'border-blue-500 bg-blue-50/50 scale-105' 
                      : selectedFile 
                        ? 'border-green-500 bg-green-50/50' 
                        : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50/30'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileSelect}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    id="pdf-upload"
                  />
                  
                  <div className="text-center">
                    <div className={`w-16 h-16 mx-auto mb-4 rounded-xl flex items-center justify-center transition-all duration-300 ${
                      selectedFile ? 'bg-green-100' : 'bg-gray-100'
                    }`}>
                      {selectedFile ? (
                        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ) : (
                        <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      )}
                    </div>
                    
                    {selectedFile ? (
                      <div>
                        <p className="text-lg font-semibold text-green-700 mb-2">File Selected!</p>
                        <p className="text-sm text-gray-600 mb-2">{selectedFile.name}</p>
                        <p className="text-xs text-gray-500">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-lg font-semibold text-gray-700 mb-2">
                          {isDragOver ? 'Drop your PDF here!' : 'Drop your PDF or click to browse'}
                        </p>
                        <p className="text-sm text-gray-500">
                          Support for PDF files up to 50MB
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Upload Button */}
                <button
                  onClick={handleUpload}
                  disabled={!selectedFile}
                  className={`w-full py-3 px-6 rounded-xl font-medium text-base transition-all duration-300 transform ${
                    selectedFile
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl hover:-translate-y-1 hover:scale-105'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {selectedFile ? (
                    <span className="flex items-center justify-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Analyze Document
                    </span>
                  ) : (
                    'Select a PDF file first'
                  )}
                </button>

                {/* Help Text */}
                <div className="text-center">
                  <p className="text-xs text-gray-500">
                    Your documents are processed securely and never stored permanently
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Feature highlights - moved below upload */}
          <div className="max-w-3xl mx-auto mb-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white/50 backdrop-blur-sm rounded-lg p-4 shadow-md border border-white/20 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="font-medium text-gray-800 text-sm mb-1 text-center">Smart Analysis</h3>
                <p className="text-xs text-gray-600 text-center">AI-powered field detection</p>
              </div>
              
              <div className="bg-white/50 backdrop-blur-sm rounded-lg p-4 shadow-md border border-white/20 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </div>
                <h3 className="font-medium text-gray-800 text-sm mb-1 text-center">Interactive</h3>
                <p className="text-xs text-gray-600 text-center">Drag and edit overlays</p>
              </div>
              
              <div className="bg-white/50 backdrop-blur-sm rounded-lg p-4 shadow-md border border-white/20 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h3 className="font-medium text-gray-800 text-sm mb-1 text-center">Search</h3>
                <p className="text-xs text-gray-600 text-center">Find and filter fields</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-400">
              Built with React, Rails & Python
            </p>
          </div>
        </div>
      </div>
    </div>
  )
} 