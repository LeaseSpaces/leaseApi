/* eslint-disable */

import express from 'express';
import {
    getAppSettingsController,
    saveAppSettingsController,
    updateAppSettingsController,
    getSMTPConfigController,
    saveSMTPConfigController,
    updateSMTPConfigController,
    testSMTPConnectionController,
    uploadMiddleware,
    uploadFileController
} from '../controllers/settingsController';

const settingsRouter = express.Router();

// Application Settings
settingsRouter.get('/app', getAppSettingsController);
settingsRouter.post('/app', saveAppSettingsController);
settingsRouter.put('/app', updateAppSettingsController);

// SMTP
settingsRouter.get('/smtp', getSMTPConfigController);
settingsRouter.post('/smtp', saveSMTPConfigController);
settingsRouter.put('/smtp', updateSMTPConfigController);
settingsRouter.post('/smtp/test', testSMTPConnectionController);

// Upload
settingsRouter.post('/upload', uploadMiddleware, uploadFileController);

export { settingsRouter };


