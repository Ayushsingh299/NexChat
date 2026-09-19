package com.nexchat.concurrency;

import com.nexchat.dto.ChatMessageRequest;
import com.nexchat.dto.GroupMessageRequest;
import com.nexchat.dto.ChatMessageResponse;
import com.nexchat.service.ChatService;
import com.nexchat.service.GroupService;
import com.nexchat.model.User;
import com.nexchat.repository.UserRepository;
import jakarta.annotation.PostConstruct;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.Executor;
import java.util.HashMap;
import java.util.Map;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.redis.core.RedisTemplate;
import com.fasterxml.jackson.databind.ObjectMapper;

@Service
@Slf4j
public class AsyncMessageProcessor {

    private final ChatService chatService;
    private final GroupService groupService;
    private final SimpMessagingTemplate messagingTemplate;
    private final RedisTemplate<String, Object> redisTemplate;
    private final UserRepository userRepository;
    private final Executor taskExecutor;
    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    public AsyncMessageProcessor(ChatService chatService, 
                                 GroupService groupService, 
                                 SimpMessagingTemplate messagingTemplate,
                                 RedisTemplate<String, Object> redisTemplate,
                                 UserRepository userRepository,
                                 @Qualifier("chatMessageTaskExecutor") Executor taskExecutor) {
        this.chatService = chatService;
        this.groupService = groupService;
        this.messagingTemplate = messagingTemplate;
        this.redisTemplate = redisTemplate;
        this.userRepository = userRepository;
        this.taskExecutor = taskExecutor;
    }

    private final BlockingQueue<PendingMessage> messageQueue = new LinkedBlockingQueue<>(10000);

    @PostConstruct
    public void startConsumers() {
        // Start 5 consumer threads to process messages continuously
        for (int i = 0; i < 5; i++) {
            taskExecutor.execute(this::consumeMessages);
        }
    }

    public void enqueueMessage(Long senderId, ChatMessageRequest request) {
        try {
            messageQueue.put(new PendingMessage(senderId, request, null));
            log.debug("Message enqueued. Queue size: {}", messageQueue.size());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.error("Failed to enqueue message", e);
        }
    }

    public void enqueueGroupMessage(Long senderId, GroupMessageRequest request) {
        try {
            messageQueue.put(new PendingMessage(senderId, null, request));
            log.debug("Group message enqueued. Queue size: {}", messageQueue.size());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.error("Failed to enqueue group message", e);
        }
    }

    private void consumeMessages() {
        while (!Thread.currentThread().isInterrupted()) {
            try {
                PendingMessage task = messageQueue.take(); // Blocks until a message is available
                processMessage(task);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                log.info("Consumer thread interrupted, stopping.");
                break;
            } catch (Exception e) {
                log.error("Error processing message", e);
            }
        }
    }

    private void processMessage(PendingMessage task) {
        log.debug("Processing message in thread: {}", Thread.currentThread().getName());
        
        if (task.getGroupRequest() != null) {
            // Process Group Message
            ChatMessageResponse savedMsg = groupService.saveGroupMessage(
                    task.getSenderId(), 
                    task.getGroupRequest().getGroupId(), 
                    task.getGroupRequest().getContent(),
                    task.getGroupRequest().getAttachmentUrl(),
                    task.getGroupRequest().getExpiresInSeconds(),
                    task.getGroupRequest().getClientMessageId()
            );
            // Broadcast message across all nodes
            try {
                Map<String, String> broadcastPayload = new HashMap<>();
                broadcastPayload.put("eventType", "NEW_MESSAGE");
                broadcastPayload.put("payload", objectMapper.writeValueAsString(savedMsg));
                redisTemplate.opsForStream().add("chat.broadcast.stream", broadcastPayload);
            } catch (Exception e) {
                log.error("Failed to broadcast group message", e);
            }
            
            // Publish to Redis Stream for ML Analysis
            Map<String, String> streamPayload = new HashMap<>();
            streamPayload.put("messageId", savedMsg.getId().toString());
            streamPayload.put("content", savedMsg.getContent());
            streamPayload.put("isGroup", "true");
            redisTemplate.opsForStream().add("chat.analyze.stream", streamPayload);
            
            // Auto Reply Feature for Group Chat
            taskExecutor.execute(() -> {
                try {
                    Thread.sleep(1500); // Simulate typing delay
                    Long replierId = groupService.getGroupMemberIds(task.getGroupRequest().getGroupId(), task.getSenderId())
                        .stream()
                        .filter(id -> !id.equals(task.getSenderId()))
                        .findFirst().orElse(null);
                        
                    if (replierId != null) {
                        ChatMessageResponse replyMsg = groupService.saveGroupMessage(
                                replierId, 
                                task.getGroupRequest().getGroupId(), 
                                "Auto-reply: " + task.getGroupRequest().getContent(),
                                null, null, null
                        );
                        
                        Map<String, String> broadcast = new HashMap<>();
                        broadcast.put("eventType", "NEW_MESSAGE");
                        broadcast.put("payload", objectMapper.writeValueAsString(replyMsg));
                        redisTemplate.opsForStream().add("chat.broadcast.stream", broadcast);
                    }
                } catch (Exception e) {}
            });
            
        } else if (task.getRequest() != null) {
            // Process 1-to-1 Message
            User sender = userRepository.findById(task.getSenderId()).orElse(null);
            User recipient = userRepository.findById(task.getRequest().getRecipientId()).orElse(null);
            if (sender == null || recipient == null) return;
            
            // Check if recipient has blocked the sender
            if (recipient.getProfile() != null && recipient.getProfile().getBlockedUserIds().contains(sender.getId())) {
                log.warn("Message dropped: User {} is blocked by User {}", sender.getId(), recipient.getId());
                return;
            }

            ChatMessageResponse savedMsg = chatService.saveMessage(task.getSenderId(), task.getRequest());
            
            // Broadcast message across all nodes
            try {
                Map<String, String> broadcastPayload = new HashMap<>();
                broadcastPayload.put("eventType", "NEW_MESSAGE");
                broadcastPayload.put("payload", objectMapper.writeValueAsString(savedMsg));
                redisTemplate.opsForStream().add("chat.broadcast.stream", broadcastPayload);
            } catch (Exception e) {
                log.error("Failed to broadcast direct message", e);
            }
            
            // Publish to Redis Stream for ML Analysis
            Map<String, String> streamPayload = new HashMap<>();
            streamPayload.put("messageId", savedMsg.getId().toString());
            streamPayload.put("content", savedMsg.getContent());
            streamPayload.put("isGroup", "false");
            redisTemplate.opsForStream().add("chat.analyze.stream", streamPayload);
            
            // Auto Reply Feature for Direct Message
            taskExecutor.execute(() -> {
                try {
                    Thread.sleep(1500); // Simulate typing delay
                    ChatMessageRequest replyReq = new ChatMessageRequest();
                    replyReq.setRecipientId(sender.getId());
                    replyReq.setContent("Auto-reply: " + task.getRequest().getContent());
                    
                    ChatMessageResponse replyMsg = chatService.saveMessage(recipient.getId(), replyReq);
                    
                    Map<String, String> broadcast = new HashMap<>();
                    broadcast.put("eventType", "NEW_MESSAGE");
                    broadcast.put("payload", objectMapper.writeValueAsString(replyMsg));
                    redisTemplate.opsForStream().add("chat.broadcast.stream", broadcast);
                } catch (Exception e) {
                    log.error("Failed to send auto-reply", e);
                }
            });
        }
    }

    @Data
    @AllArgsConstructor
    private static class PendingMessage {
        private Long senderId;
        private ChatMessageRequest request;
        private GroupMessageRequest groupRequest;
    }
}
