# Tiny Money Frontend App
> A simple bank feed you can run to keep track of incoming transactions and account balances.

## Setup
1. If you don't already have one, put out a request for a **Tiny Money access token** from https://tiny.money
  1. Create a user (make note of this **user's id**, you'll need it in a minute)
  1. Connect some banks
1. Create a blank gist document with a file named `localStorage.json` in it. Make note of the **document id** in the url bar, you'll need it later
1. Create a new **Github personal access token** here -> https://github.com/settings/tokens

## Installation
1. download the repo
1. cd into the dev directory
1. run `npm install`
1. in `./js/app.js` find `tinybank_key` and insert your Tiny Money access token
1. in `./js/app.js` find `tinybank_user` and insert your user's id
1. in `./js/gist.js` find `github_key` and insert your Github personal access token
1. in `./js/gist.js` find `github_doc` and insert your document id
1. in `package.json` find the `deploy` script and replace `{{ YOUR_SURGE_DOMAIN }}` with whatever surge or custom url you want

## Development & Deployment
- `npm run dev` to develop and test (runs a server at http://localhost:8010)
- `npm run prod` to build for production
- `npm run deploy` to build and deploy via [surge](http://surge.sh/)