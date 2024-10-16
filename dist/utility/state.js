"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatStateManager = void 0;
class ChatStateManager {
    constructor() {
        this.chatState = {};
    }
    createOrUpdateChat(chatId, state) {
        if (!this.chatState[chatId]) {
            this.chatState[chatId] = {
                chatId: chatId,
                assistantID: state.assistantID || "",
                vectorStoreID: state.vectorStoreID || "",
                threadId: state.threadId || "",
                uploadedDocuments: state.uploadedDocuments || [],
            };
        }
        else {
            this.chatState[chatId] = Object.assign(Object.assign({}, this.chatState[chatId]), state);
        }
        return this.chatState[chatId];
    }
    getChat(chatId) {
        return this.chatState[chatId];
    }
    endChat(chatId) {
        delete this.chatState[chatId];
    }
}
exports.chatStateManager = new ChatStateManager();
