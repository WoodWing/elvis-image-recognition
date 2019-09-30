import { Application } from 'express';

import { Recognizer } from './recognizer';
import { Config } from '../config';

export class SearchByImage {

  private recognizer: Recognizer;

  constructor(public app: Application) {
    let translateEnabled: boolean = Config.languages !== '';
    this.recognizer = new Recognizer(Config.clarifaiEnabled, Config.googleEnabled, Config.awsEnabled, translateEnabled);
  }
}
