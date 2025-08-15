import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User } from '../types';

interface CallModalProps {
  socket: any;
  callState: { status: 'outgoing' | 'incoming' | 'active' | 'idle', peerEmail?: string, peerInfo?: any };
  setCallState: React.Dispatch<React.SetStateAction<any>>;
  currentUser: User;
}

const CallModal: React.FC<CallModalProps> = ({ socket, callState, setCallState, currentUser }) => {
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

    const cleanup = useCallback(() => {
        localStream?.getTracks().forEach(track => track.stop());
        peerConnectionRef.current?.close();
        peerConnectionRef.current = null;
        setLocalStream(null);
        setRemoteStream(null);
    }, [localStream]);

    const handleEndCall = useCallback(() => {
        socket.emit('end-call', { peerEmail: callState.peerEmail });
        cleanup();
        setCallState({ status: 'idle' });
    }, [socket, callState.peerEmail, cleanup, setCallState]);

    useEffect(() => {
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .then(stream => setLocalStream(stream))
            .catch(console.error);
        
        return () => {
            cleanup();
        };
    }, [cleanup]);

    useEffect(() => {
        if (localStream && localVideoRef.current) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream]);

    useEffect(() => {
        if (remoteStream && remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
        }
    }, [remoteStream]);

    const createPeerConnection = useCallback((peerSocketId: string) => {
        if (!localStream) return null;
        const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
        
        localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

        pc.onicecandidate = event => {
            if (event.candidate) {
                socket.emit('webrtc-signal', { to: peerSocketId, signal: { type: 'candidate', candidate: event.candidate } });
            }
        };

        pc.ontrack = event => setRemoteStream(event.streams[0]);

        peerConnectionRef.current = pc;
        return pc;
    }, [localStream, socket]);

    useEffect(() => {
        if (!socket || !localStream) return;
        
        const handleWebrtcSignal = async (data: { from: string, signal: any }) => {
            let pc = peerConnectionRef.current;
            if(!pc) {
                pc = createPeerConnection(data.from);
            }
            if(!pc) return;

            if (data.signal.sdp) {
                await pc.setRemoteDescription(new RTCSessionDescription(data.signal.sdp));
                if (data.signal.type === 'offer') {
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    socket.emit('webrtc-signal', { to: data.from, signal: { type: 'answer', sdp: pc.localDescription } });
                }
            } else if (data.signal.candidate) {
                await pc.addIceCandidate(new RTCIceCandidate(data.signal.candidate));
            }
        };

        socket.on('webrtc-signal', handleWebrtcSignal);

        return () => {
            socket.off('webrtc-signal', handleWebrtcSignal);
        };
    }, [socket, localStream, createPeerConnection]);

    const handleAcceptCall = async () => {
        setCallState((prev: any) => ({ ...prev, status: 'active' }));
        socket.emit('accept-call', { to: callState.peerEmail });
        // The offer signal comes from the peer, so we don't create an offer here.
        // We wait for the 'webrtc-signal' event with the offer.
    };
    
    const handleDeclineCall = () => {
        socket.emit('decline-call', { to: callState.peerEmail });
        cleanup();
        setCallState({ status: 'idle' });
    };

    if (callState.status === 'idle') return null;

    const peerInfo = callState.peerInfo || {};
    
    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fade-in">
            <div className="bg-gray-900 rounded-lg shadow-xl w-full max-w-4xl p-6 relative flex flex-col gap-4 max-h-[90vh]">
                <h2 className="text-2xl font-bold text-white text-center">Video Call</h2>
                
                {callState.status === 'active' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-grow min-h-0">
                        <div className="bg-black rounded-lg relative">
                            <video ref={remoteVideoRef} autoPlay className="w-full h-full object-cover rounded-lg"></video>
                            <div className="absolute bottom-2 left-2 bg-black/60 text-white px-2 py-1 text-sm rounded">{peerInfo.uniqueName || 'Peer'}</div>
                        </div>
                        <div className="bg-black rounded-lg relative">
                            <video ref={localVideoRef} autoPlay muted className="w-full h-full object-cover rounded-lg"></video>
                             <div className="absolute bottom-2 left-2 bg-black/60 text-white px-2 py-1 text-sm rounded">{currentUser.uniqueName} (You)</div>
                        </div>
                    </div>
                )}

                {(callState.status === 'incoming' || callState.status === 'outgoing') && (
                     <div className="flex flex-col items-center justify-center p-8 text-center bg-gray-800 rounded-lg">
                        <img src={peerInfo.picture} alt={peerInfo.name} className="w-32 h-32 rounded-full border-4 border-gray-600 mb-4" />
                        <p className="text-xl text-gray-300">
                           {callState.status === 'incoming' ? `Incoming call from...` : `Calling...`}
                        </p>
                        <h3 className="text-3xl font-bold text-white mt-1">{peerInfo.uniqueName}</h3>
                    </div>
                )}
                
                <div className="flex justify-center items-center gap-4 mt-4">
                    {callState.status === 'incoming' && (
                        <>
                            <button onClick={handleAcceptCall} className="px-8 py-3 bg-green-600 rounded-full text-white font-semibold hover:bg-green-500">Accept</button>
                            <button onClick={handleDeclineCall} className="px-8 py-3 bg-red-600 rounded-full text-white font-semibold hover:bg-red-500">Decline</button>
                        </>
                    )}
                     {callState.status === 'outgoing' && (
                        <button onClick={handleEndCall} className="px-8 py-3 bg-red-600 rounded-full text-white font-semibold hover:bg-red-500">Cancel</button>
                     )}
                     {callState.status === 'active' && (
                        <button onClick={handleEndCall} className="px-8 py-3 bg-red-600 rounded-full text-white font-semibold hover:bg-red-500">End Call</button>
                     )}
                </div>
            </div>
        </div>
    );
};

export default CallModal;