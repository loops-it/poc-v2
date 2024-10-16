// import { Request, Response } from "express";
// import OpenAI from "openai";
// import "dotenv/config";
// import fs from "fs";
// import tmp from "tmp";


// const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// let vectorStoreID = "";
// let uploadedDocuments = [];
// let currentThreadID = "";

// export const handleQuestionResponse = async (req: Request, res: Response) => {
//   const userQuestion = req.body.question;
//   const receivedFile = req.file;
//   let assistantID = "";
//   let document;
//   const threadIdFromRequest = req.body.threadId;

//   try {
//     if (receivedFile) {
//       console.log("File received:", receivedFile);

//       if (receivedFile.mimetype !== "application/pdf") {
//         return res.status(400).json({ error: "Uploaded file must be a PDF." });
//       }

//       const tempFile = tmp.fileSync({ postfix: ".pdf" });
      
//       await fs.promises.writeFile(tempFile.name, receivedFile.buffer);
//       if (tempFile) {
//         document = await openai.files.create({
//           file: fs.createReadStream(tempFile.name),
//           purpose: "assistants",
//         });

//         uploadedDocuments.push(document.id);
//         if (uploadedDocuments.length > 2) {
//           uploadedDocuments.shift();
//         }

//         tempFile.removeCallback();
//         console.log("Uploaded documents in if:", uploadedDocuments);
//       }
//     }
//     console.log("Uploaded documents:", uploadedDocuments);



//     if (!assistantID) {
//       const assistant = await openai.beta.assistants.create({
//         name: "KodeTech Assistant",
//         instructions: `
//           You are a friendly assistant named 'KodeTech Assistant' here to help answer user questions. Please be helpful and approachable.
      
//           1. **Document Priority**: Use the uploaded document related to the current question for your responses **if provided**.
//           2. **Public Information Fallback**: If no documents are uploaded, answer the question using available public information while remaining helpful.
//           3. **Topic Continuity**: If documents are provided, stay focused on the same document until the user explicitly introduces a new topic or mentions another uploaded document. For follow-up questions, frame your answers as "According to the uploaded document on [specific topic], what is the [specific question]?"
//           4. **Friendly Tone**: Always respond in a friendly, approachable manner, and seek clarification if needed.
//           5. **Fallback for Missing Info**: If no relevant information is available from the documents or public information, suggest looking for general information or consulting an expert.
//         `,
//         model: "gpt-4o-mini",
//         tools: [{ type: "file_search" }],
//       });
      
//       assistantID = assistant.id;
//     } else {
//       console.log("Reusing existing Assistant:", assistantID);
//     }

//     if (!vectorStoreID) {
//       console.log("Creating new vector store...");
//       let vectorStore = await openai.beta.vectorStores.create({
//         name: "Helper Docs",
//         expires_after: {
//           anchor: "last_active_at",
//           days: 1,
//         },
//         chunking_strategy: {
//           type: 'static',
//            static: {
//             max_chunk_size_tokens: 300,
//             chunk_overlap_tokens: 100
//           }
//         }
//       });
//       vectorStoreID = vectorStore.id;
//     } else {
//       console.log("Reusing existing vector store:", vectorStoreID);
//     }
    

//     await openai.beta.assistants.update(assistantID, {
//       tool_resources: { 
//         file_search: { 
//           vector_store_ids: [vectorStoreID], 
//         }
//       },
//     });

//     if (!threadIdFromRequest || threadIdFromRequest === "") {
//       const thread = await openai.beta.threads.create({
//         messages: [
//           {
//             role: "user",
//             content: userQuestion,
//             attachments: uploadedDocuments.map((fileId) => ({
//               file_id: fileId,
//               tools: [{ type: "file_search" }],
//             })),
//           },
//         ],
//       });

//       currentThreadID = thread.id;
//       console.log("Created new thread:", currentThreadID);
//     } else {

//       currentThreadID = threadIdFromRequest;
//       console.log("Reusing existing thread:", currentThreadID);

//       const thread = await openai.beta.threads.messages.create(currentThreadID, {
//         role: "user",
//         content: userQuestion,
//         attachments: uploadedDocuments.map((fileId) => ({
//           file_id: fileId,
//           tools: [{ type: "file_search" }],
//         })),
//       });
//       console.log("thread message: ",thread.attachments )
//     }
   

//     // const vectorStoreFiles = await openai.beta.vectorStores.files.list(
//     //   vectorStoreID
//     // );
//     // // console.log("files in vector store: ",vectorStoreFiles.data);
//     // console.log("files in vector store:", JSON.stringify(vectorStoreFiles.data, null, 2));
//     const run = await openai.beta.threads.runs.createAndPoll(currentThreadID, {
//       assistant_id: assistantID,
//     });

//     const messages = await openai.beta.threads.messages.list(currentThreadID, {
//       run_id: run.id,
//     });

//     const message = messages.data.pop()!;
//     let latestMessageContent = "";
//     let citations = [];
//     if (message.content[0].type === "text") {
//       const { text } = message.content[0];
//       const { annotations } = text;
//       citations = [];

//       let index = 0;
//       for (let annotation of annotations) {
//         const annotationWithCitation = annotation as any;

//         text.value = text.value.replace(annotation.text, "[" + index + "]");

//         const { file_citation } = annotationWithCitation;
//         if (file_citation) {
//           const citedFile = await openai.files.retrieve(file_citation.file_id);
//           citations.push("[" + index + "] " + citedFile.filename);
//         }
//         index++;
//       }

//       latestMessageContent = text.value;
//     }

//     res.json({
//       message: latestMessageContent,
//       citations: citations.join("\n"),
//       threadId: currentThreadID,
//       assistantID: assistantID,
//       vectorStoreID: vectorStoreID,
//       uploadedDocuments: uploadedDocuments
//     });
//   } catch (error) {
//     console.error("Error with OpenAI API:", error);
//     res.status(500).json({ error: "Error processing your request" });
//   }
// };
