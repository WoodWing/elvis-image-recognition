/**
 * Start web server and entry point for API requests.
 */

require("console-stamp")(console, { pattern: "dd-mm-yyyy HH:MM:ss.l" });
import express = require('express');
import { Application } from 'express';
import bodyParser = require('body-parser');
import { Config } from './config';
import { WebhookEndpoint } from './app/webhook-endpoint';
import { RecognizeApi } from './app/recognize-api'

/**
 * Singleton server class
 */
class Server {

  private static instance: Server;

  public static getInstance(): Server {
    return this.instance || (this.instance = new this());
  }

  private app: Application;
  private webhookEndPoint: WebhookEndpoint;
  private recognizeApi: RecognizeApi;

  private constructor() {
    this.app = express();
    this.webhookEndPoint = new WebhookEndpoint(this.app);
    this.recognizeApi = new RecognizeApi(this.app);
  }

  /**
   * Start the server
   * 
   * @param port Server HTTP port.
   */
  public start(port: string): void {
    // configure app to use bodyParser()
    this.app.use(bodyParser.urlencoded({ extended: true }));
    this.app.use(bodyParser.json());

    // Start server
    this.app.listen(port);
    console.info('Image Recognition Server started at port: ' + port);

    this.webhookEndPoint.addRoutes();
    this.recognizeApi.addRoutes();
  }
}

let server: Server = Server.getInstance();
server.start(Config.port);