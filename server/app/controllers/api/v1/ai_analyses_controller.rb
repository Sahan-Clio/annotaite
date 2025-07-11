class Api::V1::AiAnalysesController < ApplicationController
  def create
    Rails.logger.info "AI analysis request received"
    
    # Check if payload is present
    unless params[:payload].present?
      Rails.logger.error "No payload provided in request"
      return render json: { error: 'No payload provided' }, status: :bad_request
    end

    begin
      # Get the payload from the request
      payload = params[:payload].to_unsafe_h
      
      Rails.logger.info "Starting AI analysis with Gemini"
      
      # Check if Gemini API key is available
      unless ENV['GEMINI_API_KEY'].present?
        Rails.logger.error "Gemini API key not configured"
        return render json: { 
          success: false, 
          error: 'AI analysis not available - API key not configured' 
        }, status: :service_unavailable
      end

      # Enhance with Gemini AI (single call, no page splitting)
      gemini_service = GeminiAiService.new
      
      # Use the original enhance_form_fields method but modify it to not split pages
      enhanced_result = gemini_service.enhance_form_fields_single_call(payload)
      
      Rails.logger.info "Gemini AI analysis completed successfully"
      
      render json: {
        success: true,
        message: 'AI analysis completed',
        data: enhanced_result
      }
      
    rescue StandardError => e
      Rails.logger.error "AI analysis failed: #{e.message}"
      Rails.logger.error e.backtrace.join("\n")
      
      render json: {
        success: false,
        error: e.message,
        fallback_data: params[:payload]
      }, status: :internal_server_error
    end
  end

  def test
    Rails.logger.info "Gemini test request received"
    
    begin
      gemini_service = GeminiAiService.new
      result = gemini_service.test_simple_request
      
      if result[:success]
        render json: { 
          status: 'success', 
          message: result[:text],
          duration_ms: result[:duration_ms]
        }, status: :ok
      else
        render json: { 
          status: 'error', 
          error: result[:error],
          duration_ms: result[:duration_ms]
        }, status: :internal_server_error
      end
      
    rescue => e
      Rails.logger.error "Gemini test failed: #{e.message}"
      render json: { 
        status: 'error', 
        error: e.message 
      }, status: :internal_server_error
    end
  end
end 