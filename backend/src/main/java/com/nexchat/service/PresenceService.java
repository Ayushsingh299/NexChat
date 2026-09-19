package com.nexchat.service;

import com.nexchat.model.OnlineStatus;
import com.nexchat.model.Profile;
import com.nexchat.repository.ProfileRepository;
import com.nexchat.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.concurrent.TimeUnit;
import java.util.Map;
import java.util.HashMap;

@Service
@RequiredArgsConstructor
@Slf4j
public class PresenceService {

    private final StringRedisTemplate redisTemplate;
    private final ProfileRepository profileRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;

    private static final String PRESENCE_PREFIX = "user:presence:";
    private static final long PRESENCE_TTL_SECONDS = 60;

    public void markUserOnline(String email) {
        userRepository.findByEmail(email).ifPresent(user -> {
            String redisKey = PRESENCE_PREFIX + user.getId();
            redisTemplate.opsForValue().set(redisKey, "ONLINE", PRESENCE_TTL_SECONDS, TimeUnit.SECONDS);

            Profile profile = profileRepository.findByUserId(user.getId()).orElse(null);
            boolean showOnline = profile == null || profile.isShowOnlineStatus();

            if (showOnline) {
                // Broadcast to STOMP topic
                Map<String, Object> presenceEvent = new HashMap<>();
                presenceEvent.put("userId", user.getId());
                presenceEvent.put("online", true);
                messagingTemplate.convertAndSend("/topic/presence", (Object) presenceEvent);
            }
        });
    }

    public void markUserOffline(String email) {
        userRepository.findByEmail(email).ifPresent(user -> {
            String redisKey = PRESENCE_PREFIX + user.getId();
            redisTemplate.delete(redisKey);

            // Update Database
            Profile profile = profileRepository.findByUserId(user.getId()).orElse(null);
            boolean showOnline = true;
            boolean showLastSeen = true;
            
            if (profile != null) {
                profile.setLastSeen(LocalDateTime.now());
                profile.setOnlineStatus(OnlineStatus.OFFLINE);
                profileRepository.save(profile);
                showOnline = profile.isShowOnlineStatus();
                showLastSeen = profile.isShowLastSeen();
            }

            if (showOnline || showLastSeen) {
                // Broadcast to STOMP topic
                Map<String, Object> presenceEvent = new HashMap<>();
                presenceEvent.put("userId", user.getId());
                if (showOnline) presenceEvent.put("online", false);
                if (showLastSeen) presenceEvent.put("lastSeen", LocalDateTime.now().toString());
                messagingTemplate.convertAndSend("/topic/presence", (Object) presenceEvent);
            }
        });
    }

    public boolean isUserOnline(Long userId) {
        String redisKey = PRESENCE_PREFIX + userId;
        return Boolean.TRUE.equals(redisTemplate.hasKey(redisKey));
    }

    public int getActiveWebSocketUsersCount() {
        // Simple approximation: count active presence keys in Redis
        java.util.Set<String> keys = redisTemplate.keys(PRESENCE_PREFIX + "*");
        return keys != null ? keys.size() : 0;
    }
}
