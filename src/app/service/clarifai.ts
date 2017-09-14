import Promise = require('bluebird');
import ClarifaiAPI = require('clarifai');
import { Config } from '../../config';
import { Utils } from '../utils';
import { ServiceResponse } from './service-response';

/**
 * Uses the Clarifai API to detect labels in the given file.
 */
export class Clarifai {

  private clarifai: ClarifaiAPI.App;
  private readFile: Function = Promise.promisify(require("fs").readFile);

  constructor() {
    this.clarifai = new ClarifaiAPI.App(
      Config.clarifaiClientId,
      Config.clarifaiClientSecret
    );
  }

  /**
   * Detect tags
   * 
   * @param inputFile Full path to the image to analyze
   */
  public detect(inputFile: string, assetPath: string): Promise<ServiceResponse> {
    let models: string[] = this.findModelForPath(assetPath);
    return this.readFile(inputFile).then((data: Buffer) => {
      let base64data: string = new Buffer(data).toString('base64');
      let promises = [];
      models.forEach((model: string) => {
        promises.push(this.detectTags(base64data, model));
      });
      return Promise.all(promises).then((responses: string[]) => {
        // Consolidate into one service response
        let sr = new ServiceResponse();
        responses.forEach((tags) => {
          sr.tags = Utils.mergeArrays(sr.tags, tags);
        });

        if (Config.clarifaiTagsField && sr.tags.length > 0) {
          sr.metadata[Config.clarifaiTagsField] = sr.tags.join(',');
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
      this.clarifai.models.predict(model, { base64: data }, { maxConcepts: 30, minValue: 0.85 }).then((response: any) => {
        switch (model) {
          case ClarifaiAPI.GENERAL_MODEL:
          case ClarifaiAPI.FOOD_MODEL:
          case ClarifaiAPI.TRAVEL_MODEL:
          case ClarifaiAPI.WEDDING_MODEL:
          case ClarifaiAPI.APPAREL_MODEL:
            resolve(this.getTagsFromConcepts(response.outputs[0].data.concepts));
            break;
          case 'e466caa0619f444ab97497640cefc4dc': // Celebrity model
            resolve(this.getTagsFromRegions(response.outputs[0].data.regions));
            break;
          default:
            reject(new Error('Unsupported Clarifai model: ' + model));
        }
      }).catch((error: any) => {
        reject(new Error('An error occurred while getting labels from Clarifai: ' + JSON.stringify(error.data.status, null, 2)));
      });
    });
  }

  private getTagsFromConcepts(concepts: any): string[] {
    let tags: string[] = [];
    concepts.forEach(concept => {
      tags.push(concept.name.toLowerCase());
    });
    return tags;
  }

  private getTagsFromRegions(regions: any): string[] {
    let tags: string[] = [];
    regions.forEach(region => {
      if (region.data && region.data.face && region.data.face.identity && region.data.face.identity.concepts) {
        let concepts: any = region.data.face.identity.concepts;
        tags = Utils.mergeArrays(tags, this.getTagsFromConcepts(concepts));
      }
    });
    return tags;
  }
}
