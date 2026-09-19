package com.nexchat.redis;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexchat.dto.ChatMessageResponse;
import com.nexchat.dto.TypingIndicator;
import com.nexchat.dto.WebRTCSignal;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.connection.stream.MapRecord;
import org.springframework.data.redis.stream.StreamListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class RedisBroadcastListener implements StreamListener<String, MapRecord<String, String, String>> {

    private final SimpMessagingTemplate messagingTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    @Override
    public void onMessage(MapRecord<String, String, String> message) {
        try {
            Map<String, String> value = message.getValue();
            String eventType = value.get("eventType");
            String payloadJson = value.get("payload");

            if (eventType == null || payloadJson == null) {
                return;
            }

            log.debug("Received broadcast event: {}", eventType);

            switch (eventType) {
                case "NEW_MESSAGE":
                case "EDIT_MESSAGE":
                case "DELETE_MESSAGE":
                case "REACTION":
                    ChatMessageResponse response = objectMapper.readValue(payloadJson, ChatMessageResponse.class);
                    if ("GROUP".equals(response.getStatus())) {
                        messagingTemplate.convertAndSend("/topic/group." + response.getRecipientId(), response);
                    } else {
                        // For direct messages, broadcast to both sender and recipient connected to this node
                        messagingTemplate.convertAndSendToUser(String.valueOf(response.getRecipientId()), "/queue/messages", response);
                        messagingTemplate.convertAndSendToUser(String.valueOf(response.getSenderId()), "/queue/messages", response);
                    }
                    break;

                case "TYPING":
                    TypingIndicator indicator = objectMapper.readValue(payloadJson, TypingIndicator.class);
                    if (Boolean.TRUE.equals(indicator.getIsGroup())) {
                        messagingTemplate.convertAndSend("/topic/group." + indicator.getRecipientId() + ".typing", indicator);
                    } else {
                        messagingTemplate.convertAndSendToUser(
                                String.valueOf(indicator.getRecipientId()), 
                                "/queue/typing", 
                                indicator
                        );
                    }
                    break;
                    
                case "WEBRTC_SIGNAL":
                    WebRTCSignal signal = objectMapper.readValue(payloadJson, WebRTCSignal.class);
                    messagingTemplate.convertAndSendToUser(
                            String.valueOf(signal.getRecipientId()),
                            "/queue/webrtc",
                            signal
                    );
                    break;
                    
                default:
                    log.warn("Unknown broadcast event type: {}", eventType);
            }

        } catch (Exception e) {
            log.error("Error processing broadcast message", e);
        }
    }
}
