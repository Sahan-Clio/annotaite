require 'rails_helper'

RSpec.describe Api::V1::DocumentParserController, type: :controller do
  describe 'POST #parse' do
    let(:mock_result) do
      {
        success: true,
        document_info: {
          total_pages: 1,
          page_dimensions: [
            { page: 1, width: 612, height: 792 }
          ]
        },
        fields: [
          {
            id: 'field_1',
            type: 'text_input',
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
        allow_any_instance_of(FormFieldProcessorService).to receive(:process_pdf).and_return(mock_result)
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
        expect(parsed_response['error']).to eq('No file provided')
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
        expect(parsed_response['error']).to eq('Only PDF files are supported')
      end
    end

    context 'when service fails' do
      before do
        allow_any_instance_of(FormFieldProcessorService).to receive(:process_pdf).and_raise(StandardError.new('Processing Error'))
      end

      it 'returns error response' do
        post :parse, params: { file: pdf_file }
        
        expect(response).to have_http_status(:internal_server_error)
        parsed_response = JSON.parse(response.body)
        expect(parsed_response['success']).to eq(false)
        expect(parsed_response['error']).to eq('Processing Error')
      end
    end
  end
end 