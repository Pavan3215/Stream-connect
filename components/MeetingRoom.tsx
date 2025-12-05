import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Copy, Users, MonitorUp, MonitorOff, User as UserIcon, X, MapPin, Calendar, GraduationCap } from 'lucide-react';
import { signaling } from '../services/signaling';
import { User } from '../types';

interface MeetingRoomProps {
  roomId: string;
  user: User;
  onEndCall: () => void;
}

interface Participant {
  id: string;
  name: string;
  isLocal: boolean;
  avatar?: string;
  isMuted?: boolean;
  isCameraOff?: boolean;
  designation?: string;
  address?: string;
  dob?: string;
}

// Manual/Mock users - Raju, Ravi, Gireesh, Nayana, Shivu
const MOCK_PARTICIPANTS: Participant[] = [
  { 
    id: 'mock-1', 
    name: 'Raju', 
    isLocal: false, 
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Raju&backgroundColor=ffdfbf', 
    isMuted: true,
    isCameraOff: true,
    designation: 'MCA Student',
    address: 'NMIT Bangalore',
    dob: '12/03/2003'
  },
  { 
    id: 'mock-2', 
    name: 'Ravi', 
    isLocal: false, 
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ravi&backgroundColor=c0aede',
    isMuted: false,
    isCameraOff: true,
    designation: 'MCA Student',
    address: 'NMIT Bangalore',
    dob: '25/07/2003'
  },
  { 
    id: 'mock-3', 
    name: 'Gireesh', 
    isLocal: false, 
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Gireesh&backgroundColor=b6e3f4',
    isMuted: true,
    isCameraOff: true,
    designation: 'MCA Student',
    address: 'NMIT Bangalore',
    dob: '05/11/2003'
  },
  { 
    id: 'mock-4', 
    name: 'Nayana', 
    isLocal: false, 
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Nayana&backgroundColor=ffdfbf&gender=female',
    isMuted: true,
    isCameraOff: true,
    designation: 'MCA Student',
    address: 'NMIT Bangalore',
    dob: '18/09/2003'
  },
  { 
    id: 'mock-5', 
    name: 'Shivu', 
    isLocal: false, 
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Shivu&backgroundColor=d1d4f9',
    isMuted: false,
    isCameraOff: true,
    designation: 'MCA Student',
    address: 'NMIT Bangalore',
    dob: '30/01/2003'
  }
];

const MeetingRoom: React.FC<MeetingRoomProps> = ({ roomId, user, onEndCall }) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>('Waiting for others...');
  
  // Real remote user info
  const [remoteUserInfo, setRemoteUserInfo] = useState<{name: string, avatar?: string} | null>(null);
  
  const [isMicOn, setIsMicOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  
  // Profile Popup State
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  
  const iceCandidatesQueue = useRef<RTCIceCandidate[]>([]);
  
  const generateId = () => {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
          return crypto.randomUUID();
      }
      return Date.now().toString(36) + Math.random().toString(36).substring(2);
  };

  const peerId = useRef(generateId()).current;

  // WebRTC Configuration
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' }, 
    ],
  };

  const processIceQueue = async () => {
    if (!peerConnectionRef.current) return;
    while (iceCandidatesQueue.current.length > 0) {
      const candidate = iceCandidatesQueue.current.shift();
      if (candidate) {
        try {
          await peerConnectionRef.current.addIceCandidate(candidate);
        } catch (err) {
          console.error("Error processing queued ICE candidate:", err);
        }
      }
    }
  };

  useEffect(() => {
    const startCall = async () => {
      try {
        setConnectionStatus('Initializing media...');
        
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
           throw new Error("Camera blocked. Please use Localhost or HTTPS.");
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        setLocalStream(stream);

        const pc = new RTCPeerConnection(rtcConfig);
        peerConnectionRef.current = pc;

        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        pc.ontrack = (event) => {
          console.log("Received remote track", event.streams);
          if (event.streams && event.streams[0]) {
            setRemoteStream(event.streams[0]);
          } else {
             setRemoteStream((prev) => {
                const newStream = prev || new MediaStream();
                newStream.addTrack(event.track);
                return newStream;
             });
          }
        };

        pc.oniceconnectionstatechange = () => {
          if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
            setConnectionStatus('Connected');
          } else if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
            setConnectionStatus('Peer disconnected');
            setRemoteUserInfo(null);
            setRemoteStream(null);
          }
        };

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            signaling.send({
              type: 'ice-candidate',
              payload: event.candidate,
            });
          }
        };

        signaling.connect(roomId, peerId, user.name, async (msg) => {
          if (!peerConnectionRef.current) return;
          const pc = peerConnectionRef.current;

          // Capture remote user details
          if (msg.senderName) {
            setRemoteUserInfo({ 
                name: msg.senderName, 
                // Since signaling message doesn't carry avatar yet in simulating service fully, 
                // we'll generate one deterministically
                avatar: msg.senderAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(msg.senderName)}&backgroundColor=ffdfbf`
            });
          }

          try {
            switch (msg.type) {
              case 'join':
                setConnectionStatus(`${msg.senderName || 'Peer'} joined...`);
                signaling.send({ type: 'ready' });
                break;

              case 'ready':
                setConnectionStatus(`Negotiating...`);
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                signaling.send({ type: 'offer', payload: offer });
                break;

              case 'offer':
                setConnectionStatus('Connecting...');
                await pc.setRemoteDescription(new RTCSessionDescription(msg.payload));
                await processIceQueue();
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                signaling.send({ type: 'answer', payload: answer });
                break;

              case 'answer':
                setConnectionStatus('Connecting...');
                await pc.setRemoteDescription(new RTCSessionDescription(msg.payload));
                await processIceQueue();
                break;

              case 'ice-candidate':
                const candidate = new RTCIceCandidate(msg.payload);
                if (pc.remoteDescription && pc.remoteDescription.type) {
                  await pc.addIceCandidate(candidate);
                } else {
                  iceCandidatesQueue.current.push(candidate);
                }
                break;
            }
          } catch (err) {
            console.error("Signaling error:", err);
          }
        });

      } catch (err: any) {
        console.error("Error starting call:", err);
        setConnectionStatus(err.message || 'Error accessing camera/mic');
      }
    };

    startCall();

    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      signaling.disconnect();
    };
  }, [roomId, peerId, user.name]); 

  // --- Effect to attach streams ---
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(e => console.error("Remote play error:", e));
    }
  }, [remoteStream]);


  // --- Controls ---
  const toggleMic = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => track.enabled = !isMicOn);
      setIsMicOn(!isMicOn);
    }
  };

  const toggleVideo = () => {
    if (!isScreenSharing && localStream) {
      localStream.getVideoTracks().forEach(track => track.enabled = !isVideoOn);
      setIsVideoOn(!isVideoOn);
    }
  };

  const startScreenShare = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ 
        video: { cursor: 'always' } as any,
        audio: false 
      });
      screenStreamRef.current = screenStream;
      const screenTrack = screenStream.getVideoTracks()[0];
      if (peerConnectionRef.current) {
        const sender = peerConnectionRef.current.getSenders().find(s => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(screenTrack);
      }
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = screenStream;
      }
      screenTrack.onended = () => stopScreenShare();
      setIsScreenSharing(true);
    } catch (err) {
      console.error("Failed to share screen:", err);
    }
  };

  const stopScreenShare = async () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    if (localStream && peerConnectionRef.current) {
      const cameraTrack = localStream.getVideoTracks()[0];
      cameraTrack.enabled = isVideoOn;
      const sender = peerConnectionRef.current.getSenders().find(s => s.track?.kind === 'video');
      if (sender) await sender.replaceTrack(cameraTrack);
      if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
    }
    setIsScreenSharing(false);
  };

  const toggleScreenShare = () => {
    isScreenSharing ? stopScreenShare() : startScreenShare();
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    alert('Room ID copied to clipboard!');
  };

  const handleProfileClick = (participant: Participant) => {
      setSelectedParticipant(participant);
  };

  // Helper to create a participant object from the local user
  const localParticipant: Participant = {
    id: user.id,
    name: user.name,
    isLocal: true,
    avatar: user.avatar,
    designation: user.designation,
    address: user.address,
    dob: user.dob
  };

  // Helper to create a participant object from remote user
  const remoteParticipant: Participant | null = remoteUserInfo ? {
      id: 'remote',
      name: remoteUserInfo.name,
      isLocal: false,
      avatar: remoteUserInfo.avatar,
      designation: 'MCA Student', // Default per request
      address: 'NMIT Bangalore',    // Default per request
      dob: '20/05/2003'             // Default per request
  } : null;


  return (
    <div className="flex flex-col h-screen bg-brand-dark p-4 gap-4 relative">
      {/* Header */}
      <div className="flex justify-between items-center glass p-4 rounded-xl relative z-10 shrink-0">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full animate-pulse ${connectionStatus === 'Connected' ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
          <span className="font-semibold text-gray-200">{roomId}</span>
          <button onClick={copyRoomId} className="p-1 hover:bg-white/10 rounded transition-colors" title="Copy Room ID">
            <Copy size={16} className="text-gray-400" />
          </button>
        </div>
        
        <div className={`text-sm font-medium px-3 py-1 rounded-full border hidden sm:block ${connectionStatus === 'Connected' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-brand-primary/10 text-brand-primary border-brand-primary/20'}`}>
          {connectionStatus}
        </div>

        <button 
          onClick={() => setShowParticipants(!showParticipants)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${showParticipants ? 'bg-brand-primary text-white' : 'hover:bg-white/10 text-gray-300'}`}
        >
          <Users size={18} />
          <span className="text-sm font-medium hidden sm:inline">Participants</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex gap-4 relative min-h-0 overflow-hidden">
        
        {/* Video Stage - Updated to Grid Layout */}
        <div className="flex-1 flex flex-col relative overflow-y-auto custom-scrollbar">
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4 h-full p-2 auto-rows-fr">
                
                {/* 1. Real Remote User (Priority) */}
                <div 
                    onClick={() => remoteParticipant && handleProfileClick(remoteParticipant)}
                    className="bg-black rounded-2xl overflow-hidden relative border border-gray-800 shadow-2xl flex items-center justify-center group aspect-video md:aspect-auto cursor-pointer hover:border-brand-primary/50 transition-colors"
                >
                    <video 
                      ref={remoteVideoRef} 
                      autoPlay 
                      playsInline 
                      className={`w-full h-full object-contain bg-black ${!remoteStream ? 'hidden' : ''}`}
                    />
                    
                    {/* Placeholder when no remote stream */}
                    {!remoteStream && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500">
                        {remoteUserInfo ? (
                            <div className="flex flex-col items-center">
                                <img src={remoteUserInfo.avatar} alt={remoteUserInfo.name} className="w-20 h-20 rounded-full mb-4 border-2 border-brand-primary/50" />
                                <p className="font-medium text-lg">{remoteUserInfo.name}</p>
                                <p className="text-sm text-green-500 mt-1 animate-pulse">Connecting video...</p>
                            </div>
                        ) : (
                            <>
                                <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4">
                                <UserIcon size={32} />
                                </div>
                                <p className="font-medium text-center px-4">{connectionStatus}</p>
                            </>
                        )}
                      </div>
                    )}
                    
                    <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur px-3 py-1 rounded-lg text-sm font-medium text-white z-10 flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${remoteStream ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                      {remoteUserInfo ? remoteUserInfo.name : 'Waiting...'}
                    </div>
                </div>

                {/* 2. Manual/Mock Users (Raju, Ravi, Gireesh, Nayana, Shivu) */}
                {MOCK_PARTICIPANTS.map((mockUser) => (
                    <div 
                        key={mockUser.id} 
                        onClick={() => handleProfileClick(mockUser)}
                        className="bg-gray-900 rounded-2xl overflow-hidden relative border border-gray-800 shadow-xl flex items-center justify-center aspect-video md:aspect-auto cursor-pointer hover:border-brand-primary/50 transition-colors"
                    >
                        <div className="flex flex-col items-center justify-center">
                            <img 
                                src={mockUser.avatar} 
                                alt={mockUser.name}
                                className="w-24 h-24 rounded-full border-4 border-gray-800 shadow-lg mb-4" 
                            />
                            {/* Fake Audio Visualizer for Ravi who is unmuted */}
                            {mockUser.name === 'Ravi' && (
                                <div className="flex gap-1 h-4 items-end">
                                    <div className="w-1 bg-green-500 animate-[bounce_1s_infinite] h-2"></div>
                                    <div className="w-1 bg-green-500 animate-[bounce_1.2s_infinite] h-4"></div>
                                    <div className="w-1 bg-green-500 animate-[bounce_0.8s_infinite] h-3"></div>
                                </div>
                            )}
                        </div>
                        
                        <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur px-3 py-1 rounded-lg text-sm font-medium text-white z-10 flex items-center gap-2">
                             {mockUser.isMuted ? <MicOff size={14} className="text-red-400"/> : <Mic size={14} className="text-green-400"/>}
                             {mockUser.name}
                        </div>
                        
                        <div className="absolute top-4 right-4 bg-black/50 backdrop-blur p-1.5 rounded-lg text-white">
                             <VideoOff size={16} className="text-gray-400" />
                        </div>
                    </div>
                ))}

            </div>

          {/* Local Video (Floating PiP) */}
          <div 
            onClick={() => handleProfileClick(localParticipant)}
            className="absolute bottom-4 right-4 w-40 md:w-60 aspect-video bg-gray-900 rounded-xl overflow-hidden border border-gray-700 shadow-xl z-20 hover:scale-105 transition-transform cursor-pointer"
          >
             <video 
              ref={localVideoRef} 
              autoPlay 
              muted 
              playsInline 
              className={`w-full h-full ${isScreenSharing ? 'object-contain bg-black' : 'object-cover'} ${!isVideoOn && !isScreenSharing ? 'hidden' : ''} ${!isScreenSharing ? 'mirror' : ''}`}
              style={{ transform: !isScreenSharing ? 'scaleX(-1)' : 'none' }}
            />
            {!isVideoOn && !isScreenSharing && (
               <div className="w-full h-full flex items-center justify-center bg-gray-800 text-gray-500 flex-col gap-2">
                 {user.avatar && <img src={user.avatar} className="w-10 h-10 rounded-full opacity-50"/>}
                 <VideoOff size={20} />
               </div>
            )}
             <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-0.5 rounded text-[10px] text-white font-medium truncate max-w-[90%]">
              {isScreenSharing ? 'Your Screen' : 'You'}
            </div>
          </div>
        </div>

        {/* Participants Sidebar */}
        {showParticipants && (
          <div className="w-72 glass rounded-2xl p-4 flex flex-col absolute md:static right-0 top-0 bottom-0 z-30 md:z-auto h-full border-l border-white/10">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-semibold text-lg text-white">Participants</h3>
              <div className="text-xs bg-white/10 px-2 py-1 rounded text-gray-400">
                  {1 + (remoteUserInfo ? 1 : 0) + MOCK_PARTICIPANTS.length}
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
              
              {/* Me */}
              <div 
                onClick={() => handleProfileClick(localParticipant)}
                className="flex items-center gap-3 p-2 rounded-xl bg-white/5 border border-white/5 cursor-pointer hover:bg-white/10"
              >
                <img src={user.avatar} className="w-10 h-10 rounded-full bg-gray-700 object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-white">{user.name} (You)</p>
                  <p className="text-xs text-brand-primary">Host</p>
                </div>
                <div className="flex gap-1 text-gray-400">
                   {isMicOn ? <Mic size={14} className="text-green-400"/> : <MicOff size={14} className="text-red-400"/>}
                </div>
              </div>
              
              {/* Real Remote Peer */}
              {remoteUserInfo && remoteParticipant && (
                 <div 
                    onClick={() => handleProfileClick(remoteParticipant)}
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <img src={remoteUserInfo.avatar} className="w-10 h-10 rounded-full bg-purple-600 object-cover" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-white">{remoteUserInfo.name}</p>
                    <p className="text-xs text-green-400">Connected</p>
                  </div>
                  <Mic size={14} className="text-gray-400"/>
                </div>
              )}

              {/* Mock Users */}
              <div className="pt-4 border-t border-gray-700/50">
                  <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Others</p>
                  {MOCK_PARTICIPANTS.map(p => (
                    <div 
                        key={p.id} 
                        onClick={() => handleProfileClick(p)}
                        className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors opacity-75 hover:opacity-100 cursor-pointer"
                    >
                        <img src={p.avatar} className="w-10 h-10 rounded-full bg-gray-700 border border-gray-600" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate text-gray-200">{p.name}</p>
                            <p className="text-xs text-gray-500">{p.isMuted ? 'Muted' : 'Speaking...'}</p>
                        </div>
                        {p.isMuted ? <MicOff size={14} className="text-red-400"/> : <Mic size={14} className="text-green-400"/>}
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Controls */}
      <div className="flex justify-center items-center gap-4 py-4 glass rounded-2xl mx-auto max-w-2xl w-full shrink-0">
        <button 
          onClick={toggleMic}
          className={`p-4 rounded-full transition-all ${isMicOn ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-500 hover:bg-red-600'}`}
        >
          {isMicOn ? <Mic size={24} /> : <MicOff size={24} />}
        </button>

        <button 
          onClick={toggleVideo}
          disabled={isScreenSharing}
          className={`p-4 rounded-full transition-all ${isVideoOn ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-500 hover:bg-red-600'} ${isScreenSharing ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isVideoOn ? <Video size={24} /> : <VideoOff size={24} />}
        </button>

        <button 
          onClick={toggleScreenShare}
          className={`p-4 rounded-full transition-all ${isScreenSharing ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/30' : 'bg-gray-700 hover:bg-gray-600'}`}
        >
          {isScreenSharing ? <MonitorOff size={24} /> : <MonitorUp size={24} />}
        </button>
        
        <div className="w-px h-8 bg-gray-700 mx-2"></div>

        <button 
          onClick={onEndCall}
          className="p-4 rounded-full bg-red-500 hover:bg-red-600 transform hover:scale-110 transition-all shadow-lg shadow-red-500/30"
        >
          <PhoneOff size={28} fill="currentColor" />
        </button>
      </div>

      {/* PROFILE MODAL */}
      {selectedParticipant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => setSelectedParticipant(null)}
            ></div>
            
            {/* Modal Card */}
            <div className="relative glass bg-gray-900 border border-gray-700 w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl transform transition-all animate-[scaleIn_0.2s_ease-out]">
                
                {/* Header Background */}
                <div className="h-24 bg-gradient-to-r from-brand-primary to-brand-accent relative">
                     <button 
                        onClick={() => setSelectedParticipant(null)}
                        className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-black/40 rounded-full text-white transition-colors"
                     >
                         <X size={20} />
                     </button>
                </div>

                <div className="px-6 pb-8 relative">
                    {/* Avatar */}
                    <div className="relative -mt-12 mb-4 flex justify-center">
                         <img 
                            src={selectedParticipant.avatar} 
                            alt={selectedParticipant.name}
                            className="w-24 h-24 rounded-full border-4 border-gray-900 bg-gray-800 shadow-xl"
                         />
                         {selectedParticipant.isLocal && (
                             <div className="absolute bottom-1 right-[35%] bg-green-500 text-[10px] text-black font-bold px-2 py-0.5 rounded-full border border-gray-900">
                                 YOU
                             </div>
                         )}
                    </div>

                    <div className="text-center space-y-1 mb-6">
                        <h2 className="text-2xl font-bold text-white">{selectedParticipant.name}</h2>
                        <p className="text-brand-primary font-medium">{selectedParticipant.designation || 'MCA Student'}</p>
                    </div>

                    <div className="space-y-4 bg-white/5 rounded-2xl p-4 border border-white/5">
                        <div className="flex items-start gap-3 text-gray-300">
                             <GraduationCap className="text-brand-accent shrink-0 mt-0.5" size={18} />
                             <div>
                                 <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Designation</p>
                                 <p className="font-medium">{selectedParticipant.designation || 'MCA Student'}</p>
                             </div>
                        </div>

                        <div className="flex items-start gap-3 text-gray-300">
                             <MapPin className="text-brand-accent shrink-0 mt-0.5" size={18} />
                             <div>
                                 <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Address</p>
                                 <p className="font-medium">{selectedParticipant.address || 'NMIT Bangalore'}</p>
                             </div>
                        </div>

                        <div className="flex items-start gap-3 text-gray-300">
                             <Calendar className="text-brand-accent shrink-0 mt-0.5" size={18} />
                             <div>
                                 <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Date of Birth</p>
                                 <p className="font-medium">{selectedParticipant.dob || '01/01/2003'}</p>
                             </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
      )}

    </div>
  );
};

export default MeetingRoom;