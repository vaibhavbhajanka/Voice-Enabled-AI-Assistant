const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs').promises;  // Using promises version for better async handling
const path = require('path');
const textToSpeech = require('@google-cloud/text-to-speech');
const speech = require('@google-cloud/speech');
const ffmpeg = require('fluent-ffmpeg');
const stream = require('stream');
const OpenAI = require('openai');
const osu = require('node-os-utils');
const oneLinerJoke = require('one-liner-joke');
const rateLimit = require('express-rate-limit');  // Add this package to your dependencies

require('dotenv').config();
console.log("Google credentials path:", process.env.GOOGLE_APPLICATION_CREDENTIALS);

// Create temp directory for user files
const TEMP_DIR = path.join(__dirname, 'temp');
fs.mkdir(TEMP_DIR).catch(() => {}); // Create if doesn't exist

// Add session tracking
const activeSessions = new Map();

// Add rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});

const app = express();
const server = http.createServer(app);

app.use(limiter);
app.use(cors({
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
}));

const io = new Server(server, {
    cors: {
        origin: 'http://localhost:3000',
        methods: ['GET', 'POST'],
    }
});

const textToSpeechClient = new textToSpeech.TextToSpeechClient({
    keyFileName: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

const speechClient = new speech.SpeechClient({
    keyFileName: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Add session cleanup function
const cleanupSession = async (socketId) => {
    try {
        // Remove temporary files
        const responseFile = path.join(TEMP_DIR, `response-${socketId}.mp3`);
        const greetingFile = path.join(TEMP_DIR, `greeting-${socketId}.mp3`);
        await fs.unlink(responseFile).catch(() => {});
        await fs.unlink(greetingFile).catch(() => {});
        
        // Remove session data
        activeSessions.delete(socketId);
    } catch (error) {
        console.error(`Cleanup error for session ${socketId}:`, error);
    }
};

const getCurrentTime = () => {
    const now = new Date();
    return now.toLocaleTimeString();
};

const getCurrentDate = () => {
    const now = new Date();
    return now.toLocaleDateString();
};

const getSystemStats = async () => {
    const cpuUsage = await osu.cpu.usage();
    return `CPU Usage is at ${cpuUsage}%.`;
};

const getJoke = () => {
    const joke = oneLinerJoke.getRandomJoke();
    return joke.body;
};

const handleQuery = async (transcription, socket) => {
    let responseText;
    const socketId = socket.id;

    try {
        // Check if user has an active session
        if (!activeSessions.has(socketId)) {
            activeSessions.set(socketId, {
                requestCount: 0,
                lastRequest: Date.now()
            });
        }

        // Update session metrics
        const session = activeSessions.get(socketId);
        session.requestCount++;
        session.lastRequest = Date.now();

        // Rate limiting per socket
        if (session.requestCount > 10) { // 100 requests per session
            throw new Error('Session request limit exceeded');
        }

        if (transcription.toLowerCase().includes('time')) {
            responseText = `The current time is ${getCurrentTime()}.`;
        } else if (transcription.toLowerCase().includes('date')) {
            responseText = `The current date is ${getCurrentDate()}.`;
        } else if (transcription.toLowerCase().includes('cpu')) {
            responseText = await getSystemStats();
        } else if (transcription.toLowerCase().includes('joke')) {
            responseText = getJoke();
        } else {
            responseText = await generateGPTResponse(transcription, socket);
        }

        // Emit the response back to the client
        socket.emit('gptResponse', responseText);

        // Perform TTS and send back the audio if needed
        try {
            const ttsRequest = {
                input: { text: responseText },
                voice: { languageCode: 'en-US', ssmlGender: 'FEMALE' },
                audioConfig: { audioEncoding: 'MP3' },
            };

            const [ttsResponse] = await textToSpeechClient.synthesizeSpeech(ttsRequest);
            const outputPath = path.join(TEMP_DIR, `response-${socketId}.mp3`);
            await fs.writeFile(outputPath, ttsResponse.audioContent, 'binary');
            console.log(`Audio content written to file: response-${socketId}.mp3`);

            const audioData = await fs.readFile(outputPath);
            socket.emit('gpt', audioData);
            
            // Cleanup file after sending
            await fs.unlink(outputPath).catch(() => {});
        } catch (error) {
            console.error('Error generating TTS for response:', error.message);
            socket.emit('error', 'Error generating TTS for response');
        }
    } catch (error) {
        console.error(`Error in handleQuery for session ${socketId}:`, error);
        socket.emit('error', 'An error occurred while processing your request');
    }

    return responseText;
};

const generateGPTResponse = async (transcription, socket) => {
    try {
        const gptResponse = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {role: "system", content: "You are a friendly and conversational AI assistant. Keep your responses concise and natural." },
                {role: "user", content: transcription},
            ],
        });

        const gptAnswer = gptResponse.choices[0].message.content.trim();
        socket.emit('gptResponse', gptAnswer);
        return gptAnswer;
    } catch (error) {
        console.error(`Error generating GPT response for session ${socket.id}:`, error);
        socket.emit('error', 'Error generating AI response');
        return "I'm sorry, I'm having trouble processing your request right now.";
    }
};

io.on('connection', (socket) => {
    console.log(`User connected with socket ID: ${socket.id}`);
    
    // Initialize session
    activeSessions.set(socket.id, {
        requestCount: 0,
        lastRequest: Date.now(),
        connected: Date.now()
    });

    // Handle Text-to-Speech request (greeting)
    socket.on('requestGreeting', async (userName) => {
        try {
            // Generate the personalized greeting message based on the current time
            let greetingMessage = `Welcome Back ${userName}! `;
            const hour = new Date().getHours();

            if (6 <= hour && hour < 12) {
                greetingMessage += "Good Morning Sir! ";
            } else if (12 <= hour && hour < 18) {
                greetingMessage += "Good Afternoon Sir! ";
            } else if (18 <= hour && hour < 24) {
                greetingMessage += "Good Evening Sir! ";
            } else {
                greetingMessage += "Good Night Sir! ";
            }

            greetingMessage += "Violet at your service. Please tell me how can I help you today?";

            const request = {
                input: { text: greetingMessage },
                voice: { languageCode: 'en-US', ssmlGender: 'FEMALE' },
                audioConfig: { audioEncoding: 'MP3' },
            };

            // Perform the Text-to-Speech request
            const [response] = await textToSpeechClient.synthesizeSpeech(request);

            // Define the output file path (now user-specific)
            const outputPath = path.join(TEMP_DIR, `greeting-${socket.id}.mp3`);

            // Write the binary audio content to a local file
            await fs.writeFile(outputPath, response.audioContent, 'binary');
            console.log(`Audio content written to file: greeting-${socket.id}.mp3`);

            // Read the file and emit the audio data as a buffer
            const audioData = await fs.readFile(outputPath);
            socket.emit('greeting', audioData);
            
            // Cleanup file after sending
            await fs.unlink(outputPath).catch(() => {});
        } catch (error) {
            console.error(`Error generating greeting for session ${socket.id}:`, error);
            socket.emit('error', 'Error generating greeting');
        }
    });

    socket.on('audioStream', async (audioBuffer) => {
        try {
            const session = activeSessions.get(socket.id);
            if (!session) {
                throw new Error('Invalid session');
            }

            // Rate limiting check
            const now = Date.now();
            if (now - session.lastRequest < 1000) { // 1 second cooldown
                throw new Error('Too many requests');
            }
            session.lastRequest = now;
            
            console.log(`Received audio buffer size for session ${socket.id}:`, audioBuffer.length);

            // Convert audioBuffer to a readable stream
            const bufferStream = new stream.PassThrough();
            bufferStream.end(Buffer.from(audioBuffer));

            // Convert webm to wav using ffmpeg
            let audioChunks = [];
            ffmpeg(bufferStream)
                .inputFormat('webm')
                .audioFrequency(48000)  // Match the actual sample rate
                .toFormat('wav')
                .on('error', (err) => {
                    console.error(`Error converting audio for session ${socket.id}:`, err);
                    socket.emit('error', 'Error converting audio');
                })
                .on('end', () => {
                    console.log(`Audio conversion complete for session ${socket.id}`);
                })
                .pipe(new stream.PassThrough())
                .on('data', (chunk) => {
                    audioChunks.push(chunk);
                })
                .on('end', async () => {
                    const audioBuffer = Buffer.concat(audioChunks);
                    console.log(`Converted audio buffer size for session ${socket.id}:`, audioBuffer.length);

                    const request = {
                        audio: {
                            content: audioBuffer.toString('base64'),
                        },
                        config: {
                            encoding: 'LINEAR16',
                            sampleRateHertz: 48000,  // Ensure this matches the audio file
                            languageCode: 'en-US',
                            enableAutomaticPunctuation: true,  // Optional: enable punctuation
                        },
                    };

                    try {
                        const [response] = await speechClient.recognize(request);
                        const transcription = response.results
                            .map(result => result.alternatives[0].transcript)
                            .join('\n');
                        console.log(`Transcription for session ${socket.id}: ${transcription}`);

                        // Send the transcribed text back to the client
                        socket.emit('transcription', transcription);

                        if (transcription.length > 0){
                            const answer = await handleQuery(transcription, socket);
                        }

                    } catch (error) {
                        console.error(`Error during speech recognition for session ${socket.id}: ${error.message}`);
                        socket.emit('error', 'Error during speech recognition');
                    }
                });
        } catch (error) {
            console.error(`Error during audio processing for session ${socket.id}: ${error.message}`);
            socket.emit('error', 'Error during audio processing');
        }
    });

    socket.on('disconnect', async () => {
        console.log(`User disconnected: ${socket.id}`);
        await cleanupSession(socket.id);
    });
});

// Add periodic cleanup for stale sessions
setInterval(() => {
    const now = Date.now();
    for (const [socketId, session] of activeSessions.entries()) {
        if (now - session.lastRequest > 30 * 60 * 1000) { // 30 minutes inactive
            console.log(`Cleaning up stale session: ${socketId}`);
            cleanupSession(socketId);
        }
    }
}, 5 * 60 * 1000); // Run every 5 minutes

server.listen(5002, () => {
    console.log('Server is running on http://localhost:5002');
});
// const PORT = process.env.PORT || 3001;
// server.listen(PORT, () => {
//     console.log(`Server is running on port ${PORT}`);
// });