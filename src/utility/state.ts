interface ChatState {
  chatId: string;
  assistantID: string;
  vectorStoreID: string;
  threadId: string;
  uploadedDocuments: { fileId: string; fileName: string }[];
}

class ChatStateManager {
  private chatState: { [key: string]: ChatState } = {};

  createOrUpdateChat(chatId: string, state: Partial<ChatState>): ChatState {
    if (!this.chatState[chatId]) {
      this.chatState[chatId] = {
        chatId: chatId,
        assistantID: state.assistantID || "",
        vectorStoreID: state.vectorStoreID || "",
        threadId: state.threadId || "",
        uploadedDocuments: state.uploadedDocuments || [],
      };
    } else {
      this.chatState[chatId] = { ...this.chatState[chatId], ...state };
    }

    return this.chatState[chatId];
  }

  getChat(chatId: string): ChatState | undefined {
    return this.chatState[chatId];
  }

  endChat(chatId: string): void {
    delete this.chatState[chatId];
  }
}

export const chatStateManager = new ChatStateManager();
