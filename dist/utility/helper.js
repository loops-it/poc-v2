"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateIdWithPrefix = generateIdWithPrefix;
function generateIdWithPrefix(prefix) {
    const uniquePart = Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
    return `${prefix}-${uniquePart}`;
}
