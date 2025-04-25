import React, { useEffect, useState } from "react";
import { Route, Routes, useNavigate } from "react-router-dom";
import LoginPage from "./LoginPage";
import HomePage from "./HomePage";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";

function App() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
        navigate("/"); // Redirect to home or a protected route
      } else {
        setUser(null);
        navigate("/login"); // Redirect to login
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<HomePage user={user} />} />
      {/* Add other routes here */}
    </Routes>
  );
}

export default App;
