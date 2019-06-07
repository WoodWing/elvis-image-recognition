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
    let translateEnabled: boolean = Config.languages !== '';
    this.recognizer = new Recognizer(Config.clarifaiEnabled, Config.googleEnabled, Config.awsEnabled, Config.emraysEnabled, translateEnabled);
  }

  /**
   * Register HTTP Post route on '/' and listen for Elvis webhook events
   */
  public addRoutes(): void {
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
   * Handles the asset_update_metadata Elvis Server event and 
   * starts the recognition process if the correct metadata is specified
   * 
   * @param event The Elvis webhook event to handle
   */
  private handle(event: any): void {
    let isUpdateMetadataEvent: boolean = (event.type === 'asset_update_metadata');
    let hasAssetDomainMetadata: boolean = (event.metadata && event.metadata.assetDomain);
    let hasAssetPathMetadata: boolean = (event.metadata && event.metadata.assetPath);
    if (!isUpdateMetadataEvent || !hasAssetDomainMetadata || !hasAssetPathMetadata) {
      console.warn('Received useless event, we\'re only interested in metadata_update events where the assetDomain and assetPath metadata fields are specified. ' +
        'Make sure to configure the Elvis webhook correctly. Event: '
        + JSON.stringify(event));
      return;
    }
    let previewIsReady: boolean = (event.changedMetadata && event.changedMetadata.previewState && event.changedMetadata.previewState.newValue === 'yes');
    if (event.metadata.assetPath.startsWith('/Users/') || !previewIsReady || event.metadata.assetDomain !== 'image') {
      // Simply ignore any metadata update that:
      // - Is in the Users folder, the configured API user doesn't have access here
      // - When we don't have a preview
      // - When it's not an image
      return;
    }
    this.recognizer.recognize(event.assetId, null, event.metadata.assetPath);
  }
}
