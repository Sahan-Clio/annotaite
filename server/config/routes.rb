Rails.application.routes.draw do
  # Health check endpoint
  get "up" => "rails/health#show", as: :rails_health_check

  # API routes
  namespace :api do
    namespace :v1 do
      resources :welcome, only: :index
      
      # Document uploads and parsing
      resources :uploads, only: [:create]
      post 'parse', to: 'uploads#create' # Legacy route for compatibility
      
      # AI analysis
      resources :ai_analyses, only: [:create]
      post 'ai-analyze', to: 'ai_analyses#create' # Legacy route for compatibility
      get 'gemini-test', to: 'ai_analyses#test'
    end
  end

  # Defines the root path route ("/")
  # root "posts#index"
end
