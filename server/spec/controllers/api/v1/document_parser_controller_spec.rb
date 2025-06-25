require 'rails_helper'

RSpec.describe Api::V1::DocumentParserController, type: :controller do
  describe 'POST #parse' do
    context 'when service succeeds' do
      let(:mock_result) do
        {
          fields: [
            {
              name: 'First Name',
              label_bounding_box: { page: 1, x_min: 0.1, y_min: 0.1, x_max: 0.3, y_max: 0.15 },
              input_bounding_box: { page: 1, x_min: 0.35, y_min: 0.1, x_max: 0.6, y_max: 0.15 }
            }
          ],
          metadata: [
            {
              content: 'Form Instructions',
              bounding_box: { page: 1, x_min: 0.1, y_min: 0.05, x_max: 0.9, y_max: 0.08 }
            }
          ]
        }
      end

      before do
        allow_any_instance_of(DocumentAiParserService).to receive(:call).and_return(mock_result)
      end

      it 'returns parsed document data' do
        post :parse
        
        expect(response).to have_http_status(:ok)
        expect(JSON.parse(response.body)).to eq(mock_result.deep_stringify_keys)
      end
    end

    context 'when service fails' do
      before do
        allow_any_instance_of(DocumentAiParserService).to receive(:call).and_raise(StandardError.new('API Error'))
      end

      it 'returns error response' do
        post :parse
        
        expect(response).to have_http_status(:internal_server_error)
        expect(JSON.parse(response.body)).to eq({ 'error' => 'API Error' })
      end
    end
  end
end 