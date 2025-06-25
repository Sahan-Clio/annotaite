import { useEffect, useState, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useParseDocument } from '../api/parseApi'
import type { ParseResponse, ApiError } from '../types/api'

export function Parse() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const filename = searchParams.get('filename') || 'unknown.pdf'
  const parseDocument = useParseDocument()
  const [response, setResponse] = useState<ParseResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const hasCalledRef = useRef(false)

  useEffect(() => {
    // Only call once per filename
    if (hasCalledRef.current) return
    hasCalledRef.current = true

    // Create a dummy file for the API call since backend is hardcoded
    const dummyFile = new File([''], filename, { type: 'application/pdf' })
    
    parseDocument.mutate(dummyFile, {
      onSuccess: (data) => {
        setResponse(data)
        setError(null)
      },
      onError: (error: ApiError) => {
        setError(error.error || 'An error occurred')
        setResponse(null)
      }
    })
  }, [filename, parseDocument])

  // Reset the ref when filename changes
  useEffect(() => {
    hasCalledRef.current = false
  }, [filename])

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2">Document Parser Results</h1>
          <p className="text-muted-foreground">File: {filename}</p>
        </div>

        {parseDocument.isPending && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Parsing document...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-6">
            <h2 className="font-semibold text-destructive mb-2">Error</h2>
            <p className="text-sm text-destructive/80">{error}</p>
          </div>
        )}

        {response && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-4">Form Fields ({response.fields.length})</h2>
              {response.fields.length > 0 ? (
                <div className="grid gap-4">
                  {response.fields.map((field, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <h3 className="font-medium mb-2">{field.name}</h3>
                      <div className="grid md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <h4 className="font-medium text-muted-foreground mb-1">Label Bounding Box</h4>
                          <div className="bg-muted rounded p-2">
                            <p>Page: {field.label_bounding_box.page}</p>
                            <p>X: {field.label_bounding_box.x_min.toFixed(3)} - {field.label_bounding_box.x_max.toFixed(3)}</p>
                            <p>Y: {field.label_bounding_box.y_min.toFixed(3)} - {field.label_bounding_box.y_max.toFixed(3)}</p>
                          </div>
                        </div>
                        <div>
                          <h4 className="font-medium text-muted-foreground mb-1">Input Bounding Box</h4>
                          <div className="bg-muted rounded p-2">
                            <p>Page: {field.input_bounding_box.page}</p>
                            <p>X: {field.input_bounding_box.x_min.toFixed(3)} - {field.input_bounding_box.x_max.toFixed(3)}</p>
                            <p>Y: {field.input_bounding_box.y_min.toFixed(3)} - {field.input_bounding_box.y_max.toFixed(3)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No form fields found.</p>
              )}
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4">Metadata ({response.metadata.length})</h2>
              {response.metadata.length > 0 ? (
                <div className="grid gap-4">
                  {response.metadata.map((item, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="mb-2">
                        <h3 className="font-medium">Content</h3>
                        <p className="text-sm">{item.content}</p>
                      </div>
                      <div>
                        <h4 className="font-medium text-muted-foreground mb-1">Bounding Box</h4>
                        <div className="bg-muted rounded p-2 text-sm">
                          <p>Page: {item.bounding_box.page}</p>
                          <p>X: {item.bounding_box.x_min.toFixed(3)} - {item.bounding_box.x_max.toFixed(3)}</p>
                          <p>Y: {item.bounding_box.y_min.toFixed(3)} - {item.bounding_box.y_max.toFixed(3)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No metadata found.</p>
              )}
            </div>
          </div>
        )}

        <div className="mt-8">
          <button
            onClick={() => navigate('/')}
            className="bg-secondary text-secondary-foreground px-4 py-2 rounded-md hover:bg-secondary/80 transition-colors"
          >
            ← Back to Upload
          </button>
        </div>
      </div>
    </div>
  )
} 