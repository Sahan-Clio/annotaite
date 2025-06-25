import { useState, useEffect } from 'react'
import type { RefObject } from 'react'

interface Dimensions {
  width: number
  height: number
}

interface Coordinates {
  x: number
  y: number
  width: number
  height: number
}

export const useCoordinateTransform = (
  pageRef: RefObject<HTMLDivElement>,
  nativePageDimensions: Dimensions | null
) => {
  const [scale, setScale] = useState(1)

  useEffect(() => {
    if (pageRef.current && nativePageDimensions) {
      const renderedWidth = pageRef.current.clientWidth
      setScale(renderedWidth / nativePageDimensions.width)
    }
  }, [pageRef, nativePageDimensions])

  const domToPdf = (domCoords: Coordinates): Coordinates => {
    if (!nativePageDimensions) return domCoords
    return {
      x: domCoords.x / scale,
      y: nativePageDimensions.height - (domCoords.y / scale) - (domCoords.height / scale),
      width: domCoords.width / scale,
      height: domCoords.height / scale,
    }
  }

  const pdfToDom = (pdfCoords: Coordinates): Coordinates => {
    if (!nativePageDimensions) return pdfCoords
    return {
      x: pdfCoords.x * scale,
      y: (nativePageDimensions.height - pdfCoords.y - pdfCoords.height) * scale,
      width: pdfCoords.width * scale,
      height: pdfCoords.height * scale,
    }
  }

  return { domToPdf, pdfToDom, scale }
} 