import Promise = require('bluebird');
import { ServiceResponse } from './service-response';
import { EmraysEmotionsApi, EmraysEmotionsApiApiKeys, ImageEmotions, Emotions } from './emrays-api';
import { Config } from '../../config';

/**
 * Uses the Emrays API to detect emotions in the given file.
 */
export class Emrays {

  private emrays: EmraysEmotionsApi;
  private readFile: Function = Promise.promisify(require("fs").readFile);

  constructor() {
    this.emrays = new EmraysEmotionsApi();
    this.emrays.setApiKey(EmraysEmotionsApiApiKeys.ApiKeyAuth, Config.emraysApiKey);
  }

  public detect(inputFile: string): Promise<ServiceResponse> {
    return this.readFile(inputFile).then((data: Buffer) => {
      return this.emrays.analyzeImage(data)
        .then((imageEmotions: ImageEmotions) => {
          return Promise.resolve(this.createEmotionResponse(imageEmotions));
        })
        .catch((e: Error) => {
          return Promise.reject(new Error('Emrays image analysis failed: ' + e));
        });
    });
  }

  private createEmotionResponse(imageEmotions:ImageEmotions):ServiceResponse {
    let sr = new ServiceResponse();
    if (imageEmotions.emotions.length != 1) {
      console.warn("Unable to parse image emotions object: " + JSON.stringify(imageEmotions, null, 2));
      return sr;
    }
    let scores:Emotions = imageEmotions.emotions[0];
    sr.metadata['cf_emraysLaughterScore'] = scores.laughter;
    sr.metadata['cf_emraysSurpriseScore'] = scores.surprise;
    sr.metadata['cf_emraysLoveScore'] = scores.love;
    sr.metadata['cf_emraysSadnessScore'] = scores.sadness;
    sr.metadata['cf_emraysAngerScore'] = scores.anger;
    sr.metadata['cf_emraysCompoundEmotions'] = imageEmotions.compound;
    sr.metadata['cf_emraysImageReference'] = imageEmotions.raw;
    return sr;
  }
}