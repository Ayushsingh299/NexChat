package com.nexchat.controller;

import com.nexchat.dto.WebRTCSignal;
import com.nexchat.model.User;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.data.redis.core.RedisTemplate;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;

@Controller
@Slf4j
public class WebRTCController {

    private final RedisTemplate<String, Object> redisTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    public WebRTCController(RedisTemplate<String, Object> redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    @MessageMapping("/webrtc.signal")
    public void handleSignaling(@Payload WebRTCSignal signal, Authentication authentication) {
        User currentUser = (User) authentication.getPrincipal();
        
        // Ensure senderId matches authenticated user for security
        signal.setSenderId(currentUser.getId());

        // Relay the signal across all nodes via Redis Broadcast
        try {
            java.util.Map<String, String> broadcastPayload = new java.util.HashMap<>();
            broadcastPayload.put("eventType", "WEBRTC_SIGNAL");
            broadcastPayload.put("payload", objectMapper.writeValueAsString(signal));
            redisTemplate.opsForStream().add("chat.broadcast.stream", broadcastPayload);
        } catch (Exception e) {
            log.error("Failed to broadcast WebRTC signal", e);
        }
    }
}
