require 'gemini-ai'

class GeminiClient
  def initialize
    @api_key = ENV['GEMINI_API_KEY']
    raise 'GEMINI_API_KEY environment variable is not set' if @api_key.blank?
    
    @client = Gemini.new(
      credentials: {
        service: 'generative-language-api',
        api_key: @api_key
      },
      options: { 
        model: 'gemini-2.5-pro',
        server_sent_events: false,
        timeout: nil,
        open_timeout: nil,
        read_timeout: nil,
        write_timeout: nil
      }
    )
  end

  def generate_content(prompt_text)
    Rails.logger.info "Making Gemini API call"
    api_start_time = Time.current
    
    result = @client.generate_content({
      contents: {
        role: 'user',
        parts: {
          text: prompt_text
        }
      },
      generationConfig: {
        temperature: 0.1,
        topK: 1,
        topP: 0.8
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_ONLY_HIGH"
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH", 
          threshold: "BLOCK_ONLY_HIGH"
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_ONLY_HIGH"
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_ONLY_HIGH"
        }
      ]
    })
    
    api_end_time = Time.current
    api_duration = ((api_end_time - api_start_time) * 1000).round(2)
    Rails.logger.info "Gemini API call completed in #{api_duration}ms"
    
    { result: result, duration_ms: api_duration }
  end

  def test_simple_request
    start_time = Time.current
    
    begin
      response = generate_content("Hello, please respond with 'Hello from Gemini!'")
      
      duration_ms = ((Time.current - start_time) * 1000).round(2)
      
      if response[:result] && response[:result]['candidates']&.first&.dig('content', 'parts')&.first&.dig('text')
        text = response[:result]['candidates'].first['content']['parts'].first['text']
        { success: true, text: text, duration_ms: duration_ms }
      else
        { success: false, error: 'Invalid response format', duration_ms: duration_ms }
      end
    rescue StandardError => e
      duration_ms = ((Time.current - start_time) * 1000).round(2)
      { success: false, error: e.message, duration_ms: duration_ms }
    end
  end
end 