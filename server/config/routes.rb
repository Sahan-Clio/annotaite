Rails.application.routes.draw do
  # Health check endpoint
  get "up" => "rails/health#show", as: :rails_health_check

  # API routes
  namespace :api do
    namespace :v1 do
      resources :welcome, only: :index
    end
  end

  # Defines the root path route ("/")
  # root "posts#index"
end
