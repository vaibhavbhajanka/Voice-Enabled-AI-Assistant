import React from "react";
import { Box, Typography } from "@mui/material";
import FirebaseAuth from "./FirebaseAuth";

const LoginPage = () => {
  return (
      <Box
          display="flex"
          minHeight="100vh"
          overflow="hidden"
          sx={{
            overflowY: "hidden",
            overflowX: "hidden",
          }}
      >
        <Box
            flex={1}
            display="flex"
            alignItems="center"
            justifyContent="center"
            sx={{
              bgcolor: "#f3f0ff", // optional background color
            }}
        >
          <img
              src="/violet.webp"
              alt="Signup"
              style={{
                maxWidth: "100%",
                maxHeight: "100vh", // Ensure it fits the full viewport height
                objectFit: "cover",  // Adjust this based on your image aspect ratio preference
              }}
          />
        </Box>
        <Box
            flex={1}
            display="flex"
            flexDirection="column"
            justifyContent="center"
            alignItems="center"
            padding={4}
        >
          <Typography
              variant="h1"
              gutterBottom
              sx={{
                fontFamily: "'Roboto Slab', serif", // Apply Roboto Slab
              }}
          >
            Violet AI
          </Typography>
          <Box width="100%" maxWidth={400} mt={4}>
            <FirebaseAuth />
          </Box>
        </Box>
      </Box>
  );
};

export default LoginPage;
