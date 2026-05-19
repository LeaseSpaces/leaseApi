/* eslint-disable */
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import nodemailer from "nodemailer"
import {
    AppSettings,
    CreateAppSettingsRequest,
    UpdateAppSettingsRequest,
    SaveSmtpRequest,
    UpdateSmtpRequest,
    TestSmtpRequest,
    TestSmtpResponse
} from '../interfaces/settings';

const prisma = new PrismaClient();

// Encryption helpers using deterministic key/iv from env
const getCryptoConfig = () => {
    const keyHex = process.env.SMTP_SECRET_KEY!;
    const ivHex = process.env.SMTP_SECRET_IV!;
    if (!keyHex || !ivHex) throw new Error('Missing SMTP_SECRET_KEY/SMTP_SECRET_IV');
    const key = Buffer.from(keyHex, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    if (key.length !== 32 || iv.length !== 16) throw new Error('Invalid key/iv sizes');
    return { key, iv };
};

const encrypt = (plain: string): string => {
    const { key, iv } = getCryptoConfig();
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return enc.toString('hex');
};

const decrypt = (hex: string): string => {
    const { key, iv } = getCryptoConfig();
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    const dec = Buffer.concat([decipher.update(Buffer.from(hex, 'hex')), decipher.final()]);
    return dec.toString('utf8');
};

export const getAppSettings = async (): Promise<AppSettings | null> => {
    // @ts-ignore prisma client may not be generated yet during lint
    const settings = await prisma.settings.findFirst({ orderBy: { createdAt: 'desc' } });
    if (!settings) return null;
    return {
        id: settings.id,
        appName: settings.appName,
        logoUrl: settings.logoUrl,
        faviconUrl: settings.faviconUrl,
        googleMapsApiKey: settings.googleMapsApiKey,
        allowedRegions: (settings.allowedRegions as unknown as string[]) || [],
        primaryColor: settings.primaryColor,
        secondaryColor: settings.secondaryColor,
        supportEmail: settings.supportEmail,
        supportPhone: settings.supportPhone,
        termsAndConditions: settings.termsAndConditions,
        privacyPolicy: settings.privacyPolicy,
        aboutPage: settings.aboutPage,
        disclaimer: settings.disclaimer,
        emailFooterText: settings.emailFooterText,
        emailHeaderText: settings.emailHeaderText,
        websiteUrl: settings.websiteUrl,
        companyAddress: settings.companyAddress,
        companyPhone: settings.companyPhone,
        createdAt: settings.createdAt,
        updatedAt: settings.updatedAt,
    };
};

export const saveAppSettings = async (data: CreateAppSettingsRequest): Promise<AppSettings> => {
    // @ts-ignore prisma client may not be generated yet during lint
    const settings = await prisma.settings.create({
        data: {
            appName: data.appName,
            logoUrl: data.logoUrl || '',
            faviconUrl: data.faviconUrl || '',
            googleMapsApiKey: data.googleMapsApiKey || '',
            allowedRegions: (data.allowedRegions as unknown as any) || [],
            primaryColor: data.primaryColor || '#000000',
            secondaryColor: data.secondaryColor || '#000000',
            supportEmail: data.supportEmail || '',
            supportPhone: data.supportPhone || '',
            termsAndConditions: data.termsAndConditions || '',
            privacyPolicy: data.privacyPolicy || '',
            aboutPage: data.aboutPage || '',
            disclaimer: data.disclaimer || '',
            emailFooterText: data.emailFooterText || '',
            emailHeaderText: data.emailHeaderText || '',
            websiteUrl: data.websiteUrl || '',
            companyAddress: data.companyAddress || '',
            companyPhone: data.companyPhone || '',
            // SMTP initial values are not set here; saved via saveSmtp
            smtpHost: '',
            smtpPort: 587,
            smtpUsername: '',
            smtpPassword: encrypt(''),
            smtpUseSsl: false,
            smtpUseStartTls: false,
            smtpTimeout: 20000,
            smtpFromEmail: '',
            smtpFromName: '',
            smtpIsActive: false,
        }
    });

    return await getAppSettings() as AppSettings;
};

export const updateAppSettings = async (data: UpdateAppSettingsRequest): Promise<AppSettings | null> => {
    // @ts-ignore prisma client may not be generated yet during lint
    const existing = await prisma.settings.findFirst({ orderBy: { createdAt: 'desc' } });
    if (!existing) return null;
    // @ts-ignore prisma client may not be generated yet during lint
    await prisma.settings.update({
        where: { id: existing.id },
        data: {
            appName: data.appName ?? existing.appName,
            logoUrl: data.logoUrl ?? existing.logoUrl,
            faviconUrl: data.faviconUrl ?? existing.faviconUrl,
            googleMapsApiKey: data.googleMapsApiKey ?? existing.googleMapsApiKey,
            allowedRegions: (data.allowedRegions as unknown as any) ?? existing.allowedRegions,
            primaryColor: data.primaryColor ?? existing.primaryColor,
            secondaryColor: data.secondaryColor ?? existing.secondaryColor,
            supportEmail: data.supportEmail ?? existing.supportEmail,
            supportPhone: data.supportPhone ?? existing.supportPhone,
            termsAndConditions: data.termsAndConditions ?? existing.termsAndConditions,
            privacyPolicy: data.privacyPolicy ?? existing.privacyPolicy,
            aboutPage: data.aboutPage ?? existing.aboutPage,
            disclaimer: data.disclaimer ?? existing.disclaimer,
            emailFooterText: data.emailFooterText ?? existing.emailFooterText,
            emailHeaderText: data.emailHeaderText ?? existing.emailHeaderText,
            websiteUrl: data.websiteUrl ?? existing.websiteUrl,
            companyAddress: data.companyAddress ?? existing.companyAddress,
            companyPhone: data.companyPhone ?? existing.companyPhone,
        }
    });
    return await getAppSettings();
};

const staticPageFields = {
    about: 'aboutPage',
    privacy: 'privacyPolicy',
    terms: 'termsAndConditions'
} as const;

type StaticPageKey = keyof typeof staticPageFields;
type StaticPageField = (typeof staticPageFields)[StaticPageKey];

const getStaticField = (page: StaticPageKey): StaticPageField => staticPageFields[page];

export const getStaticPage = async (page: StaticPageKey): Promise<string | null> => {
    // @ts-ignore prisma client may not be generated yet during lint
    const settings = await prisma.settings.findFirst({ orderBy: { createdAt: 'desc' } });
    if (!settings) return null;
    return (settings[getStaticField(page)] as string) || '';
};

export const saveStaticPage = async (page: StaticPageKey, content: string): Promise<string> => {
    // @ts-ignore prisma client may not be generated yet during lint
    let existing = await prisma.settings.findFirst({ orderBy: { createdAt: 'desc' } });
    if (!existing) {
        existing = await prisma.settings.create({
            data: {
                appName: 'LeaseSpaces',
                logoUrl: '',
                faviconUrl: '',
                googleMapsApiKey: '',
                allowedRegions: [],
                primaryColor: '#000000',
                secondaryColor: '#000000',
                supportEmail: '',
                supportPhone: '',
                termsAndConditions: page === 'terms' ? content : '',
                privacyPolicy: page === 'privacy' ? content : '',
                aboutPage: page === 'about' ? content : '',
                disclaimer: '',
                emailFooterText: '',
                emailHeaderText: '',
                websiteUrl: '',
                companyAddress: '',
                companyPhone: '',
                smtpHost: '',
                smtpPort: 587,
                smtpUsername: '',
                smtpPassword: encrypt(''),
                smtpUseSsl: false,
                smtpUseStartTls: false,
                smtpTimeout: 20000,
                smtpFromEmail: '',
                smtpFromName: '',
                smtpIsActive: false,
            }
        });
    } else {
        // @ts-ignore prisma client may not be generated yet during lint
        await prisma.settings.update({
            where: { id: existing.id },
            data: {
                [getStaticField(page)]: content
            }
        });
    }
    return content;
};

export const updateStaticPage = async (page: StaticPageKey, content?: string): Promise<string | null> => {
    if (content === undefined) return null;
    // @ts-ignore prisma client may not be generated yet during lint
    const existing = await prisma.settings.findFirst({ orderBy: { createdAt: 'desc' } });
    if (!existing) return null;
    // @ts-ignore prisma client may not be generated yet during lint
    await prisma.settings.update({
        where: { id: existing.id },
        data: {
            [getStaticField(page)]: content
        }
    });
    return content;
};

export const deleteStaticPage = async (page: StaticPageKey): Promise<boolean> => {
    // @ts-ignore prisma client may not be generated yet during lint
    const existing = await prisma.settings.findFirst({ orderBy: { createdAt: 'desc' } });
    if (!existing) return false;
    // @ts-ignore prisma client may not be generated yet during lint
    await prisma.settings.update({
        where: { id: existing.id },
        data: {
            [getStaticField(page)]: ''
        }
    });
    return true;
};

export const getSmtp = async () => {
    // @ts-ignore prisma client may not be generated yet during lint
    const settings = await prisma.settings.findFirst({ orderBy: { createdAt: 'desc' } });
    if (!settings) return null;
    return {
        host: settings.smtpHost,
        port: settings.smtpPort,
        username: settings.smtpUsername,
        password: decrypt(settings.smtpPassword),
        useSsl: settings.smtpUseSsl,
        useStartTls: settings.smtpUseStartTls,
        timeout: settings.smtpTimeout,
        fromEmail: settings.smtpFromEmail,
        fromName: settings.smtpFromName,
        isActive: settings.smtpIsActive,
        createdAt: settings.createdAt,
        updatedAt: settings.updatedAt
    };
};

export const saveSmtp = async (data: SaveSmtpRequest) => {
    // @ts-ignore prisma client may not be generated yet during lint
    const existing = await prisma.settings.findFirst({ orderBy: { createdAt: 'desc' } });
    if (!existing) throw new Error('Settings must be created before saving SMTP');
    // @ts-ignore prisma client may not be generated yet during lint
    await prisma.settings.update({
        where: { id: existing.id },
        data: {
            smtpHost: data.host,
            smtpPort: data.port,
            smtpUsername: data.username,
            smtpPassword: encrypt(data.password),
            smtpUseSsl: data.useSsl,
            smtpUseStartTls: data.useStartTls,
            smtpTimeout: data.timeout,
            smtpFromEmail: data.fromEmail,
            smtpFromName: data.fromName,
            smtpIsActive: data.isActive
        }
    });
    return await getSmtp();
};

export const updateSmtp = async (data: UpdateSmtpRequest) => {
    // @ts-ignore prisma client may not be generated yet during lint
    const existing = await prisma.settings.findFirst({ orderBy: { createdAt: 'desc' } });
    if (!existing) return null;
    // @ts-ignore prisma client may not be generated yet during lint
    await prisma.settings.update({
        where: { id: existing.id },
        data: {
            smtpHost: data.host ?? existing.smtpHost,
            smtpPort: data.port ?? existing.smtpPort,
            smtpUsername: data.username ?? existing.smtpUsername,
            smtpPassword: data.password ? encrypt(data.password) : existing.smtpPassword,
            smtpUseSsl: data.useSsl ?? existing.smtpUseSsl,
            smtpUseStartTls: data.useStartTls ?? existing.smtpUseStartTls,
            smtpTimeout: data.timeout ?? existing.smtpTimeout,
            smtpFromEmail: data.fromEmail ?? existing.smtpFromEmail,
            smtpFromName: data.fromName ?? existing.smtpFromName,
            smtpIsActive: data.isActive ?? existing.smtpIsActive
        }
    });
    return await getSmtp();
};

export const testSmtp = async (data: TestSmtpRequest): Promise<TestSmtpResponse> => {
    try {
        const transporter = nodemailer.createTransport({
            host: data.host,
            port: data.port,
            secure: data.useSsl,
            auth: { user: data.username, pass: data.password },
            requireTLS: data.useStartTls,
            tls: data.useStartTls ? { rejectUnauthorized: false } : undefined,
            connectionTimeout: data.timeout,
            greetingTimeout: data.timeout,
            socketTimeout: data.timeout,
        });
        await transporter.verify();
        return { success: true, message: 'SMTP connection successful' };
    } catch (e) {
        return { success: false, message: 'SMTP connection failed', error: e instanceof Error ? e.message : 'Unknown error' };
    }
};


