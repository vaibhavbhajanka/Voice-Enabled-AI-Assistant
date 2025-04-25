import React, { useEffect, useState, useRef } from "react";
import { Box, Typography, Button, Paper, Container, Grid, Divider, IconButton } from "@mui/material";
import { signOut } from "firebase/auth";
import { auth } from "./firebase";
import { io } from "socket.io-client";
import LogoutIcon from '@mui/icons-material/Logout';
import MicIcon from '@mui/icons-material/Mic';
import StopIcon from '@mui/icons-material/Stop';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';

const HomePage = ({ user }) => {
    const [socket, setSocket] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [mediaRecorder, setMediaRecorder] = useState(null);
    const [chunks, setChunks] = useState([]);
    const [conversation, setConversation] = useState([]);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const audioRef = useRef(null);

    useEffect(() => {
        const newSocket = io('http://localhost:5002');
        setSocket(newSocket);

        newSocket.on('greeting', (audioBuffer) => {
            playAudio(audioBuffer);
        });

        newSocket.on('transcription', (text) => {
            setConversation(prev => [...prev, { transcription: text, gptResponse: "" }]);
        });

        newSocket.on('gpt', (audioBuffer) => {
            playAudio(audioBuffer);
        });

        newSocket.on('gptResponse', (response) => {
            setConversation(prev => {
                const lastEntry = prev[prev.length - 1];
                lastEntry.gptResponse = response;
                return [...prev.slice(0, -1), lastEntry];
            });
        });

        newSocket.on('error', (errorMessage) => {
            console.error('Error:', errorMessage);
        });

        if (newSocket && user?.displayName) {
            newSocket.emit('requestGreeting', user.displayName);
        }

        return () => newSocket.disconnect();
    }, [user?.displayName]);

    const playAudio = (audioBuffer) => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }

        const blob = new Blob([audioBuffer], { type: 'audio/mp3' });
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        
        audioRef.current = audio;
        
        setIsSpeaking(true);
        
        audio.onended = () => {
            setIsSpeaking(false);
            audioRef.current = null;
            URL.revokeObjectURL(audioUrl);
        };
        
        audio.play();
    };

    const handleInterrupt = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
            setIsSpeaking(false);
        }
    };

    useEffect(() => {
        console.log("Chunks updated:", chunks.length);
    }, [chunks]);

    const handleToggleRecording = () => {
        if (!isRecording) {
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then((stream) => {
                    const recorder = new MediaRecorder(stream);
                    setMediaRecorder(recorder);

                    let localChunks = [];

                    recorder.ondataavailable = (e) => {
                        if (e.data.size > 0) {
                            localChunks.push(e.data);
                        }
                    };

                    recorder.onstop = () => {
                        if (localChunks.length > 0) {
                            const audioBlob = new Blob(localChunks, { 'type': 'audio/webm; codecs=opus' });
                            if (audioBlob.size > 0) {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                    const arrayBuffer = reader.result;
                                    const uint8Array = new Uint8Array(arrayBuffer);
                                    socket.emit('audioStream', uint8Array);
                                };
                                reader.readAsArrayBuffer(audioBlob);
                            }
                        }
                        setChunks([]);
                    };

                    recorder.start();
                    setIsRecording(true);
                })
                .catch((err) => console.error('Error capturing audio:', err));
        } else {
            if (mediaRecorder) {
                mediaRecorder.stop();
                setIsRecording(false);
            }
        }
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Error logging out: ", error);
        }
    };

    return (
        <Container maxWidth="md" sx={{ mt: 4, p: 4, borderRadius: 4, backgroundColor: "#1E1E2C", backdropFilter: "blur(10px)" }}>
            <Box display="flex" justifyContent="space-between">
                <Typography variant="h3" align="center" gutterBottom sx={{ fontWeight: 700, mb: 4, color: "#D6A2E8" }}>
                    Welcome to Violet AI, Your Personal Assistant
                </Typography>
                <IconButton onClick={handleLogout} sx={{ color: "#D6A2E8" }}>
                    <LogoutIcon />
                </IconButton>
            </Box>
            <Paper
                elevation={8}
                sx={{
                    p: 4,
                    borderRadius: 4,
                    backgroundColor: "rgba(34, 34, 51, 0.7)",
                    backdropFilter: "blur(10px)",
                    color: "#EDEDED",
                    mb: 4,
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                }}
            >
                <Typography variant="h5" align="center" gutterBottom sx={{ fontWeight: 500, mb: 2, color: "#C9A0DC" }}>
                    Hello, {user?.displayName || "User"}!
                </Typography>
                <Divider sx={{ backgroundColor: "#B084CC", mb: 4 }} />
                <Grid container spacing={2} justifyContent="center" sx={{ mb: 4 }}>
                    <Grid item>
                        <Button
                            variant="contained"
                            color={isRecording ? "error" : "primary"}
                            onClick={handleToggleRecording}
                            startIcon={isRecording ? <StopIcon /> : <MicIcon />}
                            sx={{
                                width: 180,
                                backgroundColor: isRecording ? "#FF6F61" : "#7E57C2",
                                color: "#fff",
                                '&:hover': {
                                    backgroundColor: isRecording ? "#E05D4F" : "#6A4FB1",
                                    borderColor: isRecording ? "#E05D4F" : "#6A4FB1",
                                }
                            }}
                        >
                            {isRecording ? "Stop Recording" : "Start Recording"}
                        </Button>
                    </Grid>
                    
                    <Grid item>
                        <Button
                            variant="contained"
                            onClick={handleInterrupt}
                            disabled={!isSpeaking}
                            startIcon={<VolumeOffIcon />}
                            sx={{
                                width: 180,
                                backgroundColor: "#FF6F61",
                                color: "#fff",
                                '&:hover': {
                                    backgroundColor: "#E05D4F",
                                },
                                opacity: isSpeaking ? 1 : 0.5
                            }}
                        >
                            Interrupt
                        </Button>
                    </Grid>
                </Grid>
                <Divider sx={{ backgroundColor: "#B084CC", mb: 4 }} />
                <Box sx={{ maxHeight: 300, overflowY: "auto" }}>
                    {conversation.map((entry, index) => (
                        <Paper
                            key={index}
                            elevation={3}
                            sx={{
                                mb: 2,
                                p: 2,
                                backgroundColor: "rgba(44, 44, 62, 0.8)",
                                color: "#EDEDED",
                                border: "1px solid rgba(255, 255, 255, 0.1)",
                            }}
                        >
                            <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                <strong>User:</strong> {entry.transcription}
                            </Typography>
                            <Typography variant="body1" sx={{ mt: 1 }}>
                                <strong>Violet:</strong> {entry.gptResponse}
                            </Typography>
                        </Paper>
                    ))}
                </Box>
            </Paper>
        </Container>
    );
};

export default HomePage;
