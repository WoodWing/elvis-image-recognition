import translate = require('@google-cloud/translate');
import { Google } from './google-base';
import { Config } from '../config';

/**
 * Uses the Google Translate API to translate tags.
 */
export class GoogleTranslate extends Google {

  private gt;

  private languages: string[];
  private languageTagFields: string[];

  constructor() {
    super();
    this.validateConfig().then(() => {
      if (!Config.languages) {
        throw new Error('The languages config property cannot be empty.');
      }
      if (!Config.languageTagFields) {
        throw new Error('The languageTagFields property cannot be empty.');
      }

      this.languages = Config.languages.split(',');
      this.languageTagFields = Config.languageTagFields.split(',');

      if (this.languages.length != this.languageTagFields.length) {
        throw new Error('Invalid language translation configuration, the number of languages (' + this.languages.length + ') must be equal to the number of languageTagFields (' + this.languageTagFields.length + ').');
      }

      this.gt = translate({
        keyFilename: Config.googleKeyFilename
      });
    });
  }

  /**
   * Translate text into the configured languages
   * 
   * @param text Text string to translate
   */
  public translate(text: string): Promise<string> {
    let translations = [];
    let metadata: any = {};

    for (let i: number = 0; i < this.languages.length; i++) {
      if (this.languages[i] !== 'en') {
        translations.push(this.translateTo(text, this.languages[i]));
      }
    }
    return Promise.all(translations).then((responses: any[]) => {
      responses.forEach(response => {
        let metadataField: string = this.languageTagFields[this.languages.indexOf(response.language)];
        metadata[metadataField] = response.translation;
      });
      return metadata;
    });
  }

  private translateTo(text: string, language: string): Promise<any> {
    let options: any = {
      from: 'en',
      to: language
    };

    return this.gt.translate(text, options).then((response: any) => {
      return {
        language: language,
        translation: response[0]
      };
    }).catch((error) => {
      throw new Error('An error occurred while translating tags: ' + error.message);
    });
  }
}
