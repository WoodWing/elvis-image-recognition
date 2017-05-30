import express = require('express');
import { Router, Application } from 'express';

import { ElvisApi, AssetSearch, SearchResponse } from './elvis-api/api';
import { ApiManager } from './api-manager';
import { Recognizer } from './recognizer';
import { Config } from './config';
import uuidV4 = require('uuid/v4');

export class RestApi {

  private api: ElvisApi = ApiManager.getApi();
  private recognizer: Recognizer;
  private processes: ProcessInfo[] = [];

  constructor() {
    this.recognizer = new Recognizer(Config.clarifaiEnabled, Config.googleEnabled, Config.awsEnabled, Config.languages !== 'en');
  }

  public addRoutes(app: Application): void {

    let router: Router = express.Router();

    router.use((req, res, next) => {
      // Keep the compiler happy
      res = res;

      console.info('API call received: "' + req.originalUrl + '" with body: ' + JSON.stringify(req.body));

      // Make sure we go to the next routes and don't stop here
      next();
    });

    // Recognize API
    router.post('/recognize', (req, res) => {
      if (!req.body) {
        return this.handleError('Invalid request, no parameters specified.', req, res);
      }
      let rr: RecognizeRequest = req.body;
      if (!rr.q) {
        return this.handleError('Invalid request, parameter "q" is required.', req, res);
      }

      let pi: ProcessInfo = new ProcessInfo(rr);
      this.processes[pi.id] = pi;

      res.status(202).json({ processId: pi.id });

      this.recognizeBatch(pi, rr);
    });

    // Prefix API's with /api
    app.use('/api', router);
  }

  private recognizeBatch(pi: ProcessInfo, rr: RecognizeRequest, startIndex: number = 0, batchSize: number = 3): void {
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

    // let recognizers: any[] = [];
    // let hitsFound;
    let processedInBatch: number = 0;
    let lastBatch: boolean = false;

    this.api.searchPost(search).then((sr: SearchResponse) => {
      lastBatch = sr.hits.length < batchSize;
      console.log('Processing: ' + pi.id + ', total hits: ' + sr.totalHits + ', startIndex: ' + startIndex + ', batchSize: ' + batchSize + ', hits found: ' + sr.hits.length + ', query: ' + rr.q);
      sr.hits.forEach((hit) => {
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
      // Search failed
      console.error('Search failed for query: ' + rr.q + '. Error details: ' + error.stack);
    });
  }

  private nextBatchHandler(pi: ProcessInfo, rr: RecognizeRequest, startIndex: number, batchSize: number, processedInBatch: number, hitsFound: number, lastBatch: boolean): void {
    if (!lastBatch && processedInBatch == batchSize) {
      // There's more...
      this.recognizeBatch(pi, rr, startIndex + batchSize, batchSize);
    }
    else if (lastBatch && processedInBatch == hitsFound) {
      // We're done!
      console.log('Processing: ' + pi.id + ' completed, successCount: ' + pi.successCount + ', failedCount: ' + pi.failedCount);
    }
  }

  private handleError(message: string, req, res): void {
    console.error('API call failed: "' + req.originalUrl + '" with body: ' + JSON.stringify(req.body) + ' Error: ' + message);
    res.status(500).send(message);
  }
}

class ProcessInfo {
  public id: string;
  public start: Date;
  public finish: Date;
  public request: RecognizeRequest;
  public cancel: boolean = false;
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