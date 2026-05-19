export type ApplicationDocumentType =
  | "government_id"
  | "proof_of_income"
  | "reference_letters";

export interface ApplicationReference {
  name: string;
  contact: string;
}

export type DocumentVerificationStatus =
  | "pending"
  | "in_review"
  | "verified"
  | "rejected";

export interface ApplicationDocument {
  type: ApplicationDocumentType;
  fileName: string;
  url: string;
  mimeType: string;
  uploadedAt: string;
  /** Per-document status (vendor); defaults to pending */
  verificationStatus?: DocumentVerificationStatus;
}

export interface ApplicationPersonalInfoInput {
  moveInDate?: string;
  annualIncome?: number;
  currentEmployment?: string;
  references?: ApplicationReference[];
  reference1?: string;
  reference2?: string;
  message?: string;
}

export interface CreateApplicationDraftInput extends ApplicationPersonalInfoInput {
  propertyId: string;
  tenantId: number;
}

export interface SubmitApplicationInput {
  termsAccepted: boolean;
}

export interface ApplicationFormFieldSchema {
  name: string;
  label: string;
  type: "date" | "number" | "text" | "textarea" | "file" | "toggle";
  required: boolean;
  placeholder?: string;
  minLength?: number;
  maxLength?: number;
  acceptedFormats?: string[];
  step: "personal_info" | "documents" | "review";
}

export interface PropertyApplyFormResponse {
  property: {
    id: string;
    title: string;
    price: number;
    currency: string;
    rentalPeriod: string;
    monthlyRentLabel: string;
  };
  steps: Array<{
    id: "personal_info" | "documents" | "review";
    title: string;
    fields: ApplicationFormFieldSchema[];
  }>;
  existingDraft: {
    id: string;
    status: string;
    moveInDate: string | null;
    annualIncome: number | null;
    currentEmployment: string | null;
    references: ApplicationReference[];
    message: string | null;
    documents: ApplicationDocument[];
    termsAccepted: boolean;
  } | null;
}
