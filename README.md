# Introduction

This integration is currently in **beta** stage.

The Elvis image recognition server is a nodejs server application that integrates Elvis with AI image recognition services from Google, Amazon and Clarifai. It uses these services to detect labels, landmarks and emotions.

This readme describes how to setup the integration. Please read this [blog article](https://www.woodwing.com/blog/post/157564395070/ai-dam-five-ways-ai-can-make-life-easier-for) if you want to know more about Elvis and AI.

# Prerequisites

- Fully installed and licensed Elvis server (5.24 or higher). You can obtain Elvis via: https://www.woodwing.com/en/digital-asset-management-system
- Server where the image recognition server can run (can be on the same machine where Elvis runs)
- API user license 

# Installation steps

## Configure the Elvis Webhook

- Log-in to the Elvis web client as admin user
- Go to the management console, webhooks secion and add a new webhook
- Name: For example, "Image Recognition"
- URL: Point it to the URL where the image recognition server is running, if it's running on the same machine as Elvis, this will be: http://localhost:9090/
- Event types: `asset_create`
- Metadata to include `assetDomain`
- Save the webhook
- The generated secret token needs to be specified in the image recognition configuration later on.

Detailed information on setting up and using webhooks can be found on [Help Center](https://helpcenter.woodwing.com/hc/en-us/articles/115001884346).

## Configure Elvis metadata fields

Depending on your configuration and used services, you may need to add custom metadata fields to your Elvis installation. These custom metadata fields need to be configured in the `<Elvis Config>/custom-assetinfo.xml` file. Sample configuration files are provided in the `elvis-config` folder.

## Install the image recognition server

- Clone or download this package.
- Open src/config.ts and configure the settings (Port where this server runs, Elvis Server settings, which Image AI services to use, etc). You can either configure the settings in this config file or by setting environment variables. Note: the configured Elvis user needs to be an API user that can process all incoming webhook events.
- Install nodejs (6.9 or higher) from https://nodejs.org
- Open a terminal and go to the package folder.
- Install TypeScript via npm: `npm install -g typescript`
- Install node modules: `npm install`
- Start the server: `npm start`

# Usage

- Open the Elvis web client.
- Upload a few images.
- Enable the relevant metadata fields in the metadata panel.
- Watch the magic :)
- When there's no magic... check the terminal where the image recognition server is running for errors and make sure your configuration is correct.

# Version history

## v1.1.0
- Elvis 6 support
- Support for API users (requires Elvis 5.24 or higher)
- Improved logging: log lines with date and time

## v1.0.0
- Clarifai: label detection
- Google Vision: label & landmark detection
- AWS Rekognition: label & emotion detection
