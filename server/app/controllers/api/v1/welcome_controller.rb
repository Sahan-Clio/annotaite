class Api::V1::WelcomeController < ApplicationController
  def index
    render json: { 
      title: "annot[ai]tor",
      message: "ready to get annotating 🤖!",
      description: "Your AI-powered annotation platform is ready to help you streamline your data labeling workflow."
    }, status: :ok
  rescue StandardError => e
    render json: { error: e.message }, status: :internal_server_error
  end
end 