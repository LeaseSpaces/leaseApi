export interface ProfileUpdateInput {
  name?: string;
  surname?: string;
  email?: string;
  phone?: string | null;
}

export interface DeleteAccountInput {
  confirmEmail?: string;
  otp?: string;
  password?: string;
}

export interface PublicProfile {
  id: number;
  email: string;
  name: string;
  surname: string;
  phone: string | null;
  avatarUrl: string | null;
  appRole: string | null;
  registrationType: string;
  twofa_enabled: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}
