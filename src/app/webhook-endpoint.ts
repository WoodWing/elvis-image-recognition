import crypto = require('crypto');
import compare = require('secure-compare');

import { Recognizer } from './recognizer';
import { Config } from '../config';
import { Application, Request, Response } from 'express';

/**
 * Handle Elvis webhook events
 */
export class WebhookEndpoint {

  private recognizer: Recognizer;

  constructor(public app: Application) {
    this.recognizer = new Recognizer(Config.clarifaiEnabled, Config.googleEnabled, Config.awsEnabled, Config.languages !== 'en');
  }

  /**
 * Register HTTP Post route on '/' and listen for Elvis webhook events
 */
  public addRoutes(): void {
    if (!Config.recognizeOnImport) {
      console.info('recognizeOnImport is disabled, images can only be tagged through direct API calls');
      return;
    }
    this.app.post('/', (request: Request, response: Response) => {
      let data: string = '';

      request.on('data', (chunk: string) => {
        data += chunk;
      });

      request.on('end', () => {
        // Send a response back to Elvis before handling the event, so the app won't keep 
        // the connection open while it's handling the event. This results in better performance.
        response.status(200).send();

        // Validate the webhook signature
        let signature: string = request.header('x-hook-signature');
        if (!this.validateSignature(signature, data)) {
          return console.error('Invalid WebHook signature: ' + signature + '. Make sure the elvisToken is configured correctly.');
        }

        try {
          var jsonData: string = JSON.parse(data);
        }
        catch (e) {
          return console.error('Invalid request: ' + e + '\nrequest data:\n' + data);
        }

        // Handle the event. 
        this.handle(jsonData);
      });

      request.on('error', (e: Error) => {
        this.throwError(response, 'An unexpected error occurred: ' + e + '\nrequest data:\n' + data);
      });
    });
  }

  /**
   * Validate Elvis webhook signature
   * 
   * @param signature Request header signature
   * @param data Request data to validate
   */
  private validateSignature(signature: string, data: string): boolean {
    try {
      let hmac: crypto.Hmac = crypto.createHmac('sha256', Config.elvisToken);
      hmac.update(data);
      let digest: string = hmac.digest('hex');
      return compare(digest, signature);
    }
    catch (error) {
      console.warn('Signature validation failed for signature: ' + signature + ' and data: ' + data + '; details: ' + error);
    }
    return false;
  }

  /**
   * Log the error and send an error response back to Elvis.
   */
  private throwError(response: Response, message: string): void {
    console.error(message);
    response.status(400).send(message);
  }

  /**
   * Handle Elvis webhook events
   * 
   * @param event The Elvis webhook event to handle
   */
  private handle(event: any): void {
    if (!(event.type === 'asset_create' && event.metadata && event.metadata.assetDomain === 'image')) {
      console.warn('Received useless event, we\'re only interested in asset_create events with assetDomain "image". ' +
        'Make sure to configure the Elvis webhook correctly. Event: '
        + JSON.stringify(event));
      return;
    }
    this.recognizer.recognize(event.assetId);
  }
}
