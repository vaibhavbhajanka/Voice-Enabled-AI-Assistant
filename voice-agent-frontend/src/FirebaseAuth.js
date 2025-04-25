import React, { useState } from "react";
import { auth } from "./firebase";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  GoogleAuthProvider, 
  signInWithPopup
} from "firebase/auth";
import { 
  Button, 
  TextField, 
  Box, 
  Typography, 
  Container, 
  Divider, 
  Paper, 
  Grid, 
  Tabs, 
  Tab, 
  Alert,
  CircularProgress
} from "@mui/material";
import GoogleIcon from '@mui/icons-material/Google';

const FirebaseAuth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleTabChange = (event, newValue) => {
    setTab(newValue);
    setIsSignUp(newValue === 1);
    setError("");
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
        console.log("Sign up successful");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        console.log("Sign in successful");
      }
    } catch (error) {
      console.error("Authentication error:", error.code, error.message);
      setError(
        error.code === 'auth/wrong-password' ? 'Incorrect password' :
        error.code === 'auth/user-not-found' ? 'User not found' :
        error.code === 'auth/email-already-in-use' ? 'Email already in use' :
        error.code === 'auth/weak-password' ? 'Password is too weak' :
        error.code === 'auth/invalid-email' ? 'Invalid email format' :
        'Authentication failed. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError("");
    setLoading(true);
    
    try {
      const provider = new GoogleAuthProvider();
      // Use popup method for Google authentication
      const result = await signInWithPopup(auth, provider);
      console.log("Google sign in successful", result.user);
    } catch (error) {
      console.error("Google auth error:", error.code, error.message);
      
      // Handle popup blocked error
      if (error.code === 'auth/popup-blocked') {
        setError('Popup was blocked by your browser. Please enable popups for this site.');
      } else if (error.code === 'auth/popup-closed-by-user') {
        setError('Authentication canceled. Please try again.');
      } else {
        setError('Google authentication failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Paper elevation={3} sx={{ p: 4, mt: 8, borderRadius: 2 }}>
        <Typography variant="h4" align="center" gutterBottom sx={{ fontWeight: 700, color: "#7E57C2" }}>
          Welcome to Violet AI
        </Typography>
        
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs value={tab} onChange={handleTabChange} centered>
            <Tab label="Sign In" />
            <Tab label="Sign Up" />
          </Tabs>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleEmailAuth} sx={{ mt: 1 }}>
          <TextField
            margin="normal"
            required
            fullWidth
            id="email"
            label="Email Address"
            name="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            name="password"
            label="Password"
            type="password"
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            disabled={loading}
            sx={{ 
              mt: 3, 
              mb: 2, 
              backgroundColor: "#7E57C2",
              '&:hover': { backgroundColor: "#6A4FB1" } 
            }}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : (isSignUp ? "Sign Up" : "Sign In")}
          </Button>
        </Box>

        <Divider sx={{ my: 2 }}>
          <Typography variant="body2" color="text.secondary">
            OR
          </Typography>
        </Divider>

        <Grid container justifyContent="center">
          <Grid item>
            <Button
              variant="outlined"
              startIcon={loading ? <CircularProgress size={20} /> : <GoogleIcon />}
              onClick={handleGoogleAuth}
              disabled={loading}
              sx={{ 
                borderColor: "#DB4437", 
                color: "#DB4437",
                '&:hover': { 
                  borderColor: "#C73B2D",
                  backgroundColor: "rgba(219, 68, 55, 0.04)" 
                } 
              }}
            >
              Continue with Google
            </Button>
          </Grid>
        </Grid>
      </Paper>
    </Container>
  );
};

export default FirebaseAuth;
