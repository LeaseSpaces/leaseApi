export interface SupportFormFieldSchema {
  name: string;
  label: string;
  type: "select" | "textarea" | "text" | "email";
  required: boolean;
  minLength?: number;
  maxLength?: number;
  mustMatch?: "customerEmail";
  optionsFrom?: "categories";
}

export interface PublicSupportTicketRequest {
  categoryId?: string;
  category?: string;
  description: string;
  customerEmail: string;
  confirmEmail: string;
  customerName: string;
}

export interface SupportFormOptions {
  categories: Array<{ id: string; name: string; description?: string | null }>;
  defaultPriority: string;
  form: { fields: SupportFormFieldSchema[] };
}

export interface PublicSupportTicketResult {
  ticket: {
    id: string;
    ticketNumber: string;
    category: string;
    status: string;
    createdAt: Date;
  };
  emailSent: boolean;
  confirmationEmailSentTo: string;
  message: string;
}

export interface SupportValidationError {
  field: string;
  message: string;
}
