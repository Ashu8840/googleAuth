export interface User {
  name: string;
  email: string;
  picture: string;
  uniqueName?: string;
}

export interface Subject {
  name: string;
  description: string;
  topics: string[];
}

export interface ChatMessage {
    from: string; // email of sender
    to: string; // email of receiver
    message: string;
    timestamp: number;
    fromUniqueName?: string;
}

export interface MockUser extends User {
    id: number;
    bio: string;
}
