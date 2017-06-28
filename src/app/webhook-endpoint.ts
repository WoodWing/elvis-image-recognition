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

    // Recognize API
    this.app.post('/', (req: Request, res: Response) => {

      // Send a response back to Elvis before handling the event, so the app won't keep 
      // the connection open while it's handling the event. This results in better performance.
      res.status(200).send();

      // Validate the webhook signature
      let signature: string = req.header('x-hook-signature');
      if (!this.validateSignature(signature, JSON.stringify(req.body))) {
        return console.error('Invalid WebHook signature: ' + signature + '. Make sure the elvisToken is configured correctly.');
      }

      // Handle the event. 
      this.handle(req.body);
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
   * Handle Elvis webhook events. Two events are handled:
   * 
   * 1. asset_create: Used for uploads where the previewUrl is directly available (web client uploads)
   * 2. asset_metadata_update: Used for uploads where the previewUrl is not specified with the asset_create event (desktop client uploads)
   * 
   * @param event The Elvis webhook event to handle
   */
  private handle(event: any): void {
    if (!((event.type === 'asset_create' || event.type === 'asset_update_metadata') && event.metadata && event.metadata.assetDomain === 'image')) {
      console.warn('Received useless event, we\'re only interested in asset_create or metadata_update events with assetDomain "image". ' +
        'Make sure to configure the Elvis webhook correctly. Event: '
        + JSON.stringify(event));
      return;
    }
    if (event.type === 'asset_update_metadata' && !(event.changedMetadata.previewState && event.changedMetadata.previewState.newValue === 'yes')) {
      // Simply ignore any metadata update that doesn't change the previewState to "yes"
      return;
    }
    this.recognizer.recognize(event.assetId);
  }
}
