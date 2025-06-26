class Api::V1::DocumentParserController < ApplicationController
  def parse
    begin
      # Use the hardcoded PDF file path for now
      pdf_path = Rails.root.join('data', 'forms', 'i-907_Jaz6iX6.pdf')
      
      # Check if file exists
      unless File.exist?(pdf_path)
        return render json: { 
          error: 'PDF file not found',
          details: "File not found at: #{pdf_path}"
        }, status: :not_found
      end

      # Initialize service with file path
      parser_service = DocumentAiParserService.new(pdf_path)
      
      # Parse the document
      result = parser_service.parse
      
      # Return the enhanced structure
      render json: result, status: :ok
      
    rescue StandardError => e
      Rails.logger.error "Document parsing failed: #{e.message}"
      Rails.logger.error e.backtrace.join("\n")
      
      render json: { 
        error: 'Document parsing failed',
        details: e.message
      }, status: :internal_server_error
    end
  end
end 