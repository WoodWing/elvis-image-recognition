/**
 * Start web server and entry point for API requests.
 */

require("console-stamp")(console, { pattern: "dd-mm-yyyy HH:MM:ss.l" });
import express = require('express');
import health = require('express-ping');
import http = require('http');
import https = require('https');
import fs = require('fs');
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
  private httpApp: Application;
  private httpsApp: Application;
  private webhookEndPoint: WebhookEndpoint;
  private recognizeApi: RecognizeApi;

  private constructor() {
    if (Config.httpEnabled) {
      this.httpApp = express();
    }
    if (Config.httpsEnabled) {
      this.httpsApp = express();
    }
    this.app = Config.httpsEnabled ? this.httpsApp : this.httpApp;
    if (Config.pingEnabled) {
        this.app.use(health.ping('/' + Config.pingEndpoint));
    }
    if (Config.recognizeOnImport) {
      this.webhookEndPoint = new WebhookEndpoint(this.app);
    }
    if (Config.restAPIEnabled) {
      this.recognizeApi = new RecognizeApi(this.app);
    }
  }

  /**
   * Start the server
   */
  public start(): void {
    // Configure bodyParser
    this.app.use(bodyParser.urlencoded({ extended: true }));
    this.app.use(bodyParser.json());

    // Allow cross domain requests from Elvis plugins
    this.app.use(this.allowCrossDomain);

    if (Config.httpEnabled && Config.httpsEnabled) {
      // Redirect all HTTP traffic to HTTPS
      this.httpApp.get('*', (req, res) => {
        res.redirect('https://' + req.headers.host + ':' + Config.httpsPort + '/' + req.path);
      });
    }

    if (Config.httpEnabled) {
      // Start HTTP server
      http.createServer(this.httpApp).listen(Config.httpPort, () => {
        this.logStartupMessage('HTTP Server started at port: ' + Config.httpPort);
      });
    }

    if (Config.httpsEnabled) {
      // Start HTTPS server
      let httpsOptions = {
        key: fs.readFileSync(Config.httpsKeyFile),
        cert: fs.readFileSync(Config.httpsCertFile)
      };
      https.createServer(httpsOptions, this.httpsApp).listen(Config.httpsPort, () => {
        this.logStartupMessage('HTTPS Server started at port: ' + Config.httpsPort);
      });
    }

    if (Config.recognizeOnImport) {
      // Start listening for webhook events
      this.webhookEndPoint.addRoutes();
    }

    if (Config.restAPIEnabled) {
      // Start REST API
      this.recognizeApi.addRoutes();
    }
  }

  private logStartupMessage(serverMsg: string): void {
    console.info(serverMsg);
    console.info('Recognize imported files on import: ' + Config.recognizeOnImport);
    console.info('REST API enabled: ' + Config.restAPIEnabled);
    if (Config.pingEnabled) {
      console.info('Ping endpoint enabled at: /' + Config.pingEndpoint);
    }
  }

  private allowCrossDomain = function (req, res, next) {
    // Keep the compiler happy
    req = req;

    res.header('Access-Control-Allow-Origin', Config.elvisUrl);
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept');

    next();
  }
}

let server: Server = Server.getInstance();
server.start();
