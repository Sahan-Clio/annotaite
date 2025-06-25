class Api::V1::DocumentParserController < ApplicationController
  def parse
    begin
      result = DocumentAiParserService.new.call
      render json: result, status: :ok
    rescue StandardError => e
      Rails.logger.error "Document parsing failed: #{e.message}"
      render json: { error: e.message }, status: :internal_server_error
    end
  end
end 