import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private s3Client: S3Client;
  private bucketName: string;

  constructor(private readonly configService: ConfigService) {
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID') || '';
    const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY') || '';
    const region = this.configService.get<string>('AWS_REGION', 'us-east-1');
    this.bucketName = this.configService.get<string>('AWS_S3_BUCKET_NAME') || '';

    if (!accessKeyId || !secretAccessKey || !this.bucketName) {
      this.logger.error('AWS configurations (Access Key, Secret Key, or Bucket Name) are missing in environment variables.');
    }

    this.s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  /**
   * Uploads a file (text or buffer) to S3
   */
  async uploadFile(key: string, body: Buffer | string, contentType: string): Promise<void> {
    try {
      this.logger.log(`Uploading file to S3: ${key}...`);
      let finalBody: Buffer;
      let finalContentType = contentType;

      if (typeof body === 'string') {
        finalBody = Buffer.from(body, 'utf-8');
        if (contentType.startsWith('text/') && !contentType.toLowerCase().includes('charset')) {
          finalContentType = `${contentType}; charset=utf-8`;
        }
      } else {
        finalBody = body;
      }

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: finalBody,
        ContentType: finalContentType,
      });
      await this.s3Client.send(command);
      this.logger.log(`Successfully uploaded file to S3: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to upload file to S3 (${key}): ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Downloads a file as a Buffer from S3
   */
  async downloadFile(key: string): Promise<Buffer> {
    try {
      this.logger.log(`Downloading file from S3: ${key}...`);
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      const response = await this.s3Client.send(command);
      const chunks: any[] = [];
      const stream = response.Body as any;
      
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      
      return Buffer.concat(chunks);
    } catch (error) {
      this.logger.error(`Failed to download file from S3 (${key}): ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Downloads a file as string from S3
   */
  async downloadFileAsString(key: string): Promise<string> {
    const buffer = await this.downloadFile(key);
    return buffer.toString('utf-8');
  }

  /**
   * Checks if a file exists in the S3 bucket
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      await this.s3Client.send(command);
      return true;
    } catch (error) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      this.logger.error(`Error checking file existence in S3 (${key}): ${error.message}`);
      throw error;
    }
  }

  /**
   * Generates a pre-signed URL for temporary access to a file in S3
   */
  async getSignedUrl(key: string, expiresSeconds: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      return await getSignedUrl(this.s3Client, command, { expiresIn: expiresSeconds });
    } catch (error) {
      this.logger.error(`Failed to generate signed URL for S3 key (${key}): ${error.message}`);
      throw error;
    }
  }
}
