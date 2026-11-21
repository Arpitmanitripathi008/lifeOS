import fs from 'fs';
import path from 'path';
// @ts-ignore
import pdfParse from 'pdf-parse';
// @ts-ignore
import mammoth from 'mammoth';

export interface ParsedDocumentResult {
  text: string;
  pageCount?: number;
  mimeType: string;
  isMultimodalImage: boolean;
  base64Data?: string;
  rawFileSize: number;
}

export class DocumentParser {
  /**
   * Extracts text and/or multimodal payload from an uploaded file
   */
  static async parseFile(filePath: string, mimeType: string): Promise<ParsedDocumentResult> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found at path: ${filePath}`);
    }

    const buffer = fs.readFileSync(filePath);
    const rawFileSize = buffer.length;

    // 1. Plain Text (.txt)
    if (mimeType === 'text/plain') {
      const text = buffer.toString('utf-8');
      return {
        text,
        mimeType,
        isMultimodalImage: false,
        rawFileSize,
      };
    }

    // 2. Microsoft Word Document (.docx)
    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      filePath.toLowerCase().endsWith('.docx')
    ) {
      try {
        const result = await mammoth.extractRawText({ buffer });
        return {
          text: result.value || '',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          isMultimodalImage: false,
          rawFileSize,
        };
      } catch (err: any) {
        throw new Error(`Failed to parse DOCX file: ${err.message}`);
      }
    }

    // 3. Adobe PDF (.pdf)
    if (mimeType === 'application/pdf' || filePath.toLowerCase().endsWith('.pdf')) {
      let extractedText = '';
      let pageCount = 1;

      try {
        const parseFn = typeof pdfParse === 'function' ? pdfParse : (pdfParse as any).default || (pdfParse as any);
        const data = await parseFn(buffer);
        extractedText = data.text || '';
        pageCount = data.numpages || 1;
      } catch (pdfErr: any) {
        console.warn('pdfParse text extraction warning (falling back to multimodal):', pdfErr.message);
      }

      // Also encode to base64 so Gemini can read PDF layout and tables directly
      const base64Data = buffer.toString('base64');

      return {
        text: extractedText,
        pageCount,
        mimeType: 'application/pdf',
        isMultimodalImage: false,
        base64Data,
        rawFileSize,
      };
    }

    // 4. Image Files (PNG, JPG, WEBP)
    if (
      mimeType.startsWith('image/') ||
      /\.(jpe?g|png|webp)$/i.test(filePath)
    ) {
      const normalizedMime =
        mimeType.startsWith('image/') ? mimeType : filePath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
      const base64Data = buffer.toString('base64');

      return {
        text: '', // Images have no direct text until Gemini vision OCRs it
        mimeType: normalizedMime,
        isMultimodalImage: true,
        base64Data,
        rawFileSize,
      };
    }

    throw new Error(`Unsupported document type: ${mimeType}`);
  }
}
