export class Config {
  /**
   * Port where the app runs
   */
  static port: string = process.env.IR_PORT || '9090';

  /**
   * Temporary directory used for downloading images.
   */
  static tempDir: string = process.env.IR_TEMP_DIR || './temp';

  /**
   * Elvis server url
   */
  static elvisUrl: string = process.env.IR_ELVIS_URL || 'http://localhost:8080';

  /**
   * Elvis username. 
   * 
   * The user should be able to access the preview of the image in Elvis.
   */
  static elvisUsername: string = process.env.IR_ELVIS_USER || 'admin';

  /**
   * Elvis password.
   */
  static elvisPassword: string = process.env.IR_ELVIS_PASSWORD || 'changemenow';

  /**
   * Elvis webhook token. 
   * 
   * Create a webhook that listens for "asset_create" events.
   */
  static elvisToken: string = process.env.IR_ELVIS_TOKEN || '';

  /**
   * Tags field where the unique tags from all services are stored
   */
  static elvisTagsField: string = process.env.IR_ELVIS_TAGS_FIELD || 'tags';

  /**
   * Enable or disable Clarifai image recognition.
   */
  static clarifaiEnabled: boolean = process.env.IR_CLARIFAI_ENABLED || true;

  /**
   * Clarifai CLIENT ID.
   *
   * Can be obtained by creating a Clarifai account: https://www.clarifai.com/
   */
  static clarifaiClientId: string = process.env.IR_CLARIFAI_CLIENT_ID || '';

  /**
   * Clarifai CLIENT SECRET.
   *
   * Can be obtained by creating a Clarifai account: https://www.clarifai.com/
   */
  static clarifaiClientSecret: string = process.env.IR_CLARIFAI_CLIENT_SECRET || '';

  /**
   * Elvis metadata field where Clarifai tags are stored, set to null to skip saving tags in a specific Clarifai field.
   */
  static clarifaiTagsField: string = process.env.IR_CLARIFAI_TAGS_FIELD || 'cf_tagsClarifai';

  /**
   * Enable or disable Google image recognition.
   */
  static googleEnabled: boolean = process.env.IR_GOOGLE_ENABLED || true;

  /**
   * Path to the Google application credentials file
   *
   * Can be obtained by creating a Google Cloud account: https://cloud.google.com/vision/
   */
  static googleKeyFilename: string = process.env.IR_GOOGLE_KEY_FILENAME || '';

  /**
   * Google cloud project id
   *
   * Can be obtained by creating a Google Cloud account: https://cloud.google.com/vision/
   */
  static googleProjectId: string = process.env.IR_GOOGLE_PROJECT_ID || '';

  /**
   * Elvis metadata field where Google tags are stored, set to null to skip saving tags in a specific Google field.
   */
  static googleTagsField: string = process.env.IR_GOOGLE_TAGS_FIELD || 'cf_tagsGoogle';

  /**
   * Enable or disable AWS image recognition.
   */
  static awsEnabled: boolean = process.env.IR_AWS_ENABLED || true;

  /**
   * AWS access key
   * 
   * Can be obtained by creating an AWS account: https://aws.amazon.com/
   */
  static awsAccessKeyId: string = process.env.IR_AWS_ACCESS_KEY || '';

  /**
   * AWS secret access key
   *
   * Can be obtained by creating an AWS account: https://aws.amazon.com/
   */
  static awsSecretAccessKey: string = process.env.IR_AWS_SECRET_ACCESS_KEY || '';

  /**
   * Elvis metadata field where AWS tags are stored, set to null to skip saving tags in a specific AWS field.
   */
  static awsRegion: string = process.env.IR_AWS_REGION || 'eu-west-1';

  /**
   * Elvis metadata field where AWS tags are stored, set to null to skip saving tags in a specific AWS field.
   */
  static awsTagsField: string = process.env.IR_AWS_TAGS_FIELD || 'cf_tagsAWS';

}