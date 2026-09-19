package com.nexchat.websocket;

import com.nexchat.concurrency.SessionRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

@Component
@RequiredArgsConstructor
@Slf4j
public class WebSocketEventListener {

    private final SessionRegistry sessionRegistry;
    private final com.nexchat.service.PresenceService presenceService;

    @EventListener
    public void handleWebSocketConnectListener(SessionConnectedEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = headerAccessor.getSessionId();
        
        String username = null;
        if (event.getUser() != null) {
            username = event.getUser().getName();
        }
        
        if (sessionId != null && username != null) {
            sessionRegistry.registerSession(sessionId, username);
            log.info("User Connected : {}, Total Active Sessions: {}", username, sessionRegistry.getActiveSessionCount());
        }
    }

    @EventListener
    public void handleWebSocketDisconnectListener(SessionDisconnectEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = headerAccessor.getSessionId();
        
        String username = null;
        if (headerAccessor.getUser() != null) {
            username = headerAccessor.getUser().getName();
        }
        
        if (sessionId != null) {
            sessionRegistry.removeSession(sessionId);
        }
        
        if (username != null) {
            presenceService.markUserOffline(username);
            log.info("User Disconnected : {}, Total Active Sessions: {}", username, sessionRegistry.getActiveSessionCount());
        }
    }
}
