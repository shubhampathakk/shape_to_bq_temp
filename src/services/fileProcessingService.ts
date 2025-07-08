import { SchemaField } from '@/types';

export class FileProcessingService {
  /**
   * This service now acts as a client to the backend API.
   * It receives a converted file blob from the server.
   */
  async processFile(file: File): Promise<File> {
    console.log('🔄 Calling backend to process file:', file.name);

    const formData = new FormData();
    formData.append('shapefile', file);

    const response = await fetch('/api/convert-upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`File conversion failed on the server: ${errorText}`);
    }

    // The backend sends the converted file directly. Handle it as a blob.
    const blob = await response.blob();
    const convertedFile = new File([blob], `${file.name}.geojson`, { type: 'application/geo+json' });
    
    console.log('✅ Backend conversion successful. Received converted file.');
    return convertedFile;
  }

  // The rest of the functions remain the same...
  async processGcsFile(
    gcsBucket: string,
    gcsPath: string
  ): Promise<{ processedFileUrl: string; processedFileName: string }> {
    // This function remains for potential future use but is not part of the primary local upload flow.
    console.log(`🔄 Calling backend to process GCS file: gs://${gcsBucket}/${gcsPath}`);
    
    const response = await fetch('/api/convert-gcs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bucket: gcsBucket, path: gcsPath }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'GCS file conversion failed on the server.');
    }

    const result = await response.json();
    return {
        processedFileUrl: result.gcsUri,
        processedFileName: result.gcsUri.split('/').pop()
    };
  }

  private inferSchema(records: any[]): SchemaField[] {
    return [];
  }

  async validateProcessedFile(gcsUri: string): Promise<boolean> {
    return !!gcsUri;
  }
}

export const fileProcessingService = new FileProcessingService();