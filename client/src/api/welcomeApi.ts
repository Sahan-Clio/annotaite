import { useQuery } from '@tanstack/react-query'
import { api } from './apiClient'

interface WelcomeResponse {
  title: string
  message: string
  description: string
}

const fetchWelcome = async (): Promise<WelcomeResponse> => {
  const response = await api.get<WelcomeResponse>('/welcome')
  return response.data
}

export const useWelcomeQuery = () => {
  return useQuery({
    queryKey: ['welcome'],
    queryFn: fetchWelcome,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
} 