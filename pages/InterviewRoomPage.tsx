import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User } from '../types';

declare const io: any;

type Role = 'interviewer' | 'student';

interface RoomState {
    interviewer: { id: string; name: string } | null;
    student: { id: string; name: string } | null;
    code: string;
}

const VideoDisplay: React.FC<{ stream: MediaStream | null, name: string, isMuted: boolean }> = ({ stream, name, isMuted }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);
    return (
        <div className="bg-black rounded-lg flex items-center justify-center relative aspect-video w-full overflow-hidden">
            {stream ? (
                 <video ref={videoRef} autoPlay playsInline muted={isMuted} className="w-full h-full object-cover"></video>
            ) : (
                 <span className="font-semibold text-gray-400">{name}</span>
            )}
        </div>
    );
};


const InterviewRoomPage: React.FC<{ user: User }> = ({ user }) => {
    const [socket, setSocket] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    const [role, setRole] = useState<Role | null>(null);
    const [roomCode, setRoomCode] = useState('');
    const [joinRoomCode, setJoinRoomCode] = useState('');
    
    const [inRoom, setInRoom] = useState(false);
    const [roomState, setRoomState] = useState<RoomState | null>(null);
    const [editorCode, setEditorCode] = useState('');
    const [output, setOutput] = useState('// Code output will appear here');

    const peerConnection = useRef<RTCPeerConnection | null>(null);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    
    const stopTracks = (stream: MediaStream | null) => {
        stream?.getTracks().forEach(track => track.stop());
    };

    const getMedia = useCallback(async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setLocalStream(mediaStream);
        } catch (err) {
            console.error("Error accessing media devices.", err);
            setError("Camera/mic access denied. Please enable permissions.");
        }
    }, []);

    const handleCreatePeerConnection = useCallback((peerId: string, isInitiator: boolean) => {
        if (peerConnection.current) peerConnection.current.close();
        
        peerConnection.current = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });

        localStream?.getTracks().forEach(track => peerConnection.current?.addTrack(track, localStream));

        peerConnection.current.onicecandidate = event => {
            if (event.candidate && socket) {
                socket.emit('webrtc-signal', { to: peerId, signal: { type: 'candidate', candidate: event.candidate } });
            }
        };

        peerConnection.current.ontrack = event => setRemoteStream(event.streams[0]);

        if (isInitiator && socket) {
            peerConnection.current.createOffer()
                .then(offer => peerConnection.current?.setLocalDescription(offer))
                .then(() => {
                    socket.emit('webrtc-signal', { to: peerId, signal: { type: 'offer', sdp: peerConnection.current?.localDescription } });
                });
        }
    }, [localStream, socket]);
    
    useEffect(() => {
        const newSocket = io('https://googleauth-bu6c.onrender.com', { transports: ['websocket'] });
        setSocket(newSocket);
        getMedia();
        return () => {
            stopTracks(localStream);
            peerConnection.current?.close();
            newSocket.disconnect();
        };
    }, [getMedia, localStream]);

    useEffect(() => {
        if (!socket) return;
        
        const handleConnectError = () => { setError("Failed to connect to server."); setInRoom(false); setRole(null); };
        const handleError = (errorMessage: string) => setError(errorMessage);
        const handleInterviewRoomCreated = (newRoomCode: string) => setRoomCode(newRoomCode);
        const handleInterviewRoomReady = (initialRoomState: RoomState) => {
            setRoomState(initialRoomState);
            setEditorCode(initialRoomState.code);
            setInRoom(true);
            setError(null);
            if (role === 'interviewer' && initialRoomState.student) {
                handleCreatePeerConnection(initialRoomState.student.id, true);
            }
        };
        const handleWebrtcSignal = async (data: { from: string; signal: any }) => {
            if (!peerConnection.current) handleCreatePeerConnection(data.from, false);
            const pc = peerConnection.current;
            if (data.signal.type === 'offer') {
                await pc?.setRemoteDescription(new RTCSessionDescription(data.signal.sdp));
                const answer = await pc?.createAnswer();
                await pc?.setLocalDescription(answer);
                socket.emit('webrtc-signal', { to: data.from, signal: { type: 'answer', sdp: pc?.localDescription } });
            } else if (data.signal.type === 'answer') {
                await pc?.setRemoteDescription(new RTCSessionDescription(data.signal.sdp));
            } else if (data.signal.type === 'candidate') {
                 try {
                    await pc?.addIceCandidate(new RTCIceCandidate(data.signal.candidate));
                } catch (e) {
                    console.error('Error adding received ice candidate', e);
                }
            }
        };
        const handleCodeUpdated = (newCode: string) => setEditorCode(newCode);
        const handleOutputUpdated = (newOutput: string) => setOutput(newOutput);
        const handlePartnerDisconnected = () => {
             setError('The other participant has disconnected.');
             setInRoom(false);
             setRemoteStream(null);
             peerConnection.current?.close();
             peerConnection.current = null;
        };

        socket.on('connect_error', handleConnectError);
        socket.on('error', handleError);
        socket.on('interview-room-created', handleInterviewRoomCreated);
        socket.on('interview-room-ready', handleInterviewRoomReady);
        socket.on('webrtc-signal', handleWebrtcSignal);
        socket.on('code-updated', handleCodeUpdated);
        socket.on('output-updated', handleOutputUpdated);
        socket.on('partner-disconnected', handlePartnerDisconnected);

        return () => {
            socket.off('connect_error', handleConnectError);
            socket.off('error', handleError);
            socket.off('interview-room-created', handleInterviewRoomCreated);
            socket.off('interview-room-ready', handleInterviewRoomReady);
            socket.off('webrtc-signal', handleWebrtcSignal);
            socket.off('code-updated', handleCodeUpdated);
            socket.off('output-updated', handleOutputUpdated);
            socket.off('partner-disconnected', handlePartnerDisconnected);
        }

    }, [socket, role, handleCreatePeerConnection]);

    const handleCreateRoom = () => { setRole('interviewer'); socket.emit('create-interview-room', { userName: user.name }); };
    const handleJoinRoom = (e: React.FormEvent) => { e.preventDefault(); if (joinRoomCode.trim()) { setRole('student'); socket.emit('join-interview-room', { roomCode: joinRoomCode, userName: user.name }); }};

    const codeChangeTimeout = useRef<number | null>(null);
    const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newCode = e.target.value;
        setEditorCode(newCode); // Update local state immediately for responsiveness
        if (codeChangeTimeout.current) clearTimeout(codeChangeTimeout.current);
        codeChangeTimeout.current = window.setTimeout(() => {
            socket.emit('code-change', { roomCode: joinRoomCode || roomCode, newCode });
        }, 300);
    };

    const runCode = (codeToRun: string) => {
        let logs: string[] = [];
        const oldLog = console.log;
        console.log = (...args) => logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : a.toString()).join(' '));
        try {
            new Function(codeToRun)();
            return logs.length > 0 ? logs.join('\n') : 'Code ran with no output.';
        } catch (e: any) { return e.toString(); }
        finally { console.log = oldLog; }
    };

    const handleRunCode = () => {
        const result = runCode(editorCode);
        setOutput(result);
        socket.emit('code-run', { roomCode: joinRoomCode || roomCode, output: result });
    };

    const Lobby = () => (
         <div className="w-full max-w-lg mx-auto animate-fade-in-up">
             <div className="bg-gray-800 p-8 rounded-lg shadow-xl mb-6">
                 <h2 className="text-2xl font-bold text-white text-center">Interviewer</h2>
                 <p className="text-gray-400 text-center mt-2">Create a private room to conduct a 1-on-1 interview.</p>
                 <button onClick={handleCreateRoom} className="w-full mt-4 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-500 transition-colors">Create Interview Room</button>
                 {roomCode && (
                    <div className="mt-4 text-center bg-gray-900 p-3 rounded-md">
                        <p className="text-gray-300">Share this code with the student:</p>
                        <p className="text-2xl text-blue-400 font-mono tracking-widest my-2">{roomCode}</p>
                    </div>
                 )}
             </div>
             <div className="bg-gray-800 p-8 rounded-lg shadow-xl">
                <h2 className="text-2xl font-bold text-white text-center">Student</h2>
                 <p className="text-gray-400 text-center mt-2">Join an interview room with a code from an interviewer.</p>
                <form onSubmit={handleJoinRoom} className="mt-4 space-y-4">
                    <input type="text" placeholder="Enter Room Code" value={joinRoomCode} onChange={e => setJoinRoomCode(e.target.value.toUpperCase())}
                        className="w-full bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:ring-2 focus:ring-blue-500 focus:outline-none"/>
                    <button type="submit" className="w-full py-3 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-500 transition-colors">Join as Student</button>
                </form>
             </div>
        </div>
    );

    const Room = () => (
        <div className="h-full flex flex-col md:flex-row gap-4 animate-fade-in">
            {/* Left side: Code and Output */}
            <div className="w-full md:w-1/2 lg:w-3/5 flex flex-col gap-4">
                 <div className="bg-gray-900 rounded-lg flex flex-col flex-1 min-h-0 h-2/3">
                    <div className="p-3 border-b border-gray-700 flex justify-between items-center">
                        <h3 className="font-bold text-white">JavaScript Canvas</h3>
                        {role === 'student' && <button onClick={handleRunCode} className="px-4 py-1 bg-green-600 text-white text-sm font-semibold rounded hover:bg-green-500">Run Code</button>}
                    </div>
                    <textarea value={editorCode} onChange={handleCodeChange} readOnly={role !== 'student'}
                        className="w-full h-full flex-grow bg-[#1e1e1e] text-white font-mono p-4 text-sm resize-none focus:outline-none"
                        placeholder="Write your JavaScript code here..."/>
                </div>
                <div className="bg-gray-900 rounded-lg flex flex-col h-1/3">
                    <div className="p-3 border-b border-gray-700"><h3 className="font-bold text-white">Output</h3></div>
                    <pre className="w-full h-full flex-grow bg-[#1e1e1e] text-gray-300 font-mono p-4 text-xs whitespace-pre-wrap overflow-auto">{output}</pre>
                </div>
            </div>
            {/* Right side: Video Feeds */}
            <div className="w-full md:w-1/2 lg:w-2/5 flex flex-col justify-center items-center gap-4">
                <VideoDisplay stream={role === 'interviewer' ? localStream : remoteStream} name={roomState?.interviewer?.name ?? 'Interviewer'} isMuted={role === 'interviewer'} />
                <VideoDisplay stream={role === 'student' ? localStream : remoteStream} name={roomState?.student?.name ?? 'Waiting for student...'} isMuted={role === 'student'} />
            </div>
        </div>
    );

    return (
        <div className="h-full flex flex-col bg-gray-800/50 rounded-lg p-2 md:p-6">
             <div className="mb-4">
                <h1 className="text-2xl md:text-3xl font-bold text-white">1-on-1 Interview Room</h1>
                <p className="mt-1 text-gray-400 text-sm md:text-base">A real-time, collaborative environment for technical interviews.</p>
             </div>
             {error && <p className="mb-4 text-center text-red-400 bg-red-900/50 p-3 rounded-lg animate-fade-in">{error}</p>}
             <div className="flex-grow flex items-center justify-center min-h-0">
                {inRoom ? <Room /> : <Lobby />}
             </div>
        </div>
    );
};

export default InterviewRoomPage;