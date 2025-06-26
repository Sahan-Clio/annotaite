require 'rails_helper'

RSpec.describe Api::V1::DocumentParserController, type: :controller do
  describe 'POST #parse' do
    let(:mock_result) do
      {
        document_info: {
          total_pages: 1,
          page_dimensions: [
            { page: 1, width: 612, height: 792 }
          ]
        },
        fields: [
          {
            id: 'field_1',
            type: 'form_field_label',
            text: 'First Name',
            page: 1,
            bounding_box: { x_min: 0.1, y_min: 0.1, x_max: 0.3, y_max: 0.15 }
          }
        ]
      }
    end

    let(:pdf_file) do
      fixture_file_upload(
        Rails.root.join('spec', 'fixtures', 'sample.pdf'),
        'application/pdf'
      )
    end

    context 'when file is uploaded and service succeeds' do
      before do
        allow_any_instance_of(DocumentAiParserService).to receive(:parse).and_return(mock_result)
      end

      it 'returns parsed document data' do
        post :parse, params: { file: pdf_file }
        
        expect(response).to have_http_status(:ok)
        expect(JSON.parse(response.body)).to eq(mock_result.deep_stringify_keys)
      end
    end

    context 'when no file is uploaded' do
      it 'returns bad request error' do
        post :parse
        
        expect(response).to have_http_status(:bad_request)
        parsed_response = JSON.parse(response.body)
        expect(parsed_response['error']).to eq('No file uploaded')
      end
    end

    context 'when non-PDF file is uploaded' do
      let(:text_file) do
        fixture_file_upload(
          Rails.root.join('spec', 'fixtures', 'sample.txt'),
          'text/plain'
        )
      end

      it 'returns bad request error' do
        post :parse, params: { file: text_file }
        
        expect(response).to have_http_status(:bad_request)
        parsed_response = JSON.parse(response.body)
        expect(parsed_response['error']).to eq('Invalid file type')
      end
    end

    context 'when service fails' do
      before do
        allow_any_instance_of(DocumentAiParserService).to receive(:parse).and_raise(StandardError.new('API Error'))
      end

      it 'returns error response' do
        post :parse, params: { file: pdf_file }
        
        expect(response).to have_http_status(:internal_server_error)
        parsed_response = JSON.parse(response.body)
        expect(parsed_response['error']).to eq('Document parsing failed')
        expect(parsed_response['details']).to eq('API Error')
      end
    end
  end
end 