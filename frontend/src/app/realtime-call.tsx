"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const initials = (value = "N") =>
  value
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

export function RealtimeCall({ userId, peer, peers, onIncomingPeer, requestCall }: any) {
  const [call, setCall] = useState<any>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [audioOn, setAudioOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const callRef = useRef<any>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const relayConfiguredRef = useRef(false);
  const pendingLocal = useRef<any[]>([]);
  const pendingRemote = useRef<any[]>([]);
  const seenCandidates = useRef(new Set<string>());
  const syncPending = useRef(false);
  const peersRef = useRef(peers);
  peersRef.current = peers;
  const incomingHandler = useRef(onIncomingPeer);
  incomingHandler.current = onIncomingPeer;
  const lastRequest = useRef<string>('');

  const request = async (data: any) => {
    const response = await fetch("/api/calls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await response
      .json()
      .catch(() => ({
        error: "The call service returned an invalid response.",
      }));
    if (!response.ok)
      throw new Error(result.error || "The call could not be updated.");
    return result;
  };

  const stopMedia = () => {
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    remoteStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setAudioOn(true);
    setVideoOn(true);
    setConnected(false);
    pendingLocal.current = [];
    pendingRemote.current = [];
    seenCandidates.current.clear();
  };
  const clearCall = () => {
    stopMedia();
    callRef.current = null;
    setCall(null);
    setBusy(false);
  };
  const sendCandidate = async (candidate: any) => {
    const current = callRef.current;
    if (!current?.id) {
      pendingLocal.current.push(candidate);
      return;
    }
    try {
      await request({
        action: "candidate",
        callId: current.id,
        candidate,
      });
    } catch {
      setError("The call could not exchange network information.");
    }
  };
  const flushLocal = async () => {
    const queued = pendingLocal.current.splice(0);
    for (const candidate of queued) await sendCandidate(candidate);
  };
  const flushRemote = async () => {
    const connection = pcRef.current;
    if (!connection?.remoteDescription) return;
    const queued = pendingRemote.current.splice(0);
    for (const candidate of queued) {
      try {
        await connection.addIceCandidate(candidate);
      } catch {
        setError("A network path for this call could not be added.");
      }
    }
  };
  const createConnection = async (stream: MediaStream) => {
    const response = await fetch('/api/calls/config', { cache: 'no-store' });
    const config = await response.json();
    if (!response.ok) throw new Error(config.error || 'Call configuration is unavailable.');
    relayConfiguredRef.current = Boolean(config.relayConfigured);
    if (!config.relayConfigured) toast.info('No TURN relay is configured. Calls may fail on restricted networks.');
    const connection = new RTCPeerConnection({
      iceServers: config.iceServers,
    });
    stream.getTracks().forEach((track) => connection.addTrack(track, stream));
    connection.onicecandidate = (event) => {
      if (event.candidate) void sendCandidate(event.candidate.toJSON());
    };
    connection.ontrack = (event) => {
      // Some browsers deliver audio and video in separate, streamless events.
      // Keep every remote track instead of replacing the first one.
      const tracks = [...(remoteStreamRef.current?.getTracks() || []), ...event.streams.flatMap((item) => item.getTracks()), event.track];
      const stream = new MediaStream(tracks.filter((track, index) => tracks.findIndex((item) => item.id === track.id) === index));
      remoteStreamRef.current = stream;
      setRemoteStream(stream);
    };
    connection.onconnectionstatechange = () => {
      setConnected(connection.connectionState === "connected");
      if (connection.connectionState === "failed")
        setError(
          relayConfiguredRef.current
            ? "The peer-to-peer connection failed. End the call and try again."
            : "The connection failed. A TURN relay may be needed on this network; end the call and try again.",
        );
    };
    connection.oniceconnectionstatechange = () => {
      if (connection.iceConnectionState === "disconnected")
        setError("The call is reconnecting. Keep this window open for a moment.");
      if (connection.iceConnectionState === "failed")
        setError(
          relayConfiguredRef.current
            ? "The network path failed. Check both connections and try the call again."
            : "The network path failed. Configure a TURN relay for calls across restricted networks.",
        );
    };
    pcRef.current = connection;
    return connection;
  };
  const getMedia = async (media = 'video') => {
    if (!window.isSecureContext)
      throw new Error("Calls require HTTPS or localhost so the browser can use your microphone and camera.");
    if (!navigator.mediaDevices?.getUserMedia)
      throw new Error(
        "Camera and microphone access is unavailable in this browser.",
      );
    setVideoOn(media === 'video');
    return navigator.mediaDevices.getUserMedia({ audio: true, video: media === 'video' });
  };
  const attachLocal = (stream: MediaStream) => {
    localStreamRef.current = stream;
    setLocalStream(stream);
  };

  const start = async (media = 'video') => {
    if (!peer || busy || callRef.current) return;
    setBusy(true);
    setError("");
    try {
      const stream = await getMedia(media);
      attachLocal(stream);
      const connection = await createConnection(stream);
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      const result = await request({
        action: "start",
        peer: peer.id,
        media,
        offer: connection.localDescription?.toJSON(),
      });
      callRef.current = result.call;
      setCall(result.call);
      await flushLocal();
    } catch (reason: any) {
      stopMedia();
      toast.error(
        reason?.name === "NotAllowedError"
          ? "Allow camera and microphone access to start a call."
          : reason.message || "The call could not start.",
      );
    } finally {
      setBusy(false);
    }
  };
  const accept = async () => {
    const current = callRef.current;
    if (!current || busy) return;
    setBusy(true);
    setError("");
    try {
      const stream = await getMedia(current.media);
      attachLocal(stream);
      const connection = await createConnection(stream);
      await connection.setRemoteDescription(current.offer);
      await flushRemote();
      const answer = await connection.createAnswer();
      await connection.setLocalDescription(answer);
      const result = await request({
        action: "answer",
        callId: current.id,
        answer: connection.localDescription?.toJSON(),
      });
      callRef.current = result.call;
      setCall(result.call);
      await flushLocal();
    } catch (reason: any) {
      stopMedia();
      toast.error(
        reason?.name === "NotAllowedError"
          ? "Allow camera and microphone access to answer the call."
          : reason.message || "The call could not be answered.",
      );
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (requestCall?.id && requestCall.id !== lastRequest.current) {
      lastRequest.current = requestCall.id;
      void start(requestCall.media);
    }
  }, [requestCall?.id]);
  const finish = async (decline = false) => {
    const current = callRef.current;
    if (current?.id) {
      try {
        await request({
          action: decline ? "decline" : "end",
          callId: current.id,
        });
      } catch {
        // Always stop local media even if the other browser disappeared.
      }
    }
    clearCall();
  };

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
  }, [localStream, call?.id]);
  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = call?.media === 'audio' ? remoteStream : null;
    const element = call?.media === 'audio' ? remoteAudioRef.current : remoteVideoRef.current;
    if (remoteStream && element) void element.play().catch(() => setError("Your browser blocked call audio. Click the call window, then try again."));
  }, [remoteStream, call?.id]);
  useEffect(() => {
    let mounted = true;
    const sync = async () => {
      if (syncPending.current) return;
      syncPending.current = true;
      try {
        const response = await fetch("/api/calls", { cache: "no-store" });
        if (!response.ok) return;
        const result = await response.json();
        if (!mounted) return;
        const current = result.call;
        if (!current) {
          if (callRef.current) clearCall();
          return;
        }
        const firstSeen = !callRef.current;
        if (firstSeen && !pcRef.current && (current.status === 'active' || current.caller === userId)) {
          await request({action:'end',callId:current.id});
          toast.info('The previous call ended when this browser disconnected. Start a new call to reconnect.');
          return;
        }
        callRef.current = current;
        setCall(current);
        if (firstSeen && current.callee === userId) {
          const incomingPeer = peersRef.current.find(
            (item: any) => item.id === current.caller,
          );
          if (incomingPeer) incomingHandler.current(incomingPeer);
        }
        const connection = pcRef.current;
        if (
          connection &&
          current.caller === userId &&
          current.answer &&
          !connection.remoteDescription
        ) {
          await connection.setRemoteDescription(current.answer);
        }
        for (const item of current.candidates || []) {
          if (seenCandidates.current.has(item.id)) continue;
          seenCandidates.current.add(item.id);
          if (connection?.remoteDescription) {
            try {
              await connection.addIceCandidate(item.candidate);
            } catch {
              setError("A network path for this call could not be added.");
            }
          } else pendingRemote.current.push(item.candidate);
        }
        await flushRemote();
      } catch {
        if (callRef.current) setError('Could not reach the call service. Check your connection.');
      } finally { syncPending.current = false; }
    };
    void sync();
    const timer = window.setInterval(sync, 1000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [userId]);
  useEffect(() => {
    // React may temporarily unmount a component during a normal UI update.
    // Ending the server call from that cleanup was hanging up active calls.
    // Only notify the server when the learner actually leaves the document.
    const leavePage = () => {
      const current = callRef.current;
      if (current?.id)
        fetch("/api/calls", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "end", callId: current.id }),
          keepalive: true,
        }).catch(() => {});
    };
    window.addEventListener("pagehide", leavePage);
    return () => {
      window.removeEventListener("pagehide", leavePage);
      pcRef.current?.close();
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const callPeerId = call
    ? call.caller === userId
      ? call.callee
      : call.caller
    : peer?.id;
  const callPeer = peers.find((item: any) => item.id === callPeerId) || peer;
  const incoming = call?.status === "ringing" && call?.callee === userId;
  const active = call?.status === "active";
  const audioCall = call?.media === "audio";
  const remoteVideoReady = Boolean(remoteStream?.getVideoTracks().length);
  return (
    <>
      {!requestCall && <button
        className="secondary"
        disabled={!peer || busy || !!call}
        onClick={() => start('video')}
      >
        <Video size={15} /> {busy ? "Starting…" : "Call"}
      </button>}
      <Dialog open={!!call} onOpenChange={(open) => !open && finish(incoming)}>
        <DialogContent className="call-dialog">
          <DialogHeader>
            <DialogDescription className="modal-kicker">
              REAL-TIME STUDY CALL
            </DialogDescription>
            <DialogTitle>
              {incoming
                ? `${callPeer?.name || "A learner"} is calling`
                : active
                  ? `Call with ${callPeer?.name || "your study partner"}`
                  : `Calling ${callPeer?.name || "your study partner"}…`}
            </DialogTitle>
          </DialogHeader>
          {error && <div className="notice amber">{error}</div>}
          {incoming && !localStream ? (
            <div className="incoming-call">
              <span className="avatar profile-avatar">
                {initials(callPeer?.name)}
              </span>
              <p>
                {call?.media === 'audio' ? 'Microphone' : 'Camera and microphone'} access is requested only after you accept.
              </p>
              <div className="call-actions">
                <button
                  className="call-end"
                  disabled={busy}
                  onClick={() => finish(true)}
                >
                  <PhoneOff size={18} /> Decline
                </button>
                <button className="primary" disabled={busy} onClick={accept}>
                  <Phone size={18} /> {busy ? "Joining…" : "Accept"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="call-stage">
                {audioCall ? (
                  <div className="call-waiting">
                    <span className="avatar profile-avatar">{initials(callPeer?.name)}</span>
                    <p>{connected ? 'Audio connected' : active ? 'Connecting audio…' : 'Waiting for an answer…'}</p>
                  </div>
                ) : remoteVideoReady ? (
                  <video ref={remoteVideoRef} autoPlay playsInline />
                ) : (
                  <div className="call-waiting">
                    <span className="avatar profile-avatar">
                      {initials(callPeer?.name)}
                    </span>
                    <p>
                      {active ? 'Connecting video…' : "Waiting for an answer…"}
                    </p>
                  </div>
                )}
                <audio ref={remoteAudioRef} autoPlay playsInline />
                {!audioCall && <video
                  className="local-video"
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                />}
              </div>
              <div className="call-controls">
                <button
                  className={!audioOn ? "off" : ""}
                  onClick={() => {
                    const next = !audioOn;
                    localStreamRef.current
                      ?.getAudioTracks()
                      .forEach((track) => (track.enabled = next));
                    setAudioOn(next);
                  }}
                  aria-label={audioOn ? "Mute microphone" : "Unmute microphone"}
                >
                  {audioOn ? <Mic size={18} /> : <MicOff size={18} />}
                </button>
                {call?.media !== 'audio' && <button
                  className={!videoOn ? "off" : ""}
                  onClick={() => {
                    const next = !videoOn;
                    localStreamRef.current
                      ?.getVideoTracks()
                      .forEach((track) => (track.enabled = next));
                    setVideoOn(next);
                  }}
                  aria-label={videoOn ? "Turn camera off" : "Turn camera on"}
                >
                  {videoOn ? <Video size={18} /> : <VideoOff size={18} />}
                </button>}
                <button className="call-end" onClick={() => finish(false)}>
                  <PhoneOff size={19} /> End
                </button>
              </div>
            </>
          )}
          <p className="help call-privacy">
            Peer-to-peer audio and video are not recorded by Nexovia.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
