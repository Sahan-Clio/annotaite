class FormFieldProcessorService
  def initialize
    @processor_client = ProcessorClient.new
  end
  
  def process_pdf(pdf_file_path)
    # Get raw processor result
    processor_result = @processor_client.process_pdf(pdf_file_path)
    
    # Transform and normalize the output
    ProcessorNormalizer.transform_processor_output(processor_result)
  end
end 