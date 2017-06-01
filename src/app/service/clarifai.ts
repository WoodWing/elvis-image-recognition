import Promise = require('bluebird');
import ClarifaiAPI = require('clarifai');
import { Config } from '../../config';
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
  public detect(inputFile: string): Promise<ServiceResponse> {
    // Read the file
    return this.readFile(inputFile).then((data: Buffer) => {
      let base64data: string = new Buffer(data).toString('base64');
      return this.detectTags(base64data, ClarifaiAPI.GENERAL_MODEL);
    });
  }

  private detectTags(data: string, model: any): Promise<ServiceResponse> {
    return new Promise<ServiceResponse>((resolve, reject) => {
      this.clarifai.models.predict(model, { base64: data }).then((response, error) => {
        if (error) {
          return reject(new Error('An error occurred while getting the labels from Clarifai: ' + error));
        }

        let sr: ServiceResponse = new ServiceResponse();

        // Why is this structure so deeeeeeep...
        let concepts: any = response.outputs[0].data.concepts;

        concepts.forEach(concept => {
          if (concept.value > 0.9) {
            sr.tags.push(concept.name.toLowerCase());
          }
        });

        if (Config.clarifaiTagsField && sr.tags.length > 0) {
          sr.metadata[Config.clarifaiTagsField] = sr.tags.join(',');
        }
        resolve(sr);
      });
    });
  }
}
