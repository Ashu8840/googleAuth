import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User } from '../types';

declare const io: any;

interface Participant {
    id: string;
    name: string;
}

const Video: React.FC<{ stream: MediaStream, name: string, isMuted: boolean }> = ({ stream, name, isMuted }) => {
    const ref = useRef<HTMLVideoElement>(null);
    useEffect(() => {
        if (ref.current) ref.current.srcObject = stream;
    }, [stream]);
    return (
        <div className="bg-black rounded-lg overflow-hidden relative aspect-video w-full h-full shadow-lg">
            <video ref={ref} autoPlay playsInline muted={isMuted} className="h-full w-full object-cover" />
            <div className="absolute bottom-2 left-2 bg-black/60 text-white px-2 py-1 text-sm rounded">{name}</div>
        </div>
    );
};

const Lobby: React.FC<{
    handleCreateRoom: () => void;
    handleJoinRoom: (e: React.FormEvent) => void;
    joinRoomCode: string;
    setJoinRoomCode: (code: string) => void;
    localStream: MediaStream | null;
    isConnected: boolean;
}> = ({ handleCreateRoom, handleJoinRoom, joinRoomCode, setJoinRoomCode, localStream, isConnected }) => (
    <div className="w-full max-w-md mx-auto animate-fade-in-up">
         <div className="bg-gray-800 p-6 md:p-8 rounded-lg shadow-xl mb-6">
             <h2 className="text-xl md:text-2xl font-bold text-white text-center">Create Discussion Room</h2>
             <p className="text-gray-400 text-center mt-2 text-sm md:text-base">Start a new GD room and invite others.</p>
             <button onClick={handleCreateRoom} className="w-full mt-4 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-500 transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed" disabled={!localStream || !isConnected}>
                 {isConnected ? 'Create Room' : 'Connecting...'}
             </button>
         </div>
         <div className="bg-gray-800 p-6 md:p-8 rounded-lg shadow-xl">
            <h2 className="text-xl md:text-2xl font-bold text-white text-center">Join Discussion Room</h2>
            <form onSubmit={handleJoinRoom} className="mt-4 space-y-4">
                <input type="text" placeholder="ENTER ROOM CODE" value={joinRoomCode} onChange={e => setJoinRoomCode(e.target.value.toUpperCase())}
                    className="w-full text-center tracking-widest font-mono bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:ring-2 focus:ring-blue-500 focus:outline-none"/>
                <button type="submit" className="w-full py-3 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-500 transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed" disabled={!localStream || !isConnected}>
                    {isConnected ? 'Join Room' : 'Connecting...'}
                </button>
            </form>
         </div>
    </div>
);

const Room: React.FC<{
    roomCode: string;
    participants: Participant[];
    handleLeaveRoom: () => void;
    localStream: MediaStream | null;
    user: User;
    isMuted: boolean;
    remoteStreams: Record<string, MediaStream>;
}> = ({ roomCode, participants, handleLeaveRoom, localStream, user, isMuted, remoteStreams }) => (
    <div className="h-full w-full flex flex-col animate-fade-in">
        <div className="mb-4 flex flex-col sm:flex-row justify-between items-center gap-2">
            <div>
                <h2 className="text-xl md:text-2xl font-bold text-white">Room Code: <span className="text-blue-400 font-mono select-all">{roomCode}</span></h2>
                <p className="text-gray-400">{participants.length} participant(s) in the room.</p>
            </div>
            <button onClick={handleLeaveRoom} className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-500 transition-colors self-start sm:self-center">
                Leave Room
            </button>
        </div>
        <div className="flex-grow grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-min overflow-y-auto p-1">
            {localStream && <Video stream={localStream} name={`${user.name} (You)`} isMuted={isMuted} />}
            {Object.entries(remoteStreams).map(([socketId, stream]) => {
                const participant = participants.find(p => p.id === socketId);
                return <Video key={socketId} stream={stream} name={participant?.name ?? 'Guest'} isMuted={false} />;
            })}
        </div>
    </div>
);


const GroupDiscussionPage: React.FC<{ user: User }> = ({ user }) => {
    const [pageState, setPageState] = useState<'lobby' | 'in-room'>('lobby');
    const [roomCode, setRoomCode] = useState('');
    const [joinRoomCode, setJoinRoomCode] = useState('');
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    const socketRef = useRef<any>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const peerConnectionsRef = useRef<Record<string, RTCPeerConnection>>({});
    
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
    const [isMuted, setIsMuted] = useState(true);

    const cleanupConnections = useCallback(() => {
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
        }
        setLocalStream(null);
        Object.values(peerConnectionsRef.current).forEach(pc => pc.close());
        peerConnectionsRef.current = {};
        setRemoteStreams({});
    }, []);

    const handleLeaveRoom = useCallback(() => {
        socketRef.current?.emit('leave-gd-room');
        cleanupConnections();
        setPageState('lobby');
        setRoomCode('');
        setJoinRoomCode('');
        setParticipants([]);
        setError(null);
    }, [cleanupConnections]);

    const setupPeerConnection = useCallback((peerSocketId: string, initiator: boolean, stream: MediaStream) => {
        if (peerConnectionsRef.current[peerSocketId] || !socketRef.current) return null;

        const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
        peerConnectionsRef.current[peerSocketId] = pc;

        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socketRef.current?.emit('webrtc-signal', { to: peerSocketId, signal: { type: 'candidate', candidate: event.candidate } });
            }
        };

        pc.ontrack = (event) => {
            setRemoteStreams(prev => ({ ...prev, [peerSocketId]: event.streams[0] }));
        };
        
        if (initiator) {
            pc.createOffer()
                .then(offer => pc.setLocalDescription(offer))
                .then(() => {
                    if (pc.localDescription) {
                        socketRef.current?.emit('webrtc-signal', { to: peerSocketId, signal: { type: 'offer', sdp: pc.localDescription } });
                    }
                }).catch(e => console.error("Create offer error", e));
        }
        return pc;
    }, []);

    useEffect(() => {
        socketRef.current = io('https://googleauth-bu6c.onrender.com', { transports: ['websocket'] });

        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .then(stream => {
                localStreamRef.current = stream;
                setLocalStream(stream);
            })
            .catch(err => {
                console.error("Error accessing media devices.", err);
                setError("Camera/mic access denied. Please enable permissions and refresh.");
            });
        
        const socket = socketRef.current;

        socket.on('connect', () => setIsConnected(true));
        socket.on('disconnect', () => setIsConnected(false));
        
        socket.on('gd-room-created', (newRoomCode: string) => {
            setRoomCode(newRoomCode);
            setPageState('in-room');
            setParticipants([{ id: socket.id, name: user.name }]);
        });

        socket.on('joined-gd-room', (data: { roomCode: string; participants: Participant[] }) => {
            const stream = localStreamRef.current;
            if (!stream) return;
            setRoomCode(data.roomCode);
            setPageState('in-room');
            setParticipants([...data.participants, {id: socket.id, name: user.name}]);
            data.participants.forEach(p => setupPeerConnection(p.id, true, stream));
        });

        socket.on('user-joining-gd', (data: { newParticipant: Participant }) => {
             const stream = localStreamRef.current;
             if (!stream) return;
             setParticipants(prev => [...prev, data.newParticipant]);
             setupPeerConnection(data.newParticipant.id, false, stream);
        });
        
        socket.on('webrtc-signal', async (data: { from: string; signal: any }) => {
            const stream = localStreamRef.current;
            if (!stream) return;

            let pc = peerConnectionsRef.current[data.from];
            if (!pc) {
                pc = setupPeerConnection(data.from, false, stream);
            }
            if (!pc) return;

            if (data.signal.type === 'offer') {
                await pc.setRemoteDescription(new RTCSessionDescription(data.signal.sdp));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                socket.emit('webrtc-signal', { to: data.from, signal: { type: 'answer', sdp: pc.localDescription } });
            } else if (data.signal.type === 'answer') {
                await pc.setRemoteDescription(new RTCSessionDescription(data.signal.sdp));
            } else if (data.signal.type === 'candidate') {
                try { await pc.addIceCandidate(new RTCIceCandidate(data.signal.candidate)); } catch (e) { console.error('Error adding ICE candidate', e); }
            }
        });
        
        socket.on('user-left-gd', (data: { socketId: string }) => {
            if (peerConnectionsRef.current[data.socketId]) {
                peerConnectionsRef.current[data.socketId].close();
                delete peerConnectionsRef.current[data.socketId];
            }
            setParticipants(prev => prev.filter(p => p.id !== data.socketId));
            setRemoteStreams(prev => {
                const newStreams = { ...prev };
                delete newStreams[data.socketId];
                return newStreams;
            });
        });
        
        socket.on('connect_error', () => setError("Failed to connect to the server. Please try again later."));
        socket.on('error', (errorMessage: string) => setError(errorMessage));

        return () => {
            cleanupConnections();
            socket.disconnect();
        };
    }, [user.name, setupPeerConnection, cleanupConnections]);

    const handleCreateRoom = useCallback(() => {
        if (!localStream) { setError("Camera/mic access is required."); return; }
        socketRef.current?.emit('create-gd-room', { userName: user.name });
    }, [user.name, localStream]);

    const handleJoinRoom = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        if (!localStream) { setError("Camera/mic access is required."); return; }
        if (joinRoomCode.trim()) {
            socketRef.current?.emit('join-gd-room', { roomCode: joinRoomCode.trim(), userName: user.name });
        }
    }, [user.name, localStream, joinRoomCode]);
    
    return (
        <div className="h-full flex flex-col bg-gray-900/50 rounded-lg p-4 md:p-6">
             <div className="mb-4">
                <h1 className="text-2xl md:text-3xl font-bold text-white">Group Discussion</h1>
                <p className="mt-1 text-gray-400 text-sm md:text-base">Practice group discussions with others in a real-time video room.</p>
             </div>
             {error && <p className="mb-4 text-center text-red-400 bg-red-900/50 p-3 rounded-lg animate-fade-in">{error}</p>}
             <div className="flex-grow flex items-center justify-center">
                {pageState === 'in-room' ? (
                    <Room 
                        roomCode={roomCode}
                        participants={participants}
                        handleLeaveRoom={handleLeaveRoom}
                        localStream={localStream}
                        user={user}
                        isMuted={isMuted}
                        remoteStreams={remoteStreams}
                    />
                ) : (
                    <Lobby 
                        handleCreateRoom={handleCreateRoom}
                        handleJoinRoom={handleJoinRoom}
                        joinRoomCode={joinRoomCode}
                        setJoinRoomCode={setJoinRoomCode}
                        localStream={localStream}
                        isConnected={isConnected}
                    />
                )}
             </div>
        </div>
    );
};

export default GroupDiscussionPage;
