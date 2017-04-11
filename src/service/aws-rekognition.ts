import Promise = require('bluebird');
import AWS = require('aws-sdk');
import { Config } from '../config';
import { Rekognition } from 'aws-sdk';
import { AWSError } from 'aws-sdk';
import { ServiceResponse } from './service-response';

/**
 * Uses the AWS Rekognition API to detect tags and facial expressions in the given image.
 */
export class AwsRekognition {

  private rekognition: Rekognition;
  private readFile: Function = Promise.promisify(require("fs").readFile);

  constructor() {
    AWS.config.update({
      accessKeyId: Config.awsAccessKeyId,
      secretAccessKey: Config.awsSecretAccessKey,
      region: Config.awsRegion
    });

    this.rekognition = new Rekognition();
  }

  /**
   * Detect tags & facial expressions.
   * 
   * @param inputFile Full path to the image to analyze
   */
  public detect(inputFile: string): Promise<ServiceResponse> {
    // Read the file
    return this.readFile(inputFile).then((data: Buffer) => {
      // Detect faces
      let sr: ServiceResponse = new ServiceResponse();
      return this.detectFaces(data, sr);
    }).then((response: { data: Buffer, sr: ServiceResponse }) => {
      // Detect tags
      return this.detectTags(response.data, response.sr);
    }).then((sr: ServiceResponse) => {
      // Add detected tags to metadata and resolve
      if (Config.awsTagsField && sr.tags.length > 0) {
        sr.metadata[Config.awsTagsField] = sr.tags.join(',');
      }
      return sr;
    });
  }

  private detectFaces(data: Buffer, sr: ServiceResponse): Promise<{ data: Buffer, sr: ServiceResponse }> {
    let params: Rekognition.DetectFacesRequest = {
      Image: {
        Bytes: data
      },
      Attributes: [
        'ALL'
      ]
    };

    return new Promise<{ data: Buffer, sr: ServiceResponse }>((resolve, reject) => {
      this.rekognition.detectFaces(params, (error: AWSError, response: Rekognition.DetectFacesResponse) => {
        if (error) {
          return reject(new Error('An error occurred while getting faces from AWS Rekognition: ' + error));
        }
        if (response.FaceDetails.length == 0) {
          // Nothing found, return
          return resolve({ data, sr });
        }

        // Just work with the first result
        let fd: Rekognition.FaceDetail = response.FaceDetails[0];

        let properties: string[] = this.getFaceProps(fd, ['Beard', 'Eyeglasses', 'EyesOpen', 'MouthOpen', 'Mustache', 'Smile', 'Sunglasses']);
        if (properties.length > 0) {
          sr.metadata.cf_personProperties = properties.join(',');
        }

        let emotions: string[] = [];
        fd.Emotions.forEach(emotion => {
          if (emotion.Confidence >= 80) {
            emotions.push(emotion.Type.toLowerCase());
          }
        });

        if (emotions.length > 0) {
          sr.metadata.cf_personEmotions = emotions.join(',');
        }

        if (fd.Gender.Confidence >= 95) {
          sr.metadata.cf_personGender = fd.Gender.Value;
        }

        sr.metadata.cf_personAgeMin = fd.AgeRange.Low;
        sr.metadata.cf_personAgeMax = fd.AgeRange.High;

        resolve({ data, sr });
      });
    });
  }

  private getFaceProps(faceDetails, properties): string[] {
    var props: string[] = [];
    properties.forEach(propName => {
      var property = faceDetails[propName];
      if (property.Value && property.Confidence >= 95) {
        props.push(propName);
      }
    });
    return props;
  }

  private detectTags(data: Buffer, sr: ServiceResponse): Promise<ServiceResponse> {
    // return new Promise((resolve, reject) => {
    let params: Rekognition.DetectLabelsRequest = {
      Image: {
        Bytes: data
      },
      MaxLabels: 20,
      MinConfidence: 80
    };

    return new Promise<ServiceResponse>((resolve, reject) => {
      // Get the labels
      this.rekognition.detectLabels(params, (error: AWSError, response: Rekognition.DetectLabelsResponse) => {
        if (error) {
          return reject(new Error('An error occurred while getting labels from AWS Rekognition: ' + error));
        }
        response.Labels.forEach((label: Rekognition.Label) => {
          sr.tags.push(label.Name.toLowerCase());
        });
        resolve(sr);
      });
    });
  }
}