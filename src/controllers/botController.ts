import { Request, Response } from "express";
import OpenAI from "openai";
import "dotenv/config";
import fs from "fs";
import tmp from "tmp";
import { generateIdWithPrefix } from "../utility/helper";
import { chatStateManager } from "../utility/state";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
// const chatManager = new ChatStateManager();

export const handleQuestionResponse = async (req: Request, res: Response) => {
  try {
    // request data extract
    let { chatId, question } = req.body;
    const receivedFile = req.file;
    let assistantID: string | undefined;
    let vectorStoreID: string | undefined;
    let uploadedDocumentsId = [];
    let uploadedDocumentsIdName = [];

    // check chat status
    if (!chatId) {
      chatId = generateIdWithPrefix("chat");
    }

    //manage using state
    const chatState = chatStateManager.createOrUpdateChat(chatId, {
      assistantID: "",
      vectorStoreID: "",
      threadId: "",
      uploadedDocuments: [],
    });

    // console.log("uploaded docs: ", chatState.uploadedDocuments)
    // check question to select file id
//     const systemContent = `
// You are an assistant that helps users by answering questions based on the documents they have uploaded. 
// - The user may upload up to two documents. Each document has a unique file ID and a file name.
// - Based on the user's question, determine if they are asking about the first uploaded document, the second, or both.
// - If the user refers to the first document, use the file name "${chatState.uploadedDocuments[0]?.fileName}" and file ID "${chatState.uploadedDocuments[0]?.fileId}".
// - If the user refers to the second document, use the file name "${chatState.uploadedDocuments[1]?.fileName}" and file ID "${chatState.uploadedDocuments[1]?.fileId}".
// - If the user's question indicates they need information from both documents, use both files.
// - If you are unsure or the question is unclear, either make an inference based on the question or politely ask for clarification.
// -If not related to documents just give "null"
// `;

//     const completion = await openai.chat.completions.create({
//       model: "gpt-4o-mini",
//       messages: [
//         { role: "system", content: systemContent },
//         {
//           role: "user",
//           content: `Here is the user's current question: "${question}"`,
//         },
//       ],
//     });

//     const documentResponse = completion.choices[0]?.message?.content;
//     console.log("answer: ", documentResponse)


    // ===============================================================================
    // create chat assistant if not created
    if (!chatState.assistantID) {
      const assistant = await openai.beta.assistants.create({
        name: "KodeTech Assistant",
        instructions: `
          You are a friendly assistant named 'KodeTech Assistant' here to help answer user questions. Please be helpful and approachable.
          1. Use uploaded documents for responses if provided.
          2. If no documents are uploaded, use public information.
          3. Maintain a friendly, helpful tone in all responses.
          4. Suggest consulting experts when needed.
        `,
        model: "gpt-4o-mini",
        tools: [{ type: "file_search" }],
      });

      chatState.assistantID = assistant.id;
      assistantID = assistant.id;
    } else {
      assistantID = chatState.assistantID;
      console.log("Reusing existing assistant:", assistantID);
    }

    // ===============================================================================
    // create chat vector store if not created
    if (!chatState.vectorStoreID) {
      const vectorStore = await openai.beta.vectorStores.create({
        name: "Helper Docs",
        expires_after: {
          anchor: "last_active_at",
          days: 1,
        },
        chunking_strategy: {
          type: "static",
          static: {
            max_chunk_size_tokens: 300,
            chunk_overlap_tokens: 100,
          },
        },
      });

      chatState.vectorStoreID = vectorStore.id;
      vectorStoreID = vectorStore.id;
    } else {
      vectorStoreID = chatState.vectorStoreID;
      console.log("Reusing existing vector store:", vectorStoreID);
    }

    // ===============================================================================
    // if file received - file store
    if (receivedFile) {

      if (chatState.uploadedDocuments.length >= 2) {
        return res.status(400).json({ error: "You can only upload a maximum of two files." });
      }

      if (receivedFile.mimetype !== "application/pdf") {
        return res.status(400).json({ error: "Uploaded file must be a PDF." });
      }

      const tempFile = tmp.fileSync({ postfix: ".pdf" });
      await fs.promises.writeFile(tempFile.name, receivedFile.buffer);

      // Upload the document to OpenAI
      const document = await openai.files.create({
        file: fs.createReadStream(tempFile.name),
        purpose: "assistants",
      });

      // Add the file ID and filename to the state
      chatState.uploadedDocuments.push({
        fileId: document.id,
        fileName: receivedFile.originalname,
      });

      console.log("Updated chat state after file upload:", chatState);

      uploadedDocumentsId.push(document.id);
      uploadedDocumentsIdName.push(
        {
          fileId: document.id,
          fileName: receivedFile.originalname,
        }
      );
      // if (uploadedDocumentsId.length > 2) {
      //   uploadedDocumentsId.shift();
      // }

      // add to vectorstore
      await openai.beta.vectorStores.files.create(chatState.vectorStoreID, {
        file_id: document.id,
      });
      // console.log(myVectorStoreFile);

      // Ensure only the latest two documents are kept
      // if (chatState.uploadedDocuments.length > 2) {
      //   chatState.uploadedDocuments.shift();
      // }
      // if (uploadedDocumentsId.length > 2) {
      //   uploadedDocumentsId.shift();
      // }

      // Clean up temp file
      tempFile.removeCallback();
    }

    // update the assistant with vector store
    await openai.beta.assistants.update(chatState.assistantID, {
      tool_resources: {
        file_search: {
          vector_store_ids: [chatState.vectorStoreID],
        },
      },
    });
    console.log("Uploaded documents ID: ", chatState.uploadedDocuments);


    // create thread if null
    if (!chatState.threadId || chatState.threadId === "") {
      const thread = await openai.beta.threads.create({
        messages: [
          {
            role: "user",
            content: question,
            attachments: uploadedDocumentsId.map((fileId) => ({
              file_id: fileId,
              tools: [{ type: "file_search" }],
            })),
          },
        ],
      });

      chatState.threadId = thread.id;

    } else {

      const thread = await openai.beta.threads.messages.create(chatState.threadId, {
        role: "user",
        content: question,
        attachments: uploadedDocumentsId.map((fileId) => ({
          file_id: fileId,
          tools: [{ type: "file_search" }],
        })),
      });
      console.log("thread message: ", thread.attachments?.toString)
    }


    // run
    const run = await openai.beta.threads.runs.createAndPoll(chatState.threadId, {
      assistant_id: assistantID,
    });

    const messages = await openai.beta.threads.messages.list(chatState.threadId, {
      run_id: run.id,
    });

    const message = messages.data.pop()!;
    let latestMessageContent = "";
    let citations = [];
    if (message.content[0].type === "text") {
      const { text } = message.content[0];
      const { annotations } = text;
      citations = [];

      let index = 0;
      for (let annotation of annotations) {
        const annotationWithCitation = annotation as any;

        text.value = text.value.replace(annotation.text, "[" + index + "]");

        const { file_citation } = annotationWithCitation;
        if (file_citation) {
          const citedFile = await openai.files.retrieve(file_citation.file_id);
          citations.push("[" + index + "] " + citedFile.filename);
        }
        index++;
      }
      

      latestMessageContent = text.value;
    }

    res.json({
      message: latestMessageContent,
      chatId: chatState.chatId,
    });
  } catch (error) {
    res.status(500).json({
      error: "Error handling the question response",
      details: error,
    });
  }
};
