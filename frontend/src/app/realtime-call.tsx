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

export function RealtimeCall({ userId, peer, peers, onIncomingPeer }: any) {
  const [call, setCall] = useState<any>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [audioOn, setAudioOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const callRef = useRef<any>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pendingLocal = useRef<any[]>([]);
  const pendingRemote = useRef<any[]>([]);
  const seenCandidates = useRef(new Set<string>());

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
  const createConnection = (stream: MediaStream) => {
    const connection = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });
    stream.getTracks().forEach((track) => connection.addTrack(track, stream));
    connection.onicecandidate = (event) => {
      if (event.candidate) void sendCandidate(event.candidate.toJSON());
    };
    connection.ontrack = (event) => {
      const stream = event.streams[0] || new MediaStream([event.track]);
      remoteStreamRef.current = stream;
      setRemoteStream(stream);
    };
    connection.onconnectionstatechange = () => {
      if (connection.connectionState === "failed")
        setError(
          "The peer-to-peer connection failed. End the call and try again.",
        );
    };
    pcRef.current = connection;
    return connection;
  };
  const getMedia = async () => {
    if (!navigator.mediaDevices?.getUserMedia)
      throw new Error(
        "Camera and microphone access is unavailable in this browser.",
      );
    return navigator.mediaDevices.getUserMedia({ audio: true, video: true });
  };
  const attachLocal = (stream: MediaStream) => {
    localStreamRef.current = stream;
    setLocalStream(stream);
  };

  const start = async () => {
    if (!peer || busy || callRef.current) return;
    setBusy(true);
    setError("");
    try {
      const stream = await getMedia();
      attachLocal(stream);
      const connection = createConnection(stream);
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      const result = await request({
        action: "start",
        peer: peer.id,
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
      const stream = await getMedia();
      attachLocal(stream);
      const connection = createConnection(stream);
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
  }, [remoteStream, call?.id]);
  useEffect(() => {
    let mounted = true;
    const sync = async () => {
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
        callRef.current = current;
        setCall(current);
        if (firstSeen && current.callee === userId) {
          const incomingPeer = peers.find(
            (item: any) => item.id === current.caller,
          );
          if (incomingPeer) onIncomingPeer(incomingPeer);
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
        // The workspace already displays server connectivity problems.
      }
    };
    void sync();
    const timer = window.setInterval(sync, 1000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [userId, peers.length]);
  useEffect(
    () => () => {
      const current = callRef.current;
      if (current?.id)
        fetch("/api/calls", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "end", callId: current.id }),
          keepalive: true,
        }).catch(() => {});
      pcRef.current?.close();
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  const callPeerId = call
    ? call.caller === userId
      ? call.callee
      : call.caller
    : peer?.id;
  const callPeer = peers.find((item: any) => item.id === callPeerId) || peer;
  const incoming = call?.status === "ringing" && call?.callee === userId;
  const active = call?.status === "active";
  return (
    <>
      <button
        className="secondary"
        disabled={!peer || busy || !!call}
        onClick={start}
      >
        <Video size={15} /> {busy ? "Starting…" : "Call"}
      </button>
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
                Camera and microphone access is requested only after you accept.
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
                {remoteStream ? (
                  <video ref={remoteVideoRef} autoPlay playsInline />
                ) : (
                  <div className="call-waiting">
                    <span className="avatar profile-avatar">
                      {initials(callPeer?.name)}
                    </span>
                    <p>
                      {active ? "Connecting video…" : "Waiting for an answer…"}
                    </p>
                  </div>
                )}
                <video
                  className="local-video"
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                />
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
                <button
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
                </button>
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
