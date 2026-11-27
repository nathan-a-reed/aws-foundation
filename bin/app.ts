import { App } from 'aws-cdk-lib';
import { loadConfig } from '../lib/config.ts';
import { addFoundation } from '../lib/foundation-app.ts';

const app = new App();
addFoundation(app, loadConfig(process.env));
