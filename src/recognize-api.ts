import express = require('express');
import { Router, Application } from 'express';

import { ElvisApi, AssetSearch, SearchResponse } from './elvis-api/api';
import { ApiManager } from './api-manager';
import { Recognizer } from './recognizer';
import { Config } from './config';
import uuidV4 = require('uuid/v4');

export class RecognizeApi {

  private api: ElvisApi = ApiManager.getApi();
  private app: Application;
  private recognizer: Recognizer;
  private processes: ProcessInfo[] = [];

  constructor(app: Application) {
    this.app = app;
    this.recognizer = new Recognizer(Config.clarifaiEnabled, Config.googleEnabled, Config.awsEnabled, Config.languages !== 'en');
  }

  /**
   * Add API routes for recognition API's
   */
  public addRoutes(): void {

    let router: Router = express.Router();

    // API logging
    router.use((req, res, next) => {
      // Keep the compiler happy
      res = res;
      console.info('API call received: "' + req.originalUrl + '" with body: ' + JSON.stringify(req.body));
      // Make sure we go to the next routes and don't stop here
      next();
    });

    // Recognize API
    router.post('/recognize', (req, res) => {
      // Validate parameters
      if (!req.body) {
        return this.handleError('Invalid request, no parameters specified.', req, res);
      }
      let rr: RecognizeRequest = req.body;
      if (!rr.q) {
        return this.handleError('Invalid request, parameter "q" is required.', req, res);
      }

      let pi: ProcessInfo = new ProcessInfo(rr);
      this.processes[pi.id] = pi;

      // Return "ACCEPTED" status
      res.status(202).json({ processId: pi.id });

      // Start recognition process
      this.recognizeBatch(pi, rr);
    });

    // Get recognize process info
    router.get('/recognize/:id', (req, res) => {
      let pi: ProcessInfo = this.retrieveProcessInfo(req, res);
      if (!pi) {
        return;
      }

      // Return process info
      res.status(200).json(pi);
    });

    // Cancel recognize process
    router.delete('/recognize/:id', (req, res) => {
      let pi: ProcessInfo = this.retrieveProcessInfo(req, res);
      if (!pi) {
        return;
      }

      pi.cancelled = true;

      // Return process info
      res.status(200).send('Process with id "' + pi.id + '" is being cancelled.');
    });

    // Prefix all API's with /api
    this.app.use('/api', router);
  }

  private retrieveProcessInfo(req, res): ProcessInfo {
    // Validate parameters
    let id: number = req.params.id;
    if (!req.params.id) {
      this.handleError('Invalid request, parameter "id" is required.', req, res);
      return null;
    }

    // Get process from list
    let pi: ProcessInfo = this.processes[id];

    if (!pi) {
      this.handleError('Process with id "' + id + '" doesn\'t exists.', req, res, 404);
      return null;
    }

    return pi;
  }

  /**
   * Recognize images in batches
   */
  private recognizeBatch(pi: ProcessInfo, rr: RecognizeRequest, startIndex: number = 0, batchSize: number = 5): void {
    if (startIndex == 0) {
      // First batch, parse query to make sure we only retrieve images
      rr.q = '(' + rr.q + ') AND assetDomain:image';
    }

    let search: AssetSearch = {
      firstResult: startIndex,
      maxResultHits: batchSize,
      sorting: [
        {
          field: 'assetCreated',
          descending: true
        }
      ],
      query: {
        QueryStringQuery: {
          queryString: rr.q
        }
      }
    };

    let processedInBatch: number = 0;
    let lastBatch: boolean = false;

    // Search batch
    this.api.searchPost(search).then((sr: SearchResponse) => {
      lastBatch = sr.hits.length < batchSize;
      console.info('Processing in-progress: ' + pi.id + ', total hits: ' + sr.totalHits + ', startIndex: ' + startIndex + ', batchSize: ' + batchSize + ', hits found: ' + sr.hits.length + ', query: ' + rr.q);
      sr.hits.forEach((hit) => {

        // Start image recognition
        this.recognizer.recognize(hit.id).then(() => {
          // Recognition successful
          pi.successCount++;
          processedInBatch++;
          this.nextBatchHandler(pi, rr, startIndex, batchSize, processedInBatch, sr.hits.length, lastBatch);
        }).catch(() => {
          // Recognition failed
          pi.failedCount++;
          processedInBatch++;
          this.nextBatchHandler(pi, rr, startIndex, batchSize, processedInBatch, sr.hits.length, lastBatch);
        });
      })
    }).catch((error: any) => {
      // Search failed, we're done here...
      console.error('Search failed for query: ' + rr.q + '. Error details: ' + error.stack);
    });
  }

  /**
   * Determine if we're done or if a new batch needs to be processed
   */
  private nextBatchHandler(pi: ProcessInfo, rr: RecognizeRequest, startIndex: number, batchSize: number, processedInBatch: number, hitsFound: number, lastBatch: boolean): void {
    if (pi.cancelled && processedInBatch == hitsFound) {
      // We're cancelled!
      console.info('Processing cancelled: ' + pi.id + ', successCount: ' + pi.successCount + ', failedCount: ' + pi.failedCount);
    }
    else if (lastBatch && processedInBatch == hitsFound) {
      // We're done!
      console.info('Processing completed: ' + pi.id + ', successCount: ' + pi.successCount + ', failedCount: ' + pi.failedCount);
    }
    else if (!lastBatch && processedInBatch == batchSize) {
      // There's more...
      this.recognizeBatch(pi, rr, startIndex + batchSize, batchSize);
    }
  }

  private handleError(message: string, req, res, statusCode: number = 500): void {
    console.error('API call failed: ' + req.method + ' "' + req.originalUrl + '" with body: ' + JSON.stringify(req.body) + ' Error: ' + message);
    res.status(statusCode).send(message);
  }
}

class ProcessInfo {
  public id: string;
  public start: Date; // TODO: implement
  public finish: Date; // TODO: implement
  public request: RecognizeRequest;
  public cancelled: boolean = false;
  public failedCount: number = 0;
  public successCount: number = 0;

  constructor(request: RecognizeRequest) {
    this.id = uuidV4();
    this.request = request;
  }
}

class RecognizeRequest {
  public q: string;
  public num: number;
}
