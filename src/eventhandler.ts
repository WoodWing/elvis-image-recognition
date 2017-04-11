import { Recognizer } from './recognizer';
import { Config } from './config';

/**
 * Handle Elvis webhook events
 */
export class EventHandler {

  private recognizer: Recognizer;

  constructor() {
    this.recognizer = new Recognizer(Config.clarifaiEnabled, Config.googleEnabled, Config.awsEnabled);
  }

  /**
   * Handle Elvis webhook events
   * 
   * @param event The Elvis webhook event to handle
   */
  public handle(event: any): void {
    if (!(event.type === 'asset_create' && event.metadata && event.metadata.assetDomain === 'image')) {
      console.warn('Received useless event, we\'re only interested in asset_create events with assetDomain "image". ' +
        'Make sure to configure the Elvis webhook correctly. Event: '
        + JSON.stringify(event));
      return;
    }
    this.recognizer.recognize(event.assetId);
  }
}
