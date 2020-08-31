import Promise = require('bluebird');
import ClarifaiAPI = require('clarifai');
import { RateLimiter } from  'limiter';
import { Config } from '../../config';
import { Utils } from '../utils';
import { ServiceResponse } from './service-response';

/**
 * Uses the Clarifai API to detect labels in the given file.
 */
export class Clarifai {

  private clarifai: ClarifaiAPI.App;
  private readFile: Function = Promise.promisify(require("fs").readFile);
  private detectSettings: any = { maxConcepts: 20, minValue: 0.85 };
  private limiter:RateLimiter = new RateLimiter(5, 'second');

  constructor() {
    this.clarifai = new ClarifaiAPI.App({ apiKey: Config.clarifaiAPIKey });
  }

  /**
   * Detect tags
   * 
   * @param inputFile Full path to the image to analyze
   */
  public detect(inputFile: string, models: string[] = null, assetPath: string = null): Promise<ServiceResponse> {
    if (!models || models.length == 0) {
      models = assetPath ? this.findModelForPath(assetPath) : [ClarifaiAPI.GENERAL_MODEL];
    }
    return this.readFile(inputFile).then((data: Buffer) => {
      let base64data: string = data.toString('base64');
      let promises = [];
      let sr = new ServiceResponse();
      models.forEach((model: string) => {
        switch (model) {
          case ClarifaiAPI.GENERAL_MODEL:
          case ClarifaiAPI.FOOD_MODEL:
          case ClarifaiAPI.TRAVEL_MODEL:
          case ClarifaiAPI.WEDDING_MODEL:
          case ClarifaiAPI.APPAREL_MODEL:
            promises.push(this.detectTags(base64data, model));
            break;
          case 'e466caa0619f444ab97497640cefc4dc': // Celebrity model
            promises.push(this.detectCelebrities(sr, base64data, model));
            break;
          default:
            throw new Error('Unsupported Clarifai model: ' + model);
        }
      });
      return Promise.all(promises).then((responses: string[]) => {
        // Consolidate tags into one service response
        responses.forEach((tags) => {
          sr.tags = Utils.mergeArrays(sr.tags, tags);
        });

        if (Config.clarifaiTagsField && sr.tags.length > 0) {
          sr.metadata[Config.clarifaiTagsField] = sr.tags.join(';');
        }
        return Promise.resolve(sr);
      });
    });
  }

  private findModelForPath(assetPath: string): string[] {
    let modelsMapping = Config.clarifaiFolderToModelMapping.find((mapping) => {
      return assetPath.startsWith(mapping.folder);
    });
    return modelsMapping ? modelsMapping.models : [ClarifaiAPI.GENERAL_MODEL];
  }

  private detectTags(data: string, model: any): Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => {
      this.predict(model, { base64: data }, this.detectSettings).then((response: any) => {
        let resData: any = this.getResponseData(response);
        if (resData && resData.concepts) {
          resolve(this.getTagsFromConcepts(resData.concepts));
        }
        else {
          resolve([]);
        }
      }).catch((error: any) => {
        reject(new Error('An error occurred while getting labels from Clarifai: ' + error));
      });
    });
  }

  private detectCelebrities(sr: ServiceResponse, data: string, model: any): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.predict(model, { base64: data }).then((response: any) => {
        let resData: any = this.getResponseData(response);
        if (!resData || !resData.regions) {
          return resolve();
        }
        let regions = resData.regions;
        let celebs: string[] = [];
        regions.forEach(region => {
          if (region.data && region.data.face && region.data.face.identity && region.data.face.identity.concepts) {
            let concepts: any = region.data.face.identity.concepts;
            celebs = Utils.mergeArrays(celebs, this.getTagsFromConcepts(concepts, false, this.detectSettings.minValue));
          }
        });
        if (celebs.length > 0) {
          sr.metadata['subjectPerson'] = celebs.join(', ');
        }
        resolve();
      }).catch((error: any) => {
        reject(new Error('An error occurred while getting celebrity info from Clarifai: ' + error));
      });
    });
  }

  private predict(model, data, detectSettings?): Promise<any> {
    // Rate limiting our predictions to max 5 per second as the Clarifai API is rate limited at 10/s
    return new Promise<any>((resolve, reject) => {
      this.limiter.removeTokens(1, (error, remainingRequests) => {
        // Keep the compiler happy
        remainingRequests = remainingRequests;
        if (error) {
          // Should never happen. An error can only occur if we remove more tokens than specified in the RateLimiter constructor
          reject(error)
        }
        // console.log("Remaining requests:  " + remainingRequests);
        resolve(this.clarifai.models.predict(model, data, detectSettings));
      })
    });
  }

  private getTagsFromConcepts(concepts: any, lowercase: boolean = true, score?: number): string[] {
    let tags: string[] = [];
    concepts.forEach(concept => {
      if (!score || concept.value >= score) {
        let tag: string = lowercase ? concept.name.toLowerCase() : concept.name;
        tags.push(tag);
      }
    });
    return tags;
  }

  private getResponseData(response: any): any {
    if (response.outputs && response.outputs.length > 0 && response.outputs[0].data) {
      return response.outputs[0].data;
    }
    return null;
  }
}
