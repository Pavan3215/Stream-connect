import React, { useState, useEffect } from 'react';
import { Video, Plus, LogIn, Clock, ArrowRight } from 'lucide-react';
import { User, MeetingHistory } from './types';
import { StorageService } from './services/storage';
import MeetingRoom from './components/MeetingRoom';
import Button from './components/Button';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [roomInput, setRoomInput] = useState('');
  const [history, setHistory] = useState<MeetingHistory[]>([]);
  const [nameInput, setNameInput] = useState('');

  // Initial Load
  useEffect(() => {
    const savedUser = StorageService.getUser();
    if (savedUser) setUser(savedUser);
    setHistory(StorageService.getHistory());
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;
    
    // Fix: crypto.randomUUID() is unavailable in insecure contexts (HTTP network IP).
    // We provide a robust fallback to ensure login works on local networks.
    const generateId = () => {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    };

    // Generate random date in 2003
    const randomMonth = Math.floor(Math.random() * 12);
    const randomDay = Math.floor(Math.random() * 28) + 1;
    const dob = new Date(2003, randomMonth, randomDay).toLocaleDateString('en-GB');

    const newUser: User = { 
      id: generateId(), 
      name: nameInput,
      // Generate a consistent, nice-looking avatar based on their name
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(nameInput)}&backgroundColor=b6e3f4,c0aede,d1d4f9`,
      designation: 'MCA Student',
      address: 'NMIT Bangalore',
      dob: dob
    };

    StorageService.saveUser(newUser);
    setUser(newUser);
  };

  const handleLogout = () => {
    StorageService.clearUser();
    setUser(null);
    setNameInput('');
  };

  const startMeeting = () => {
    const newRoomId = Math.random().toString(36).substring(2, 7);
    joinMeeting(newRoomId);
  };

  const joinMeeting = (roomId: string) => {
    if (!roomId.trim()) return;
    const cleanId = roomId.trim().toLowerCase();
    
    // Save to history
    StorageService.addToHistory({
      roomId: cleanId,
      timestamp: Date.now()
    });
    setHistory(StorageService.getHistory());
    
    setActiveRoomId(cleanId);
  };

  const endCall = () => {
    setActiveRoomId(null);
  };

  // --- RENDER VIEWS ---

  // 1. Meeting Room
  if (user && activeRoomId) {
    return <MeetingRoom roomId={activeRoomId} user={user} onEndCall={endCall} />;
  }

  // 2. Landing Page (Login)
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[url('https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&q=80')] bg-cover bg-center">
        <div className="absolute inset-0 bg-brand-dark/90 backdrop-blur-sm"></div>
        <div className="relative z-10 w-full max-w-md glass p-8 rounded-2xl shadow-2xl border border-white/10">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-tr from-brand-primary to-brand-accent rounded-2xl flex items-center justify-center shadow-lg mb-4 transform -rotate-3">
              <Video size={32} className="text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
              StreamConnect
            </h1>
            <p className="text-gray-400 mt-2">Serverless Peer-to-Peer Video</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Display Name</label>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Enter your name"
                className="w-full bg-brand-light/50 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all"
                required
              />
            </div>
            <Button type="submit" fullWidth>
              Get Started <ArrowRight size={18} />
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // 3. Dashboard
  return (
    <div className="min-h-screen bg-brand-dark flex flex-col items-center p-4 md:p-8">
      {/* Navbar */}
      <div className="w-full max-w-4xl flex justify-between items-center mb-12 glass p-4 rounded-2xl">
        <div className="flex items-center gap-3">
           <div className="w-10 h-10 bg-gradient-to-tr from-brand-primary to-brand-accent rounded-xl flex items-center justify-center">
              <Video size={20} className="text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight">StreamConnect</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm text-gray-400">Welcome back,</p>
            <p className="font-medium text-white">{user.name}</p>
          </div>
           {user.avatar ? (
             <img src={user.avatar} alt="Profile" className="w-10 h-10 rounded-full border border-gray-600 bg-gray-700" />
           ) : (
            <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center border border-gray-600 text-lg font-bold">
              {user.name.charAt(0).toUpperCase()}
            </div>
           )}
           <button onClick={handleLogout} className="text-xs text-gray-500 hover:text-red-400 ml-2">Logout</button>
        </div>
      </div>

      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Actions Card */}
        <div className="glass p-8 rounded-3xl border border-white/5 flex flex-col justify-center gap-6">
          <h2 className="text-2xl font-bold">Start a Call</h2>
          <p className="text-gray-400">Create a new meeting room instantly or join an existing one.</p>
          
          <Button onClick={startMeeting} className="py-4 text-lg">
            <Plus size={24} /> New Meeting
          </Button>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-[#1e293b] text-gray-500">Or join with code</span>
            </div>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <LogIn size={18} className="text-gray-500" />
              </div>
              <input
                type="text"
                placeholder="Enter room code"
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-brand-dark/50 border border-gray-600 rounded-xl focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none transition-all text-white placeholder-gray-500"
              />
            </div>
            <Button 
              variant="secondary" 
              onClick={() => joinMeeting(roomInput)}
              disabled={!roomInput.trim()}
            >
              Join
            </Button>
          </div>
        </div>

        {/* History Card */}
        <div className="glass p-8 rounded-3xl border border-white/5 flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <Clock size={24} className="text-brand-accent" />
            <h2 className="text-2xl font-bold">Recent Meetings</h2>
          </div>
          
          {history.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 min-h-[200px]">
              <Clock size={48} className="opacity-20 mb-4" />
              <p>No recent history</p>
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-1 max-h-[300px]">
              {history.map((h, i) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors group cursor-pointer border border-transparent hover:border-white/10" onClick={() => joinMeeting(h.roomId)}>
                  <div className="flex flex-col">
                    <span className="font-mono text-brand-primary font-medium tracking-wider">{h.roomId}</span>
                    <span className="text-xs text-gray-500">{new Date(h.timestamp).toLocaleDateString()} • {new Date(h.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="p-2 bg-brand-primary/20 rounded-lg text-brand-primary">
                      <LogIn size={16} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
      
      <div className="mt-12 text-center text-gray-500 text-sm max-w-md">
        <p>🔒 <span className="text-gray-400 font-medium">Secure P2P Connection</span></p>
        <p className="mt-1">For this demo, open two tabs in the same browser to simulate a connection.</p>
      </div>
    </div>
  );
}

export default App;