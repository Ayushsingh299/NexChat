package com.nexchat.concurrency;

import org.springframework.stereotype.Component;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Component
public class SessionRegistry {

    // Maps STOMP session ID to User's Email or ID
    private final ConcurrentMap<String, String> activeSessions = new ConcurrentHashMap<>();

    public void registerSession(String sessionId, String username) {
        activeSessions.put(sessionId, username);
    }

    public void removeSession(String sessionId) {
        activeSessions.remove(sessionId);
    }

    public String getUsernameForSession(String sessionId) {
        return activeSessions.get(sessionId);
    }
    
    public int getActiveSessionCount() {
        return activeSessions.size();
    }
}
