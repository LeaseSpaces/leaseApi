/* eslint-disable */

export interface AppSettings {
    id: string;
    appName: string;
    logoUrl: string;
    faviconUrl: string;
    googleMapsApiKey: string;
    allowedRegions: string[];
    primaryColor: string;
    secondaryColor: string;
    supportEmail: string;
    supportPhone: string;
    termsAndConditions: string;
    privacyPolicy: string;
    aboutPage: string;
    disclaimer: string;
    emailFooterText: string;
    emailHeaderText: string;
    websiteUrl: string;
    companyAddress: string;
    companyPhone: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface SmtpConfig {
    host: string;
    port: number;
    username: string;
    password: string;
    useSsl: boolean;
    useStartTls: boolean;
    timeout: number;
    fromEmail: string;
    fromName: string;
    isActive: boolean;
}

export interface CreateAppSettingsRequest {
    appName: string;
    logoUrl?: string;
    faviconUrl?: string;
    googleMapsApiKey?: string;
    allowedRegions?: string[];
    primaryColor?: string;
    secondaryColor?: string;
    supportEmail?: string;
    supportPhone?: string;
    termsAndConditions?: string;
    privacyPolicy?: string;
    aboutPage?: string;
    disclaimer?: string;
    emailFooterText?: string;
    emailHeaderText?: string;
    websiteUrl?: string;
    companyAddress?: string;
    companyPhone?: string;
}

export interface UpdateAppSettingsRequest extends Partial<CreateAppSettingsRequest> { }

export interface SaveSmtpRequest extends SmtpConfig { }

export interface UpdateSmtpRequest extends Partial<SmtpConfig> { }

export interface TestSmtpRequest {
    host: string;
    port: number;
    username: string;
    password: string;
    useSsl: boolean;
    useStartTls: boolean;
    timeout: number;
    fromEmail: string;
    fromName: string;
}

export interface TestSmtpResponse {
    success: boolean;
    message: string;
    error?: string;
}

export interface StaticPageRequest {
    content: string;
}

export interface UpdateStaticPageRequest {
    content?: string;
}

export interface FileUploadResponse {
    url: string;
}

// End
