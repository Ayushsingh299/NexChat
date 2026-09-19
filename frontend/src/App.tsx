import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Chat from './pages/Chat';
import AdminDashboard from './pages/AdminDashboard';

function App() {
  return (
    <Routes>
      <Route path="/login" element={!localStorage.getItem('token') ? <Login /> : <Navigate to="/" />} />
      <Route path="/register" element={!localStorage.getItem('token') ? <Register /> : <Navigate to="/" />} />
      <Route 
        path="/chat" 
        element={ localStorage.getItem('token') ? <Chat /> : <Navigate to="/login" /> } 
      />
      <Route 
        path="/" 
        element={<Navigate to="/chat" />} 
      />
      <Route 
        path="/admin" 
        element={ localStorage.getItem('token') ? <AdminDashboard /> : <Navigate to="/login" /> } 
      />
    </Routes>
  );
}

export default App;
