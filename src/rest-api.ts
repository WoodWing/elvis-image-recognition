import express = require('express');
import { Router, Application } from 'express';

import { ElvisApi, AssetSearch, SearchResponse, HitElement } from './elvis-api/api';
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

  private recognizeBatch(pi: ProcessInfo, rr: RecognizeRequest, start: number = 0, num: number = 3): void {
    let search: AssetSearch = {
      firstResult: start,
      maxResultHits: num,
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

    let recognizers: any[] = [];
    let hitsFound = 0;

    this.api.searchPost(search).then((sr: SearchResponse) => {
      hitsFound = sr.hits.length;
      console.log('Processing: ' + pi.id + ', total hits: ' + sr.totalHits + ', start: ' + start + ', num: ' + num + ', hits found: ' + hitsFound + ', query: ' + rr.q);
      sr.hits.forEach(hit => {
        recognizers.push(this.recognizer.recognize(hit.id));
      });
      return Promise.all(recognizers);
    }).then((resultHits: HitElement[]) => {
      pi.successCount += resultHits.length;
      if (hitsFound === num) {
        // Process next page
        this.recognizeBatch(pi, rr, start + num, num);
      }
      else {
        // We're done
        console.log('Processing: ' + pi.id + ' completed, successCount: ' + pi.successCount + ', failedCount: ' + pi.failedCount);
      }
    }).catch((error: any) => {
      pi.failedCount++;
      console.log('Oups... ' + error.message);
    });
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