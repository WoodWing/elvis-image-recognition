/**
 * Start web server and entry point for API requests.
 */

import express = require('express');
import crypto = require('crypto');
import compare = require('secure-compare');
import { Config } from './config';
import { EventHandler } from './eventhandler';

/**
 * Singleton server class
 */
class Server {

  private static instance: Server;

  public static getInstance(): Server {
    return this.instance || (this.instance = new this());
  }

  private app: express.Application;
  private eventHandler: EventHandler;

  private constructor() {
    this.app = express();
    this.eventHandler = new EventHandler();
  }

  /**
   * Start the server
   * 
   * @param port Server HTTP port.
   */
  public start(port: string): void {
    // Start server
    this.app.listen(port);
    console.log('======================================================================='
      + '\nImage Recognition Server started at port: ' + port
      + '\n======================================================================='
      + '\n\nWaiting for incoming events...');

    this.addPostRoute();
  }

  /**
   * Register HTTP Post route on '/' and listen for Elvis webhook events
   */
  private addPostRoute(): void {
    this.app.post('/', (request: express.Request, response: express.Response) => {
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
        this.eventHandler.handle(jsonData);
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
  private throwError(response: express.Response, message: string): void {
    console.error(message);
    response.status(400).send(message);
  }
}

let server: Server = Server.getInstance();
server.start(Config.port);