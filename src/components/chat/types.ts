export type ChatMessage = {
  id: string;
  senderId: string;
  type: "text" | "image" | "file" | "system";
  content: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  createdAt: number;
};

export type ChatUser = {
  id: string;
  name: string;
  role: "doctor" | "patient";
};
