export interface Location {
  userId: string;
  province: string;
  city: string;
  suburb: string;
  Address: string;
}

export interface UserProfile {
  name: string;
  email: string;
  role: number;
  password: string;
  phone: string;
  image?: string;
  location: Omit<Location, "userId">;
}
