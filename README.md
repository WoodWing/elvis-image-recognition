# Table of contents

<!-- 
  This TOC is auto-generated using markdown-toc: https://github.com/jonschlinkert/markdown-toc 
  If you introduce new or change existing chapters, please regenerate the TOC before committing.

  Command to regenerate (save any changes to README.md first):

  $ markdown-toc README.md -i
-->

<!-- toc -->

- [1. Introduction](#1-introduction)
- [2. Package details](#2-package-details)
- [3. Installation prerequisites](#3-installation-prerequisites)
- [4. Installation steps](#4-installation-steps)
  * [4.1 Configure Elvis metadata fields](#41-configure-elvis-metadata-fields)
  * [4.2 Optional: configure the Elvis Webhook](#42-optional-configure-the-elvis-webhook)
  * [4.3 Install the image recognition server](#43-install-the-image-recognition-server)
  * [4.4 Optional: install the Auto Tag Images plug-in](#44-optional-install-the-auto-tag-images-plug-in)
    + [4.4.1 Elvis 6.7+](#441-elvis-67)
    + [4.4.2 Elvis 5.26 - Elvis 6.6](#442-elvis-526---elvis-66)
  * [4.5 Optional: install the Web Links plug-in](#45-optional-install-the-web-links-plug-in)
  * [4.6 Optional: install the Search Similar plug-in](#46-optional-install-the-search-similar-plug-in)
  * [4.7 Optional: install the Image Search plug-in](#47-optional-install-the-image-search-plug-in)
- [5. Detect images during import](#5-detect-images-during-import)
- [6. Detect existing Elvis images](#6-detect-existing-elvis-images)
- [7. Detect images using the Image Recognition REST API](#7-detect-images-using-the-image-recognition-rest-api)
  * [7.1 Security](#71-security)
  * [7.2 POST `/api/recognize`](#72-post-apirecognize)
  * [7.3 GET `/api/recognize/:id:`](#73-get-apirecognizeid)
  * [7.4 DELETE `/api/recognize/:id:`](#74-delete-apirecognizeid)
  * [7.5 GET `/ping`](#75-get-ping)
- [8. Architecture overview](#8-architecture-overview)
  * [8.1 Directly recognize images during import](#81-directly-recognize-images-during-import)
  * [8.2 Recognize existing images in Elvis with the Auto Tag Images plug-in](#82-recognize-existing-images-in-elvis-with-the-auto-tag-images-plug-in)
- [9. Privacy and data usage](#9-privacy-and-data-usage)
- [10. Version history](#10-version-history)
  * [v2.4.0](#v240)
  * [v2.3.0](#v230)
  * [v2.2.0](#v220)
  * [v2.1.0](#v210)
  * [v2.0.0](#v200)
  * [v1.1.0](#v110)
  * [v1.0.0](#v100)

<!-- tocstop -->

# 1. Introduction

The Elvis image recognition integration is a bridge between Elvis DAM and Artificial Intelligence (AI) image recognition services from Google, Amazon, Clarifai and Emrays. It uses these services to detect tags, landmarks and do facial analysis. The gathered information is stored as searchable metadata in Elvis. Tags can also be automatically translated to other languages. The integration supports two tagging modes: on demand tagging of images that already exist in Elvis and auto tagging of images immediately after they are imported.

This readme describes how to setup the integration. Please read this [blog article](https://www.woodwing.com/en/blog/ai-dam-five-ways-ai-can-make-life-easier-for-dam-users) if you want to know more about Elvis and AI.

# 2. Package details

The integration consist of several components. The main component is the image recognition server app. This nodejs based server app handles all communication between Elvis and the AI service(s). It retrieves image previews from Elvis and sends them to the AI services for recognition. It also includes a Google Translate module to translate tags to other languages and there's a REST API that allows developers to interact with the image recognition server. 

The second component is an Elvis web client plug-in. The Auto Tag Images plugin allows users to tag existing images in Elvis. It can either tag a selection of images or all files in the selected folder.

The integrated AI services are not identical in the functionality they provide, this is what this integration supports per AI provider:

**Clarifai**
- General tagging.
- Tagging using specialized [models](https://clarifai.com/models/): Food, Travel, Wedding, Apparel and Celebrity. You can choose these models when tagging in the Elvis web client (Auto Tag Images plugin). It's also possible to link an Elvis folder to one or multiple models, that way all images imported into that folder will be automatically tagged using the configured models.
- Tagging results can be directly delivered in various languages, this is an alternative to using Google Translate.

**Google Vision**
- General tagging.
- Landmark detection: location name including GPS coordinates.
- OCR: Detect text in images
- Web entities: tags related to where the image is used on websites
- Web links: URL's to pages where the image or a similar image was linked. These links are saved in Elvis metadata fields, the Web Links panel plugin provides a simple clickable list of URL's (Elvis 6+).
- Logo detection: Detect brand logos.

**AWS Rekognition**
- General tagging.
- Facial analysis: Eyes open/closed, male/female, beard/glasses/mustache, age, etc.

**Emrays**
- Emotion detection in image
- Images are scored on the core emotions: Love, Laughter, Surprise, Sadness and Anxiety
- Images are tagged with one compound emotion that reflects a combination of the highest emotion scores.

# 3. Installation prerequisites

- Fully installed and licensed [Elvis Server](https://www.woodwing.com/en/digital-asset-management-system). 
- Minimum required version is Elvis 5.26. To use all features Elvis 6.7 or higher is required.
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
- Go to the management console, webhooks section and add a new webhook.
- Name: For example, "Image Recognition".
- URL: Point it to the URL where the image recognition server is running, if it's running on the same machine as Elvis, this will be: http://localhost:9090/.
- Event type: `asset_update_metadata`.
- Metadata to include: 
  ```
  assetDomain
  assetPath
  ```
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

This section describes how to install the Auto Tag Images plug-in. Please follow the steps relevant to the Elvis version you have installed. 

### 4.4.1 Elvis 6.7+

- This plug-in uses the REST API, ensure it's enabled in the `src/config.ts` file:  `restAPIEnabled = true`
- Open the `elvis-plugins` folder.
- Copy the `recognition_api` folder to: `<Elvis Config>/plugins/active`.
- Copy the `auto_tag_images` folder to: `<Elvis Config>/plugins/active`.
- Open `auto_tag_images/action.config.xml`.
- Point the `recognitionServerUrl` setting to the image recognition server: `/plugins/recognition_api`.
- [Activate](https://helpcenter.woodwing.com/hc/en-us/articles/115002644606) the plugins.

### 4.4.2 Elvis 5.26 - Elvis 6.6

**Security note: Using this plug-in with Elvis 5.26 - Elvis 6.6 is less secure as it requires the image recognition server API te be publicly exposed to end users. If you want to secure the API, upgrade to Elvis 6.7 or higher and follow the 6.7+ instructions.**

- This plug-in uses the REST API, ensure it's enabled in the `src/config.ts` file:  `restAPIEnabled = true`
- Open the `elvis-plugins` folder.
- Copy the `auto_tag_images` folder to: `<Elvis Config>/plugins/active`.
- Open `auto_tag_images/action.config.xml`.
- Point the `recognitionServerUrl` setting to the image recognition server. This URL must be accessible for users using this plugin (not localhost).
- [Activate](https://helpcenter.woodwing.com/hc/en-us/articles/115002644606) the plugin.

## 4.5 Optional: install the Web Links plug-in

- Open the `elvis-plugins` folder.
- Copy the `web_links` folder to: `<Elvis Config>/plugins/active`.
- [Activate](https://helpcenter.woodwing.com/hc/en-us/articles/115002644606) the plugin.

## 4.6 Optional: install the Search Similar plug-in

- Open the `elvis-plugins` folder.
- Copy the `search_similar` folder to: `<Elvis Config>/plugins/active`.
- [Activate](https://helpcenter.woodwing.com/hc/en-us/articles/115002644606) the plugin.

## 4.7 Optional: install the Image Search plug-in

- Open the `elvis-plugins` folder.
- Copy the `image_search` folder to: `<Elvis Config>/plugins/active`.
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

# 7. Detect images using the Image Recognition REST API

The REST API allows developers to interact with the image recognition server.

## 7.1 Security

This API has no build in authentication mechanism. There are however several ways to protect it:
- Elvis 6.7+: Use an Elvis API Plugin to proxy the REST API through Elvis. This way only authenticated Elvis users with a specific capability assigned are able to use the REST API. See the Auto Tag Images plugin installation chapter for installation details.
- Network / firewall: Open the ip & port of the image recognition server exclusively to your integration and/or the Elvis server.

## 7.2 POST `/api/recognize`

Starts the image recognition for a given query, immediately returns a process id that can be used to track progress or cancel the operation.

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

## 7.3 GET `/api/recognize/:id:`

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

## 7.4 DELETE `/api/recognize/:id:`

Cancel a recognition process.

Request
```bash
$ curl -X DELETE http://localhost:9090/api/recognize/5e5949d8-3c58-4074-84a4-a63fa10286f8
```

Response (200 OK)
```
Process with id "5e5949d8-3c58-4074-84a4-a63fa10286f8" is being cancelled.
```

## 7.5 GET `/ping`

Simple ping to validate that if the server is still online.

Request
```bash
$ curl -X GET http://localhost:9090/ping
```

Response (200 OK)
```json
{
  "uptime": 2451.638
}
```

# 8. Architecture overview

Images can either be detected directly during import or on demand using the Auto Tag Images web client plug-in. The schemas in this chapter describe the process flow.

## 8.1 Directly recognize images during import

![recognize images during import](https://github.com/WoodWing/elvis-image-recognition/blob/master/readme-files/architecture-recognize-during-import.png "recognize images during import")

## 8.2 Recognize existing images in Elvis with the Auto Tag Images plug-in

![auto tag images](https://github.com/WoodWing/elvis-image-recognition/blob/master/readme-files/architecture-auto-tag-images.png "auto tag images")

# 9. Privacy and data usage

As explained in the architecture overview, the image recognition server sends preview images to the configured AI vendors. These vendors all have their own privacy policies when it comes to data usage and storage. Some of them use your data to improve machine learning services and for analytics. For details, please consult the privacy policy of your AI vendor(s):

- [AWS Rekognition Data Privacy](https://aws.amazon.com/rekognition/faqs/#data-privacy)
- [Clarifai Privacy Policy](https://www.clarifai.com/privacy)
- [Google Cloud Vision Data Usage](https://cloud.google.com/vision/docs/data-usage)
- [Emrays Privacy Policy](https://emrays.com/privacypolicy/)

# 10. Version history

## v2.4.0
- Add simple tag based search similar functionality
- Add simple tag based image search functionality

## v2.3.0
- Add support for Emrays emotion detection

## v2.2.0
- Make corsHeader configurable.
- Add health check endpoint.
- Add HTTP request logging (file based).

## v2.1.0
- Google Vision: Implement OCR, logo detection, web entities and web links. 
- Added API security.

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
