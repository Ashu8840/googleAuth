export interface User {
  name: string;
  email: string;
  picture: string;
  uniqueName?: string;
  bio?: string;
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
