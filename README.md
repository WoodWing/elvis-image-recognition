# 1. Introduction

The Elvis image recognition integration is a bridge between Elvis DAM and Artificial Intellegence (AI) image recognition services from Google, Amazon and Clarifai. It uses these services to detect tags, landmarks and do facial analysis. The gathered information is stored as searchable metadata in Elvis. Tags can also be automatically translated to other languages. The integration supports two tagging modes: on demand tagging of images that already exist in Elvis and auto tagging of images immediately after they are imported.

This readme describes how to setup the integration. Please read this [blog article](https://www.woodwing.com/en/blog/ai-dam-five-ways-ai-can-make-life-easier-for-dam-users) if you want to know more about Elvis and AI.

# 2. Package details

The integration consist of several compontents. The main component is the image recognition server app. This nodejs based server app handles all communication between Elvis and the AI service(s). It retrieves image previews from Elvis and sends them to the AI services for recognition. It also includes a Google Translate module to translate tags to other languages and there's a REST API that allows developers to interact with the image recognition server. 

![recognize images during import](https://github.com/WoodWing/elvis-image-recognition/blob/master/readme-files/architecture-recognize-during-import.png "recognize images during import")

The second component is an Elvis web client plug-in. The Auto Tag Images plugin allows users to tag existing images in Elvis. It can either tag a selection of images or all files in the selected folder.

![auto tag images](https://github.com/WoodWing/elvis-image-recognition/blob/master/readme-files/architecture-auto-tag-images.png "auto tag images")

The integrated AI services are not identical in the functionality they provide, this is what this integration supports per AI provider:

**Clarifai**
- General tagging.
- Tagging using specialized [models](https://clarifai.com/models/): Food, Travel, Wedding, Apparel and Celebrity. You can choose these models when tagging in the Elvis web client (Auto Tag Images plugin). It's also possible to link an Elvis folder to one or multiple models, that way all images imported into that folder will be automatically tagged using the configured models.
- Tagging results can be directly deliverd in various languages, this is an alternative to using Google Translate.

**Google Vision**
- General tagging.
- Landmark detection: name of a location including GPS coordinates.

**AWS Rekognition**
- General tagging.
- Facial analysis: Eyes open/closed, male/female, beard/glasses/mustache, age, etc.

# 3. Installation prerequisites

- Fully installed and licensed [Elvis Server](https://www.woodwing.com/en/digital-asset-management-system) (5.26 or higher). 
- Machine where the image recognition server can run. This can be on the same machine where the Elvis Server runs or a different machine. Currently supported operating systems are Linux and OSX.
- Elvis API user license.
- An account with at least one, or optionally multiple AI vendors: [Google Vision](https://cloud.google.com/vision/), [Amazon Rekognition](https://aws.amazon.com/rekognition/) or [Clarifai](https://www.clarifai.com/).

# 4. Installation steps

This readme describes the high level installation steps. Detailed configuration information is embedded in the various configuration files. 

## 4.1 Configure Elvis metadata fields

Depending on your configuration and used services, you may need to add custom metadata fields to your Elvis installation. These custom metadata fields need to be configured in the `<Elvis Config>/custom-assetinfo.xml` file. Sample configuration files are provided in the `elvis-config` folder.

## 4.2 Optional: configure the Elvis Webhook

An Elvis webhook needs to be configured if you want to detect images directly when they are imported in Elvis. You can skip this step if you only want to use the Auto Tag Images plugin or REST API.

- Log-in to the Elvis web client as admin user.
- Go to the management console, webhooks secion and add a new webhook.
- Name: For example, "Image Recognition".
- URL: Point it to the URL where the image recognition server is running, if it's running on the same machine as Elvis, this will be: http://localhost:9090/.
- Event type: `asset_update_metadata`.
- Metadata to include: `assetDomain`.
- Save the webhook.
- The generated secret token needs to be specified in the image recognition configuration later on.

Detailed information on setting up and using webhooks can be found on [Help Center](https://helpcenter.woodwing.com/hc/en-us/articles/115001884346).

## 4.3 Install the image recognition server

The server can either be installed on the Elvis Server or on a separate machine.

- Clone or download this package.
- Open `src/config.ts` and configure the settings. You can either configure the settings in this config file or by setting environment variables. A few highlights of the settings that can be configured:
  - Webserver settings: Port, choice to run the server with http or https.
  - Elvis server settings: Webhook token, server url, username and password.
  - AI vendor settings: API keys, metadata fields where tags are stored.
  - Translation settings: Language(s) to translate to, metadata fields to store the translated tags.
- Install [nodejs](https://nodejs.org) (6.9 or higher).
- Open a terminal and go to the package folder.
- Install TypeScript via npm: `npm install -g typescript`
- Install node modules: `npm install`
- Start the server: `npm start`
- The server is correctly started when a startup message is showed.

## 4.4 Optional: install the Auto Tag Images plug-in

- This plug-in uses the REST API, ensure it's enabled in the `src/config.ts` file:  `restAPIEnabled = tue`
- Open the `elvis-plugins` folder.
- Copy the `auto_tag_images` folder to: `<Elvis Config>/plugins/active`.
- Open `auto_tag_images/action.config.xml`.
- Point the `recognitionServerUrl` setting to the image recognition server. This URL must be accessible for users using this plugin (not localhost).
- [Activate](https://helpcenter.woodwing.com/hc/en-us/articles/115002644606) the plugin.

# 5. Detect images during import

- Open the Elvis web client.
- Enable the relevant metadata fields in the metadata panel.
- Upload one or more images.
- The image recognition starts when the preview is generated by the Elvis Server.
- The metadata is shown directly in the metadata fields once the recognition process finishes.
- When there's no magic... check the terminal where the image recognition server is running for errors and make sure your configuration is correct.

# 6. Detect existing Elvis images

- Browse to a folder or perform a search.
- Select the images you want to tag (not needed when tagging a complete folder).
- Select Auto Tag Images.
- Optionally for Clarifai users: Select one or multiple tag models.
- Click start, the tagging process will start in the background and the dialog can be closed.
- Tagging progress can be followed by checking the metadata of the images

# 7. Detect images using the REST API

The REST API allows developers to interact with the image recognition server.

**BETA NOTE: This API is currently in BETA stage. All API calls are fully functional, authentication is however not yet implemented. Therefore, ensure on network level that the recognition server can only be accessed by your integration.**

## 7.1 POST /api/recognize

Starts the image recognition for a given query, immediatly returns a process id that can be used to track progress or cancel the operation.

In this example we detect all images in the `/Demo Zone` folder.

Request
```bash
$ curl -H "Content-Type: application/json" -X POST -d '{"q":"ancestorPaths:\"/Demo Zone\""}' http://localhost:9090/api/recognize
```

Response (202 ACCEPTED)
```json
{
  "processId": "5e5949d8-3c58-4074-84a4-a63fa10286f8"
}
```

## 7.2 GET /api/recognize/:id:

Retrieve progress information for a given recognition process.

Request
```bash
$ curl -X GET http://localhost:9090/api/recognize/5e5949d8-3c58-4074-84a4-a63fa10286f8
```

Response (200 OK)
```json
{
  "cancelled": false,
  "failedCount": 0,
  "successCount": 335,
  "totalCount": 3246,
  "id": "5e5949d8-3c58-4074-84a4-a63fa10286f8",
  "request": {
    "q": "(ancestorPaths:\"/Demo Zone\") AND assetDomain:image"
  }
}
```

## 7.3 DELETE /api/recognize/:id:

Cancel a recognition process.

Request
```bash
$ curl -X DELETE http://localhost:9090/api/recognize/5e5949d8-3c58-4074-84a4-a63fa10286f8
```

Response (200 OK)
```
Process with id "5e5949d8-3c58-4074-84a4-a63fa10286f8" is being cancelled.
```

# 8. Version history

## v2.0.0
- Added support for translating tags into different languages (using Google Translate).
- Added support for Clarifai models.
- New recognize REST API to detect existing images in Elvis.
- Added support for uploads using the Elvis desktop client.
- Changed default tags field to the new "Tags from AI" field, this field is introduced with Elvis 5.26.
- Changed Clarifai authentication model, now requires the API key to be configured, instead of the client request and secret.
- Refactored package structure.

## v1.1.0
- Elvis 6 support.
- Support for API users (requires Elvis 5.24 or higher).
- Improved logging: log lines with date and time.

## v1.0.0
- Clarifai: label detection.
- Google Vision: label & landmark detection.
- AWS Rekognition: label & emotion detection.
