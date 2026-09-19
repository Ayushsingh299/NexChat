package com.nexchat.redis;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexchat.dto.ChatMessageResponse;
import com.nexchat.model.Message;
import com.nexchat.model.GroupMessage;
import com.nexchat.repository.MessageRepository;
import com.nexchat.repository.GroupMessageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class MessageAnalyticsListener {

    private final MessageRepository messageRepository;
    private final GroupMessageRepository groupMessageRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public void receiveMessage(String message) {
        try {
            JsonNode node = objectMapper.readTree(message);
            Long messageId = node.get("messageId").asLong();
            boolean isGroup = node.get("isGroup").asBoolean();
            String sentiment = node.get("sentiment").asText();
            Double spamScore = node.get("spamScore").asDouble();

            if (isGroup) {
                groupMessageRepository.findById(messageId).ifPresent(msg -> {
                    msg.setSentiment(sentiment);
                    msg.setSpamScore(spamScore);
                    groupMessageRepository.save(msg);
                    
                    // Notify clients
                    ChatMessageResponse response = ChatMessageResponse.builder()
                        .id(msg.getId())
                        .senderId(msg.getSender().getId())
                        .recipientId(msg.getGroup().getId())
                        .senderName(msg.getSender().getProfile().getFullName())
                        .content(msg.getContent())
                        .attachmentUrl(msg.getAttachmentUrl())
                        .status("GROUP")
                        .sentiment(sentiment)
                        .spamScore(spamScore)
                        .timestamp(msg.getCreatedAt())
                        .build();
                        
                    messagingTemplate.convertAndSend("/topic/group." + msg.getGroup().getId(), response);
                });
            } else {
                messageRepository.findById(messageId).ifPresent(msg -> {
                    msg.setSentiment(sentiment);
                    msg.setSpamScore(spamScore);
                    messageRepository.save(msg);
                    
                    // Notify clients
                    ChatMessageResponse response = ChatMessageResponse.builder()
                        .id(msg.getId())
                        .senderId(msg.getSender().getId())
                        .recipientId(msg.getConversation().getId())
                        .senderName(msg.getSender().getProfile().getFullName())
                        .content(msg.getContent())
                        .attachmentUrl(msg.getAttachmentUrl())
                        .status(msg.getStatus().name())
                        .sentiment(sentiment)
                        .spamScore(spamScore)
                        .timestamp(msg.getCreatedAt())
                        .build();
                        
                    messagingTemplate.convertAndSendToUser(
                        msg.getConversation().getUser1().getId().toString(),
                        "/queue/messages", response);
                        
                    messagingTemplate.convertAndSendToUser(
                        msg.getConversation().getUser2().getId().toString(),
                        "/queue/messages", response);
                });
            }
        } catch (Exception e) {
            log.error("Failed to parse analytics result: ", e);
        }
    }
}
