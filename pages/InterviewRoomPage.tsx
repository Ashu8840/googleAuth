import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User } from '../types';

declare const io: any;

type Role = 'interviewer' | 'student';
type PageState = 'lobby' | 'waiting' | 'in-room' | 'error';

interface RoomState {
    interviewer: { id: string; name: string };
    student: { id: string; name: string } | null;
    code: string;
}

const VideoDisplay: React.FC<{ stream: MediaStream | null, name: string, role: string, isMuted: boolean }> = ({ stream, name, role, isMuted }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    return (
        <div className="bg-black rounded-lg flex flex-col items-center justify-center relative aspect-video w-full overflow-hidden shadow-lg">
            {stream ? (
                 <video ref={videoRef} autoPlay playsInline muted={isMuted} className="w-full h-full object-cover"></video>
            ) : (
                <div className="flex flex-col items-center text-gray-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span className="font-semibold">{name}</span>
                </div>
            )}
             <div className="absolute top-2 left-2 bg-black/60 text-white px-2 py-1 text-xs rounded font-semibold">{role}</div>
        </div>
    );
};


const InterviewRoomPage: React.FC<{ user: User }> = ({ user }) => {
    const [pageState, setPageState] = useState<PageState>('lobby');
    const [error, setError] = useState<string | null>(null);
    const [role, setRole] = useState<Role | null>(null);
    const [roomCode, setRoomCode] = useState('');
    const [inputRoomCode, setInputRoomCode] = useState('');
    
    const [roomState, setRoomState] = useState<RoomState | null>(null);
    const [editorCode, setEditorCode] = useState('');
    const [output, setOutput] = useState('// Code output will appear here');

    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    
    const socketRef = useRef<any>(null);
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const codeChangeTimeoutRef = useRef<number | null>(null);

    const cleanup = () => {
        localStream?.getTracks().forEach(track => track.stop());
        peerConnectionRef.current?.close();
        peerConnectionRef.current = null;
        setLocalStream(null);
        setRemoteStream(null);
    };

    const handleLeaveRoom = () => {
        socketRef.current?.emit('leave-interview-room');
        cleanup();
        setPageState('lobby');
        setRole(null);
        setRoomCode('');
        setInputRoomCode('');
        setError(null);
        setRoomState(null);
    };
    
    const getMedia = useCallback(async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setLocalStream(mediaStream);
            return mediaStream;
        } catch (err) {
            console.error("Error accessing media devices.", err);
            setError("Camera/mic access denied. Please enable permissions and refresh.");
            setPageState('error');
            return null;
        }
    }, []);

    const createPeerConnection = useCallback((peerId: string, isInitiator: boolean, currentStream: MediaStream) => {
        if (peerConnectionRef.current) peerConnectionRef.current.close();
        
        const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
        peerConnectionRef.current = pc;

        currentStream.getTracks().forEach(track => pc.addTrack(track, currentStream));

        pc.onicecandidate = event => {
            if (event.candidate && socketRef.current) {
                socketRef.current.emit('webrtc-signal', { to: peerId, signal: { type: 'candidate', candidate: event.candidate } });
            }
        };

        pc.ontrack = event => setRemoteStream(event.streams[0]);

        if (isInitiator && socketRef.current) {
            pc.createOffer()
                .then(offer => pc.setLocalDescription(offer))
                .then(() => {
                    if (pc.localDescription) {
                        socketRef.current.emit('webrtc-signal', { to: peerId, signal: { type: 'offer', sdp: pc.localDescription } });
                    }
                });
        }
    }, []);

    useEffect(() => {
        const socket = io('https://googleauth-bu6c.onrender.com', { transports: ['websocket'] });
        socketRef.current = socket;
        getMedia();

        const handleConnectError = () => { setError("Failed to connect to server."); setPageState('error'); };
        const handleError = (errorMessage: string) => { setError(errorMessage); setPageState('lobby'); setRoomCode(''); };
        const handleInterviewRoomCreated = (newRoomCode: string) => { setRoomCode(newRoomCode); setPageState('waiting'); };
        
        const handleInterviewRoomReady = (data: { roomData: RoomState, roomCode: string }) => {
            if (!data || !data.roomData) {
                setError("Received invalid room data from server.");
                setPageState('error');
                return;
            }
            setRoomCode(data.roomCode);
            setRoomState(data.roomData);
            setEditorCode(data.roomData.code);
            setPageState('in-room');
            setError(null);

            const selfId = socket.id;
            const partner = role === 'interviewer' ? data.roomData.student : data.roomData.interviewer;
            if(localStream && partner && partner.id !== selfId){
                const isInitiator = role === 'interviewer';
                createPeerConnection(partner.id, isInitiator, localStream);
            }
        };

        const handleWebrtcSignal = async (data: { from: string; signal: any }) => {
            if(!localStream) return;
            if (!peerConnectionRef.current) createPeerConnection(data.from, false, localStream);
            const pc = peerConnectionRef.current;
            if (!pc) return;

            if (data.signal.type === 'offer') {
                await pc.setRemoteDescription(new RTCSessionDescription(data.signal.sdp));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                socketRef.current.emit('webrtc-signal', { to: data.from, signal: { type: 'answer', sdp: pc.localDescription } });
            } else if (data.signal.type === 'answer') {
                await pc.setRemoteDescription(new RTCSessionDescription(data.signal.sdp));
            } else if (data.signal.type === 'candidate') {
                 try { await pc.addIceCandidate(new RTCIceCandidate(data.signal.candidate)); } catch (e) { console.error('Error adding ICE candidate', e); }
            }
        };
        const handleCodeUpdated = (newCode: string) => setEditorCode(newCode);
        const handleOutputUpdated = (newOutput: string) => setOutput(newOutput);
        const handlePartnerDisconnected = () => {
             setError('The other participant has disconnected. Returning to lobby.');
             handleLeaveRoom();
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
            cleanup();
            socket.disconnect();
        };
    }, [getMedia, createPeerConnection, role, localStream]);

    const handleCreateRoom = () => { setRole('interviewer'); socketRef.current.emit('create-interview-room', { userName: user.name }); };
    const handleJoinRoom = (e: React.FormEvent) => { e.preventDefault(); if (inputRoomCode.trim()) { setRole('student'); socketRef.current.emit('join-interview-room', { roomCode: inputRoomCode.trim().toUpperCase(), userName: user.name }); }};

    const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newCode = e.target.value;
        setEditorCode(newCode); // Update local state immediately for responsiveness
        if (codeChangeTimeoutRef.current) clearTimeout(codeChangeTimeoutRef.current);
        codeChangeTimeoutRef.current = window.setTimeout(() => {
            socketRef.current.emit('code-change', { roomCode, newCode });
        }, 250);
    };

    const runCode = (codeToRun: string) => {
        let logs: string[] = [];
        const oldLog = console.log;
        console.log = (...args) => logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' '));
        try {
            new Function(codeToRun)();
            return logs.length > 0 ? logs.join('\n') : '// Code ran successfully with no output.';
        } catch (e: any) { return `Error: ${e.message}`; }
        finally { console.log = oldLog; }
    };

    const handleRunCode = () => {
        const result = runCode(editorCode);
        setOutput(result);
        socketRef.current.emit('code-run', { roomCode, output: result });
    };

    const renderContent = () => {
        switch (pageState) {
            case 'in-room':
                return (
                    <div className="h-full flex flex-col md:flex-row gap-4 animate-fade-in">
                        {/* Left side: Code and Output */}
                        <div className="w-full md:w-1/2 lg:w-3/5 flex flex-col gap-4 min-h-0">
                             <div className="bg-gray-900 rounded-lg flex flex-col flex-1 min-h-0">
                                <div className="p-3 border-b border-gray-700 flex justify-between items-center flex-shrink-0">
                                    <h3 className="font-bold text-white">JavaScript Canvas</h3>
                                    {role === 'student' && <button onClick={handleRunCode} className="px-4 py-1 bg-green-600 text-white text-sm font-semibold rounded hover:bg-green-500">Run Code</button>}
                                </div>
                                <textarea value={editorCode} onChange={handleCodeChange} readOnly={role !== 'student'}
                                    className="w-full h-full flex-grow bg-[#1e1e1e] text-white font-mono p-4 text-sm resize-none focus:outline-none"
                                    placeholder="Write your JavaScript code here..."/>
                            </div>
                            <div className="bg-gray-900 rounded-lg flex flex-col h-1/3 min-h-[150px] flex-shrink-0">
                                <div className="p-3 border-b border-gray-700"><h3 className="font-bold text-white">Output</h3></div>
                                <pre className="w-full h-full flex-grow bg-[#1e1e1e] text-gray-300 font-mono p-4 text-xs whitespace-pre-wrap overflow-auto">{output}</pre>
                            </div>
                        </div>
                        {/* Right side: Video Feeds and Controls */}
                        <div className="w-full md:w-1/2 lg:w-2/5 flex flex-col justify-center items-center gap-4">
                            <VideoDisplay stream={role === 'interviewer' ? localStream : remoteStream} name={roomState?.interviewer?.name ?? 'Interviewer'} role="Interviewer" isMuted={role === 'interviewer'} />
                            <VideoDisplay stream={role === 'student' ? localStream : remoteStream} name={roomState?.student?.name ?? 'Waiting for student...'} role="Student" isMuted={role === 'student'} />
                             <button onClick={handleLeaveRoom} className="w-full mt-2 px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-500 transition-colors">End Interview</button>
                        </div>
                    </div>
                );
            case 'waiting':
                return (
                    <div className="text-center">
                        <h2 className="text-2xl font-bold">Room Code: <span className="text-blue-400 font-mono tracking-widest">{roomCode}</span></h2>
                        <p className="mt-4 text-gray-400">Share this code with the student to have them join.</p>
                        <div className="mt-8 flex justify-center items-center gap-3">
                            <svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            Waiting for student to join...
                        </div>
                        <button onClick={handleLeaveRoom} className="mt-8 px-6 py-2 bg-gray-600 rounded-lg hover:bg-gray-500">Cancel</button>
                    </div>
                );
            case 'error':
            case 'lobby':
            default:
                return (
                    <div className="w-full max-w-lg mx-auto animate-fade-in-up">
                         <div className="bg-gray-800 p-8 rounded-lg shadow-xl mb-6">
                             <h2 className="text-2xl font-bold text-white text-center">Interviewer</h2>
                             <p className="text-gray-400 text-center mt-2">Create a private room to conduct a 1-on-1 interview.</p>
                             <button onClick={handleCreateRoom} className="w-full mt-4 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-500 transition-colors" disabled={!localStream}>Create Interview Room</button>
                         </div>
                         <div className="bg-gray-800 p-8 rounded-lg shadow-xl">
                            <h2 className="text-2xl font-bold text-white text-center">Student</h2>
                             <p className="text-gray-400 text-center mt-2">Join an interview room with a code from an interviewer.</p>
                            <form onSubmit={handleJoinRoom} className="mt-4 space-y-4">
                                <input type="text" placeholder="ENTER ROOM CODE" value={inputRoomCode} onChange={e => setInputRoomCode(e.target.value)}
                                    className="w-full text-center tracking-widest font-mono bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:ring-2 focus:ring-blue-500 focus:outline-none"/>
                                <button type="submit" className="w-full py-3 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-500 transition-colors" disabled={!localStream}>Join as Student</button>
                            </form>
                         </div>
                    </div>
                );
        }
    }

    return (
        <div className="h-full flex flex-col bg-gray-900/50 rounded-lg p-2 md:p-6">
             <div className="mb-4 flex-shrink-0">
                <h1 className="text-2xl md:text-3xl font-bold text-white">1-on-1 Interview Room</h1>
                <p className="mt-1 text-gray-400 text-sm md:text-base">A real-time, collaborative environment for technical interviews.</p>
             </div>
             {error && <p className="mb-4 text-center text-red-400 bg-red-900/50 p-3 rounded-lg animate-fade-in">{error}</p>}
             <div className="flex-grow flex items-center justify-center min-h-0">
                {renderContent()}
             </div>
        </div>
    );
};

export default InterviewRoomPage;