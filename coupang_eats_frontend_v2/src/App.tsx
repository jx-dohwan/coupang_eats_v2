import { Routes, Route } from "react-router-dom";
import Login from "./pages/Login/Login";
import VerifyEmail from "./pages/VerifyEmail/VerifyEmail";

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
      </Routes>
    </>
  );
}
