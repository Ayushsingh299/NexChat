package com.nexchat.controller;

import com.nexchat.dto.ChatMessageRequest;
import com.nexchat.dto.GroupMessageRequest;
import com.nexchat.dto.ChatMessageResponse;
import com.nexchat.model.User;
import com.nexchat.service.ChatService;
import com.nexchat.service.GroupService;
import com.nexchat.concurrency.AsyncMessageProcessor;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.data.redis.core.RedisTemplate;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;

import java.util.List;

@RestController
@RequiredArgsConstructor
@Slf4j
public class ChatController {

    private final ChatService chatService;
    private final GroupService groupService;
    private final AsyncMessageProcessor asyncMessageProcessor;
    private final com.nexchat.repository.MessageRepository messageRepository;
    private final com.nexchat.repository.GroupMessageRepository groupMessageRepository;
    private final RedisTemplate<String, Object> redisTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    private void broadcastEvent(String eventType, Object payload) {
        try {
            java.util.Map<String, String> broadcastPayload = new java.util.HashMap<>();
            broadcastPayload.put("eventType", eventType);
            broadcastPayload.put("payload", objectMapper.writeValueAsString(payload));
            redisTemplate.opsForStream().add("chat.broadcast.stream", broadcastPayload);
        } catch (Exception e) {
            log.error("Failed to broadcast event: {}", eventType, e);
        }
    }

    @MessageMapping("/chat.sendMessage")
    public void sendMessage(
            @Payload ChatMessageRequest chatMessageRequest,
            Authentication authentication
    ) {
        User sender = (User) authentication.getPrincipal();
        
        // Push message to BlockingQueue instead of processing synchronously
        asyncMessageProcessor.enqueueMessage(sender.getId(), chatMessageRequest);
    }

    @MessageMapping("/chat.sendGroupMessage")
    public void sendGroupMessage(
            @Payload GroupMessageRequest groupMessageRequest,
            Authentication authentication
    ) {
        User sender = (User) authentication.getPrincipal();
        
        asyncMessageProcessor.enqueueGroupMessage(sender.getId(), groupMessageRequest);
    }
    
    @MessageMapping("/chat.messageDelivered")
    public void messageDelivered(
            @Payload Long messageId,
            Authentication authentication
    ) {
        User currentUser = (User) authentication.getPrincipal();
        if (currentUser.getProfile() != null && !currentUser.getProfile().isReadReceiptsEnabled()) {
            return; // Skip read receipts for privacy
        }
        chatService.markAsDelivered(messageId);
    }

    @MessageMapping("/chat.typing")
    public void typingIndicator(
            @Payload com.nexchat.dto.TypingIndicator typingIndicator,
            Authentication authentication
    ) {
        User sender = (User) authentication.getPrincipal();
        typingIndicator.setSenderId(sender.getId());
        
        broadcastEvent("TYPING", typingIndicator);
    }

    @GetMapping("/sync")
    public ResponseEntity<List<ChatMessageResponse>> syncMessages(
            @org.springframework.web.bind.annotation.RequestParam("after") Long lastMessageId,
            Authentication authentication
    ) {
        User user = (User) authentication.getPrincipal();
        return ResponseEntity.ok(chatService.syncMessages(user.getId(), lastMessageId));
    }

    @GetMapping("/api/v1/conversations/{recipientId}/messages")
    public ResponseEntity<List<ChatMessageResponse>> getMessages(
            @PathVariable Long recipientId,
            Authentication authentication
    ) {
        User currentUser = (User) authentication.getPrincipal();
        return ResponseEntity.ok(chatService.getConversationMessages(currentUser.getId(), recipientId));
    }

    @PutMapping("/api/v1/conversations/{userId}/manage")
    public ResponseEntity<Void> manageChat(
            @PathVariable Long userId,
            @RequestBody com.nexchat.dto.ChatManageRequest request,
            Authentication authentication
    ) {
        User currentUser = (User) authentication.getPrincipal();
        chatService.manageChat(currentUser.getId(), userId, request);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/api/v1/conversations/{userId}/messages")
    public ResponseEntity<Void> clearChat(
            @PathVariable Long userId,
            Authentication authentication
    ) {
        User currentUser = (User) authentication.getPrincipal();
        chatService.clearChat(currentUser.getId(), userId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/api/v1/conversations/{userId}/read")
    public ResponseEntity<Void> markAsRead(
            @PathVariable Long userId,
            Authentication authentication
    ) {
        User currentUser = (User) authentication.getPrincipal();
        chatService.markAsRead(currentUser.getId(), userId);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/api/v1/sync/messages")
    public ResponseEntity<java.util.Map<String, Object>> getMissedMessages(
            @org.springframework.web.bind.annotation.RequestParam("since") @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE_TIME) java.time.LocalDateTime since,
            Authentication authentication
    ) {
        User currentUser = (User) authentication.getPrincipal();
        Long userId = currentUser.getId();
        
        List<com.nexchat.model.Message> directMessages = messageRepository.findMissedMessages(userId, since);
        List<com.nexchat.model.GroupMessage> groupMessages = groupMessageRepository.findMissedGroupMessages(userId, since);
        
        List<ChatMessageResponse> directResponses = directMessages.stream().map(m -> ChatMessageResponse.builder()
                .id(m.getId())
                .senderId(m.getSender().getId())
                .recipientId(m.getConversation().getUser1().getId().equals(m.getSender().getId()) ? m.getConversation().getUser2().getId() : m.getConversation().getUser1().getId())
                .senderName(m.getSender().getProfile() != null ? m.getSender().getProfile().getFullName() : m.getSender().getEmail())
                .content(m.getContent())
                .attachmentUrl(m.getAttachmentUrl())
                .status("DIRECT")
                .sentiment(m.getSentiment())
                .spamScore(m.getSpamScore())
                .isEdited(m.isEdited())
                .isDeleted(m.isDeleted())
                .replyToMessageId(m.getReplyToMessageId())
                .reactions(m.getReactions())
                .timestamp(m.getCreatedAt())
                .build()).toList();
                
        List<ChatMessageResponse> groupResponses = groupMessages.stream().map(gm -> ChatMessageResponse.builder()
                .id(gm.getId())
                .senderId(gm.getSender().getId())
                .recipientId(gm.getGroup().getId())
                .senderName(gm.getSender().getProfile() != null ? gm.getSender().getProfile().getFullName() : gm.getSender().getEmail())
                .content(gm.getContent())
                .attachmentUrl(gm.getAttachmentUrl())
                .status("GROUP")
                .sentiment(gm.getSentiment())
                .spamScore(gm.getSpamScore())
                .isEdited(gm.isEdited())
                .isDeleted(gm.isDeleted())
                .replyToMessageId(gm.getReplyToMessageId())
                .reactions(gm.getReactions())
                .timestamp(gm.getCreatedAt())
                .build()).toList();
                
        java.util.Map<String, Object> response = new java.util.HashMap<>();
        response.put("directMessages", directResponses);
        response.put("groupMessages", groupResponses);
        
        return ResponseEntity.ok(response);
    }
    
    @PutMapping("/api/v1/messages/{messageId}")
    public ResponseEntity<ChatMessageResponse> editMessage(
            @PathVariable Long messageId,
            @RequestBody java.util.Map<String, String> body,
            Authentication authentication
    ) {
        User currentUser = (User) authentication.getPrincipal();
        ChatMessageResponse response = chatService.editMessage(currentUser.getId(), messageId, body.get("content"));
        
        broadcastEvent("EDIT_MESSAGE", response);
        
        return ResponseEntity.ok(response);
    }
    
    @DeleteMapping("/api/v1/messages/{messageId}")
    public ResponseEntity<ChatMessageResponse> deleteMessage(
            @PathVariable Long messageId,
            Authentication authentication
    ) {
        User currentUser = (User) authentication.getPrincipal();
        ChatMessageResponse response = chatService.deleteMessage(currentUser.getId(), messageId);
        
        broadcastEvent("DELETE_MESSAGE", response);
        
        return ResponseEntity.ok(response);
    }
    
    @PostMapping("/api/v1/messages/{messageId}/react")
    public ResponseEntity<ChatMessageResponse> toggleReaction(
            @PathVariable Long messageId,
            @org.springframework.web.bind.annotation.RequestParam("isGroup") boolean isGroup,
            @RequestBody java.util.Map<String, String> body,
            Authentication authentication
    ) {
        User currentUser = (User) authentication.getPrincipal();
        String emoji = body.get("emoji");
        
        ChatMessageResponse response;
        if (isGroup) {
            response = groupService.toggleReaction(currentUser.getId(), messageId, emoji);
        } else {
            response = chatService.toggleReaction(currentUser.getId(), messageId, emoji);
        }
        
        broadcastEvent("REACTION", response);
        
        return ResponseEntity.ok(response);
    }
}
