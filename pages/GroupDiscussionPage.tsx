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
        <div className="bg-black rounded-lg overflow-hidden relative aspect-video w-full h-full">
            <video ref={ref} autoPlay playsInline muted={isMuted} className="h-full w-full object-cover" />
            <div className="absolute bottom-2 left-2 bg-black/50 text-white px-2 py-1 text-sm rounded">{name}</div>
        </div>
    );
};


const GroupDiscussionPage: React.FC<{user: User}> = ({ user }) => {
    const [socket, setSocket] = useState<any>(null);
    const [inRoom, setInRoom] = useState(false);
    const [roomCode, setRoomCode] = useState('');
    const [joinRoomCode, setJoinRoomCode] = useState('');
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [error, setError] = useState<string | null>(null);

    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
    const peerConnections = useRef<Record<string, RTCPeerConnection>>({});
    
    const stopTracks = (stream: MediaStream | null) => {
        stream?.getTracks().forEach(track => track.stop());
    };

    const getMedia = useCallback(async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setLocalStream(mediaStream);
        } catch (err) {
            console.error("Error accessing media devices.", err);
            setError("Camera and microphone access denied. Please enable permissions in your browser settings.");
        }
    }, []);

    useEffect(() => {
        const newSocket = io('https://googleauth-bu6c.onrender.com', { transports: ['websocket'] });
        setSocket(newSocket);
        getMedia();

        return () => {
            stopTracks(localStream);
            newSocket.disconnect();
            Object.values(peerConnections.current).forEach(pc => pc.close());
        };
    }, [getMedia, localStream]);

    const createPeerConnection = useCallback((peerSocketId: string, isInitiator: boolean) => {
        if (peerConnections.current[peerSocketId]) {
            return peerConnections.current[peerSocketId];
        }

        const pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });
        
        peerConnections.current[peerSocketId] = pc;

        pc.onicecandidate = (event) => {
            if (event.candidate && socket) {
                socket.emit('webrtc-signal', { to: peerSocketId, signal: { type: 'candidate', candidate: event.candidate } });
            }
        };

        pc.ontrack = (event) => {
            setRemoteStreams(prev => ({ ...prev, [peerSocketId]: event.streams[0] }));
        };
        
        localStream?.getTracks().forEach(track => {
            pc.addTrack(track, localStream);
        });

        if (isInitiator && socket) {
             pc.createOffer()
                .then(offer => pc.setLocalDescription(offer))
                .then(() => {
                    socket.emit('webrtc-signal', { to: peerSocketId, signal: { type: 'offer', sdp: pc.localDescription } });
                });
        }
        
        return pc;
    }, [localStream, socket]);


    useEffect(() => {
        if (!socket) return;

        const handleConnectError = () => setError("Failed to connect to server. Please ensure the server is running and try again.");
        const handleError = (errorMessage: string) => setError(errorMessage);
        const handleGdRoomCreated = (newRoomCode: string) => {
            setRoomCode(newRoomCode);
            setInRoom(true);
            setParticipants([{ id: socket.id, name: user.name }]);
        };
        const handleJoinedGdRoom = (data: { roomCode: string; participants: Participant[] }) => {
            setRoomCode(data.roomCode);
            setInRoom(true);
            setError(null);
            setParticipants([...data.participants, { id: socket.id, name: user.name }]);
            data.participants.forEach(p => createPeerConnection(p.id, true));
        };
        const handleUserJoiningGd = (data: { newParticipant: Participant }) => {
            setParticipants(prev => [...prev, data.newParticipant]);
            createPeerConnection(data.newParticipant.id, false);
        };
        const handleWebrtcSignal = async (data: { from: string; signal: any }) => {
            const pc = peerConnections.current[data.from] || createPeerConnection(data.from, false);
            if (data.signal.type === 'offer') {
                await pc.setRemoteDescription(new RTCSessionDescription(data.signal.sdp));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                socket.emit('webrtc-signal', { to: data.from, signal: { type: 'answer', sdp: pc.localDescription } });
            } else if (data.signal.type === 'answer') {
                await pc.setRemoteDescription(new RTCSessionDescription(data.signal.sdp));
            } else if (data.signal.type === 'candidate') {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(data.signal.candidate));
                } catch (e) {
                    console.error('Error adding received ice candidate', e);
                }
            }
        };
        const handleUserLeftGd = (data: { socketId: string }) => {
            peerConnections.current[data.socketId]?.close();
            delete peerConnections.current[data.socketId];
            setParticipants(prev => prev.filter(p => p.id !== data.socketId));
            setRemoteStreams(prev => {
                const newStreams = { ...prev };
                delete newStreams[data.socketId];
                return newStreams;
            });
        };

        socket.on('connect_error', handleConnectError);
        socket.on('error', handleError);
        socket.on('gd-room-created', handleGdRoomCreated);
        socket.on('joined-gd-room', handleJoinedGdRoom);
        socket.on('user-joining-gd', handleUserJoiningGd);
        socket.on('webrtc-signal', handleWebrtcSignal);
        socket.on('user-left-gd', handleUserLeftGd);

        return () => {
            socket.off('connect_error', handleConnectError);
            socket.off('error', handleError);
            socket.off('gd-room-created', handleGdRoomCreated);
            socket.off('joined-gd-room', handleJoinedGdRoom);
            socket.off('user-joining-gd', handleUserJoiningGd);
            socket.off('webrtc-signal', handleWebrtcSignal);
            socket.off('user-left-gd', handleUserLeftGd);
        };

    }, [socket, user.name, createPeerConnection]);


    const handleCreateRoom = () => socket?.emit('create-gd-room', { userName: user.name });

    const handleJoinRoom = (e: React.FormEvent) => {
        e.preventDefault();
        if(joinRoomCode.trim()) {
            socket?.emit('join-gd-room', { roomCode: joinRoomCode, userName: user.name });
        }
    };

    const handleLeaveRoom = () => {
        socket?.emit('leave-gd-room', roomCode);
        setInRoom(false);
        setRoomCode('');
        setParticipants([]);
        setRemoteStreams({});
        Object.values(peerConnections.current).forEach(pc => pc.close());
        peerConnections.current = {};
    }

    const Lobby = () => (
        <div className="w-full max-w-md mx-auto animate-fade-in-up">
             <div className="bg-gray-800 p-6 md:p-8 rounded-lg shadow-xl mb-6">
                 <h2 className="text-xl md:text-2xl font-bold text-white text-center">Create Discussion Room</h2>
                 <p className="text-gray-400 text-center mt-2 text-sm md:text-base">Start a new GD room and invite others with a code.</p>
                 <button onClick={handleCreateRoom} className="w-full mt-4 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-500 transition-colors">
                     Create Room
                 </button>
             </div>
             <div className="bg-gray-800 p-6 md:p-8 rounded-lg shadow-xl">
                <h2 className="text-xl md:text-2xl font-bold text-white text-center">Join Discussion Room</h2>
                <form onSubmit={handleJoinRoom} className="mt-4 space-y-4">
                    <input type="text" placeholder="Enter Room Code" value={joinRoomCode} onChange={e => setJoinRoomCode(e.target.value.toUpperCase())}
                        className="w-full bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:ring-2 focus:ring-blue-500 focus:outline-none"/>
                    <button type="submit" className="w-full py-3 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-500 transition-colors">
                        Join Room
                    </button>
                </form>
             </div>
        </div>
    );
    
    const Room = () => (
        <div className="h-full w-full flex flex-col animate-fade-in">
            <div className="mb-4 flex flex-col sm:flex-row justify-between items-center gap-2">
                <div>
                    <h2 className="text-xl md:text-2xl font-bold text-white">Room Code: <span className="text-blue-400 font-mono">{roomCode}</span></h2>
                    <p className="text-gray-400">{participants.length} participant(s) in the room.</p>
                </div>
                <button onClick={handleLeaveRoom} className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-500 transition-colors self-start sm:self-center">
                    Leave Room
                </button>
            </div>
            <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-4 auto-rows-min">
                {localStream && (
                     <Video stream={localStream} name={`${user.name} (You)`} isMuted={true} />
                )}
                {Object.entries(remoteStreams).map(([socketId, stream]) => {
                    const participant = participants.find(p => p.id === socketId);
                    return (
                        <Video key={socketId} stream={stream} name={participant?.name ?? 'Guest'} isMuted={false} />
                    );
                })}
            </div>
        </div>
    );

    return (
        <div className="h-full flex flex-col bg-gray-800/50 rounded-lg p-4 md:p-6">
             <div className="mb-4">
                <h1 className="text-2xl md:text-3xl font-bold text-white">Group Discussion</h1>
                <p className="mt-1 text-gray-400 text-sm md:text-base">Join or create a room to practice group discussions with others in real-time.</p>
             </div>
             {error && <p className="mb-4 text-center text-red-400 bg-red-900/50 p-3 rounded-lg animate-fade-in">{error}</p>}
             <div className="flex-grow flex items-center justify-center">
                {inRoom ? <Room /> : <Lobby />}
             </div>
        </div>
    );
};

export default GroupDiscussionPage;