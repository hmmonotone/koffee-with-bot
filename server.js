import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { MongoClient } from 'mongodb';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import OpenAI from 'openai';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const client = new MongoClient('mongodb://localhost:27017', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const __dirname = dirname(fileURLToPath(import.meta.url));

app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

app.get('/client.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(join(__dirname, 'client.js'));
});

client.connect()
  .then(() => {
    const db = client.db('chatbotDB');
    const collection = db.collection('chatHistory');

    const openai = new OpenAI();

    collection.drop()
      .then(() => {
        console.log('Chat history cleared.');
      })
      .catch((err) => {
        console.error('Error clearing chat history:', err);
      });

    io.on('connection', (socket) => {
      socket.on('request chat history', async () => {
        try {
          const history = await collection.find({}).toArray();
          const chatHistory = history.map((entry) => {
            if (entry.userMessage) return { role: 'user', content: entry.userMessage };
            if (entry.botMessage) return { role: 'assistant', content: entry.botMessage };
            return null;
          }).filter(Boolean);
    
          const stringifiedHistory = chatHistory.map((message) => JSON.stringify(message));
    
          socket.emit('chat history', stringifiedHistory);
        } catch (error) {
          console.error('Error retrieving chat history:', error);
        }
      });

      socket.on('chat message', async (msg) => {
        await collection.insertOne({ userMessage: msg });

        try {
          const history = await collection.find({}).toArray();
          const messagesForOpenAI = [
            { role: 'system', content: 'You are a helpful assistant.' }, // System message
          ];

          history.forEach((entry) => {
            if (entry.userMessage) messagesForOpenAI.push({ role: 'user', content: entry.userMessage });
            if (entry.botMessage) messagesForOpenAI.push({ role: 'assistant', content: entry.botMessage });
          });

          messagesForOpenAI.push({ role: 'user', content: msg });

          const completion = await openai.chat.completions.create({
            messages: messagesForOpenAI,
            model: 'gpt-3.5-turbo',
          });

          const botResponse = completion.choices[0].message.content;

          await collection.insertOne({ botMessage: botResponse });

          io.emit('chat message', botResponse);
        } catch (error) {
          console.error('Error generating bot response:', error);
        }
      });
    });
  })
  .catch((err) => {
    console.error('Error connecting to MongoDB:', err);
  });

server.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});
