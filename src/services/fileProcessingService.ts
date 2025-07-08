import { SchemaField } from '@/types';

export class FileProcessingService {
  /**
   * This service now acts as a client to the backend API.
   * The complex processing logic has been moved to server.cjs.
   */

  async processFile(
    file: File,
    gcsBucket: string,
  ): Promise<{ processedFileUrl: string; processedFileName: string }> {
    console.log('🔄 Calling backend to process file:', file.name);

    const formData = new FormData();
    formData.append('shapefile', file);
    formData.append('bucket', gcsBucket);

    const response = await fetch('/api/convert-upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'File conversion failed on the server.');
    }

    const result = await response.json();
    return {
        processedFileUrl: result.gcsUri,
        processedFileName: result.gcsUri.split('/').pop()
    };
  }
  
  async processGcsFile(
    gcsBucket: string,
    gcsPath: string
  ): Promise<{ processedFileUrl: string; processedFileName: string }> {
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

  // Schema inference would now happen on the backend, but we keep the shell here.
  private inferSchema(records: any[]): SchemaField[] {
    // This logic would ideally be on the backend, and the schema
    // returned from the /api/convert endpoint.
    return [];
  }

  async validateProcessedFile(gcsUri: string): Promise<boolean> {
    // With backend processing, a successful response implies the file exists.
    return !!gcsUri;
  }
}

export const fileProcessingService = new FileProcessingService();