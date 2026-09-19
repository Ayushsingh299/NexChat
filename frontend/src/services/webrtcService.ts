export class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  public localStream: MediaStream | null = null;
  public remoteStream: MediaStream | null = null;
  
  private onRemoteStreamCallback: ((stream: MediaStream) => void) | null = null;
  private onSignalCallback: ((signal: any) => void) | null = null;
  
  private isVideoCall: boolean = false;
  private recipientId: number | null = null;

  private rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  public setOnRemoteStream(callback: (stream: MediaStream) => void) {
    this.onRemoteStreamCallback = callback;
  }

  public setOnSignal(callback: (signal: any) => void) {
    this.onSignalCallback = callback;
  }

  private initPeerConnection() {
    this.peerConnection = new RTCPeerConnection(this.rtcConfig);

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.onSignalCallback) {
        this.onSignalCallback({
          type: 'candidate',
          recipientId: this.recipientId,
          candidate: event.candidate,
          isVideo: this.isVideoCall
        });
      }
    };

    this.peerConnection.ontrack = (event) => {
      this.remoteStream = event.streams[0];
      if (this.onRemoteStreamCallback) {
        this.onRemoteStreamCallback(this.remoteStream);
      }
    };

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        if (this.peerConnection && this.localStream) {
          this.peerConnection.addTrack(track, this.localStream);
        }
      });
    }
  }

  public async startCall(isVideo: boolean, recipientId: number) {
    this.isVideoCall = isVideo;
    this.recipientId = recipientId;
    
    this.localStream = await navigator.mediaDevices.getUserMedia({ 
      video: isVideo, 
      audio: true 
    });

    this.initPeerConnection();

    if (!this.peerConnection) return;

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    if (this.onSignalCallback) {
      this.onSignalCallback({
        type: 'offer',
        recipientId: this.recipientId,
        sdp: offer.sdp,
        isVideo: this.isVideoCall
      });
    }
  }

  public async handleOffer(offerSignal: any) {
    this.isVideoCall = offerSignal.isVideo;
    this.recipientId = offerSignal.senderId;

    this.localStream = await navigator.mediaDevices.getUserMedia({ 
      video: this.isVideoCall, 
      audio: true 
    });

    this.initPeerConnection();

    if (!this.peerConnection) return;

    await this.peerConnection.setRemoteDescription(new RTCSessionDescription({
      type: 'offer',
      sdp: offerSignal.sdp
    }));

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    if (this.onSignalCallback) {
      this.onSignalCallback({
        type: 'answer',
        recipientId: this.recipientId,
        sdp: answer.sdp,
        isVideo: this.isVideoCall
      });
    }
  }

  public async handleAnswer(answerSignal: any) {
    if (this.peerConnection) {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription({
        type: 'answer',
        sdp: answerSignal.sdp
      }));
    }
  }

  public async handleCandidate(candidateSignal: any) {
    if (this.peerConnection && candidateSignal.candidate) {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidateSignal.candidate));
    }
  }

  public toggleMute() {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      return !this.localStream.getAudioTracks()[0]?.enabled;
    }
    return false;
  }

  public toggleVideo() {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      return !this.localStream.getVideoTracks()[0]?.enabled;
    }
    return false;
  }

  public endCall() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this.remoteStream = null;
    this.recipientId = null;
  }
}

export const webrtcService = new WebRTCService();
