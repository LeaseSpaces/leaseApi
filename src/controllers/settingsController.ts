/* eslint-disable */

import { Request, Response } from 'express';
// eslint-disable-next-line @typescript-eslint/no-var-requires
import multer from "multer";
import fs from 'fs';
import path from 'path';
import {
    getAppSettings,
    saveAppSettings,
    updateAppSettings,
    getSmtp,
    saveSmtp,
    updateSmtp,
    testSmtp
} from '../services/settingsService';
import {
    CreateAppSettingsRequest,
    UpdateAppSettingsRequest,
    SaveSmtpRequest,
    UpdateSmtpRequest
} from '../interfaces/settings';

// Multer for uploads
const storage = multer.diskStorage({
    destination: (_req: any, _file: any, cb: any) => {
        const uploadDir = 'uploads/settings';
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (_req: any, file: any, cb: any) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

export const uploadMiddleware = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req: any, file: any, cb: any) => {
        const allowed = /jpeg|jpg|png|gif|ico|svg/;
        const ok = allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype);
        ok ? cb(null, true) : cb(new Error('Only image files are allowed'));
    }
}).single('file');

export const uploadFileController = async (req: Request & { file?: any }, res: Response) => {
    if (!req.file) {
        res.status(400).json({ error: 'No file uploaded', message: 'Please select a file to upload' });
        return;
    }
    const fileType = req.body.type;
    if (!fileType || !['logo', 'favicon'].includes(fileType)) {
        res.status(400).json({ error: 'Invalid file type', message: 'File type must be either "logo" or "favicon"' });
        return;
    }
    const url = `${req.protocol}://${req.get('host')}/uploads/settings/${req.file.filename}`;
    res.status(200).json({ url });
};

export const getAppSettingsController = async (_req: Request, res: Response) => {
    try {
        const data = await getAppSettings();
        if (!data) {
            res.status(404).json({ error: 'Settings not found', message: 'Application settings have not been configured yet' });
            return;
        }
        res.status(200).json(data);
    } catch (e) {
        res.status(500).json({ error: 'Internal server error', message: 'Failed to retrieve application settings' });
    }
};

export const saveAppSettingsController = async (req: Request, res: Response) => {
    try {
        const body: CreateAppSettingsRequest = req.body;
        if (!body.appName) {
            res.status(400).json({ error: 'Validation error', message: 'appName is required' });
            return;
        }
        const saved = await saveAppSettings(body);
        res.status(201).json(saved);
    } catch (e: any) {
        console.log("saveAppSettingsController ==>", e?.message)
        res.status(500).json({ error: 'Internal server error', message: 'Failed to save application settings' });
    }
};

export const updateAppSettingsController = async (req: Request, res: Response) => {
    try {
        const body: UpdateAppSettingsRequest = req.body;
        const updated = await updateAppSettings(body);
        if (!updated) {
            res.status(404).json({ error: 'Settings not found', message: 'No settings found to update' });
            return;
        }
        res.status(200).json(updated);
    } catch (e) {
        res.status(500).json({ error: 'Internal server error', message: 'Failed to update application settings' });
    }
};

export const getSMTPConfigController = async (_req: Request, res: Response) => {
    try {
        const cfg = await getSmtp();
        if (!cfg) {
            res.status(404).json({ error: 'SMTP configuration not found', message: 'SMTP settings have not been configured yet' });
            return;
        }
        res.status(200).json(cfg);
    } catch (e) {
        res.status(500).json({ error: 'Internal server error', message: 'Failed to retrieve SMTP configuration' });
    }
};

export const saveSMTPConfigController = async (req: Request, res: Response) => {
    try {
        const body: SaveSmtpRequest = req.body;
        const required: (keyof SaveSmtpRequest)[] = ['host', 'port', 'username', 'password', 'encryption', 'fromEmail', 'fromName', 'isActive'];
        for (const f of required) {
            if ((body as any)[f] === undefined || (body as any)[f] === null || (body as any)[f] === '') {
                res.status(400).json({ error: 'Validation error', message: `${f} is required` });
                return;
            }
        }
        const saved = await saveSmtp(body);
        res.status(201).json(saved);
    } catch (e) {
        res.status(500).json({ error: 'Internal server error', message: 'Failed to save SMTP configuration' });
    }
};

export const updateSMTPConfigController = async (req: Request, res: Response) => {
    try {
        const body: UpdateSmtpRequest = req.body;
        const updated = await updateSmtp(body);
        if (!updated) {
            res.status(404).json({ error: 'SMTP configuration not found', message: 'No SMTP configuration found to update' });
            return;
        }
        res.status(200).json(updated);
    } catch (e) {
        res.status(500).json({ error: 'Internal server error', message: 'Failed to update SMTP configuration' });
    }
};

export const testSMTPConnectionController = async (req: Request, res: Response) => {
    try {
        const result = await testSmtp(req.body);
        res.status(200).json(result);
    } catch (e) {
        res.status(500).json({ error: 'Internal server error', message: 'Failed to test SMTP connection' });
    }
};


