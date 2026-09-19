package com.nexchat.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class WebRTCSignal {
    private String type; // "offer", "answer", "candidate", "hangup", "reject"
    private Long senderId;
    private Long recipientId;
    private String sdp; // Session Description Protocol data
    private Object candidate; // RTCIceCandidate data (can be parsed as Map/JSON)
    private boolean isVideo; // true if video call, false if audio only
}
