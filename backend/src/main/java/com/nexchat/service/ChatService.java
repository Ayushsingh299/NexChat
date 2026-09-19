package com.nexchat.service;

import com.nexchat.dto.ChatMessageRequest;
import com.nexchat.dto.ChatMessageResponse;
import com.nexchat.model.Conversation;
import com.nexchat.model.Message;
import com.nexchat.model.MessageStatus;
import com.nexchat.model.User;
import com.nexchat.repository.ConversationRepository;
import com.nexchat.repository.MessageRepository;
import com.nexchat.repository.UserRepository;
import com.nexchat.repository.ChatGroupRepository;
import com.nexchat.repository.GroupMemberRepository;
import com.nexchat.repository.GroupMessageRepository;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class ChatService {

    private final MessageRepository messageRepository;
    private final ConversationRepository conversationRepository;
    private final UserRepository userRepository;
    private final ChatGroupRepository chatGroupRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final GroupMessageRepository groupMessageRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public ChatService(MessageRepository messageRepository, 
                       ConversationRepository conversationRepository, 
                       UserRepository userRepository,
                       ChatGroupRepository chatGroupRepository,
                       GroupMemberRepository groupMemberRepository,
                       GroupMessageRepository groupMessageRepository,
                       SimpMessagingTemplate messagingTemplate) {
        this.messageRepository = messageRepository;
        this.conversationRepository = conversationRepository;
        this.userRepository = userRepository;
        this.chatGroupRepository = chatGroupRepository;
        this.groupMemberRepository = groupMemberRepository;
        this.groupMessageRepository = groupMessageRepository;
        this.messagingTemplate = messagingTemplate;
    }

    @Transactional
    public ChatMessageResponse saveMessage(Long senderId, ChatMessageRequest request) {
        if (request.getClientMessageId() != null) {
            java.util.Optional<Message> existing = messageRepository.findByClientMessageId(request.getClientMessageId());
            if (existing.isPresent()) {
                return mapToResponse(existing.get(), request.getRecipientId());
            }
        }
        User sender = userRepository.findById(senderId)
                .orElseThrow(() -> new RuntimeException("Sender not found"));
        User recipient = userRepository.findById(request.getRecipientId())
                .orElseThrow(() -> new RuntimeException("Recipient not found"));

        Conversation conversation = conversationRepository.findByUsers(sender, recipient)
                .orElseGet(() -> {
                    Conversation newConv = Conversation.builder()
                            .user1(sender)
                            .user2(recipient)
                            .build();
                    return conversationRepository.save(newConv);
                });

        Message msg = Message.builder()
                .conversation(conversation)
                .sender(sender)
                .content(request.getContent())
                .clientMessageId(request.getClientMessageId())
                .attachmentUrl(request.getAttachmentUrl())
                .replyToMessageId(request.getReplyToMessageId())
                .status(MessageStatus.SENT)
                .expiresAt(request.getExpiresInSeconds() != null ? java.time.LocalDateTime.now().plusSeconds(request.getExpiresInSeconds()) : null)
                .build();

        Message savedMsg = messageRepository.save(msg);

        // Update conversation timestamp
        conversation.setUpdatedAt(savedMsg.getCreatedAt());
        conversationRepository.save(conversation);

        return mapToResponse(savedMsg, recipient.getId());
    }

    public List<ChatMessageResponse> getConversationMessages(Long user1Id, Long user2Id) {
        User user1 = userRepository.findById(user1Id).orElseThrow();
        User user2 = userRepository.findById(user2Id).orElseThrow();

        return conversationRepository.findByUsers(user1, user2)
                .map(conversation -> messageRepository.findByConversationOrderByCreatedAtAsc(conversation)
                        .stream()
                        .map(msg -> mapToResponse(msg, msg.getSender().getId().equals(user1Id) ? user2Id : user1Id))
                        .collect(Collectors.toList()))
                .orElse(List.of());
    }
    
    @Transactional
    public void markAsDelivered(Long messageId) {
        messageRepository.findById(messageId).ifPresent(msg -> {
            if (msg.getStatus() == MessageStatus.SENT) {
                msg.setStatus(MessageStatus.DELIVERED);
                messageRepository.save(msg);
            }
        });
    }

    @Transactional
    public ChatMessageResponse editMessage(Long userId, Long messageId, String newContent) {
        Message msg = messageRepository.findById(messageId)
                .orElseThrow(() -> new RuntimeException("Message not found"));
                
        if (!msg.getSender().getId().equals(userId)) {
            throw new RuntimeException("Unauthorized to edit this message");
        }
        
        msg.setContent(newContent);
        msg.setEdited(true);
        Message saved = messageRepository.save(msg);
        
        Long recipientId = msg.getConversation().getUser1().getId().equals(userId) ? msg.getConversation().getUser2().getId() : msg.getConversation().getUser1().getId();
        return mapToResponse(saved, recipientId);
    }
    
    @Transactional
    public ChatMessageResponse deleteMessage(Long userId, Long messageId) {
        Message msg = messageRepository.findById(messageId)
                .orElseThrow(() -> new RuntimeException("Message not found"));
                
        if (!msg.getSender().getId().equals(userId)) {
            throw new RuntimeException("Unauthorized to delete this message");
        }
        
        msg.setContent("This message was deleted");
        msg.setDeleted(true);
        msg.setAttachmentUrl(null); // Remove attachment
        Message saved = messageRepository.save(msg);
        
        Long recipientId = msg.getConversation().getUser1().getId().equals(userId) ? msg.getConversation().getUser2().getId() : msg.getConversation().getUser1().getId();
        return mapToResponse(saved, recipientId);
    }
    
    @Transactional
    public ChatMessageResponse toggleReaction(Long userId, Long messageId, String emoji) {
        Message msg = messageRepository.findById(messageId)
                .orElseThrow(() -> new RuntimeException("Message not found"));
        
        try {
            java.util.Map<String, java.util.List<Long>> reactions = new java.util.HashMap<>();
            if (msg.getReactions() != null && !msg.getReactions().isEmpty()) {
                reactions = objectMapper.readValue(msg.getReactions(), new TypeReference<java.util.Map<String, java.util.List<Long>>>() {});
            }
            
            java.util.List<Long> usersReacted = reactions.computeIfAbsent(emoji, k -> new java.util.ArrayList<>());
            if (usersReacted.contains(userId)) {
                usersReacted.remove(userId);
                if (usersReacted.isEmpty()) {
                    reactions.remove(emoji);
                }
            } else {
                usersReacted.add(userId);
            }
            
            msg.setReactions(objectMapper.writeValueAsString(reactions));
            Message saved = messageRepository.save(msg);
            
            Long recipientId = msg.getConversation().getUser1().getId().equals(msg.getSender().getId()) ? msg.getConversation().getUser2().getId() : msg.getConversation().getUser1().getId();
            return mapToResponse(saved, recipientId);
        } catch (Exception e) {
            throw new RuntimeException("Failed to toggle reaction", e);
        }
    }

    @Transactional
    public void manageChat(Long userId, Long otherUserId, com.nexchat.dto.ChatManageRequest request) {
        User user1 = userRepository.findById(userId).orElseThrow();
        User user2 = userRepository.findById(otherUserId).orElseThrow();
        Conversation conversation = conversationRepository.findByUsers(user1, user2)
                .orElseThrow(() -> new RuntimeException("Conversation not found"));

        boolean isUser1 = conversation.getUser1().getId().equals(userId);

        if (request.getIsPinned() != null) {
            if (isUser1) conversation.setUser1Pinned(request.getIsPinned());
            else conversation.setUser2Pinned(request.getIsPinned());
        }
        if (request.getIsMuted() != null) {
            if (isUser1) conversation.setUser1Muted(request.getIsMuted());
            else conversation.setUser2Muted(request.getIsMuted());
        }
        if (request.getIsArchived() != null) {
            if (isUser1) conversation.setUser1Archived(request.getIsArchived());
            else conversation.setUser2Archived(request.getIsArchived());
        }
        if (request.getMarkAsRead() != null && request.getMarkAsRead()) {
            if (isUser1) conversation.setUser1UnreadCount(0);
            else conversation.setUser2UnreadCount(0);
        }
        
        conversationRepository.save(conversation);
    }

    @Transactional
    public void clearChat(Long userId, Long otherUserId) {
        User user1 = userRepository.findById(userId).orElseThrow();
        User user2 = userRepository.findById(otherUserId).orElseThrow();
        Conversation conversation = conversationRepository.findByUsers(user1, user2)
                .orElseThrow(() -> new RuntimeException("Conversation not found"));

        List<Message> messages = messageRepository.findByConversationOrderByCreatedAtAsc(conversation);
        messageRepository.deleteAll(messages);
    }

    @Transactional
    public void markAsRead(Long currentUserId, Long senderId) {
        User currentUser = userRepository.findById(currentUserId).orElseThrow();
        User sender = userRepository.findById(senderId).orElseThrow();
        Conversation conversation = conversationRepository.findByUsers(currentUser, sender).orElseThrow();

        List<Message> unread = messageRepository.findByConversationAndSenderAndStatusNot(conversation, sender, com.nexchat.model.MessageStatus.READ);
        for(Message m : unread) {
            m.setStatus(com.nexchat.model.MessageStatus.READ);
        }
        messageRepository.saveAll(unread);
        
        // Notify the sender that their messages were read
        if (!unread.isEmpty()) {
            messagingTemplate.convertAndSendToUser(
                sender.getEmail(), 
                "/queue/messages", 
                ChatMessageResponse.builder()
                    .id(-1L) // Special ID to indicate status update
                    .senderId(currentUserId)
                    .recipientId(senderId)
                    .content("READ_RECEIPT")
                    .status("READ")
                    .build()
            );
        }
    }

    @Transactional(readOnly = true)
    public List<ChatMessageResponse> syncMessages(Long userId, Long lastMessageId) {
        List<Message> privateMsgs = messageRepository.findMessagesToSync(userId, lastMessageId);
        List<com.nexchat.model.GroupMessage> groupMsgs = groupMessageRepository.findGroupMessagesToSync(userId, lastMessageId);

        List<ChatMessageResponse> responses = new java.util.ArrayList<>();

        for (Message msg : privateMsgs) {
            Long recipientId = msg.getConversation().getUser1().getId().equals(userId) ? msg.getConversation().getUser2().getId() : msg.getConversation().getUser1().getId();
            responses.add(mapToResponse(msg, recipientId));
        }

        for (com.nexchat.model.GroupMessage msg : groupMsgs) {
            responses.add(ChatMessageResponse.builder()
                    .id(msg.getId())
                    .senderId(msg.getSender().getId())
                    .recipientId(msg.getGroup().getId())
                    .senderName(msg.getSender().getProfile() != null ? msg.getSender().getProfile().getFullName() : msg.getSender().getEmail())
                    .content(msg.getContent())
                    .clientMessageId(msg.getClientMessageId())
                    .attachmentUrl(msg.getAttachmentUrl())
                    .status("GROUP")
                    .sentiment(msg.getSentiment())
                    .spamScore(msg.getSpamScore())
                    .isEdited(msg.isEdited())
                    .isDeleted(msg.isDeleted())
                    .replyToMessageId(msg.getReplyToMessageId())
                    .reactions(msg.getReactions())
                    .timestamp(msg.getCreatedAt())
                    .expiresAt(msg.getExpiresAt())
                    .build());
        }

        responses.sort((m1, m2) -> m1.getTimestamp().compareTo(m2.getTimestamp()));
        return responses;
    }

    private ChatMessageResponse mapToResponse(Message message, Long recipientId) {
        return ChatMessageResponse.builder()
                .id(message.getId())
                .senderId(message.getSender().getId())
                .recipientId(recipientId)
                .senderName(message.getSender().getProfile().getFullName())
                .content(message.getContent())
                .clientMessageId(message.getClientMessageId())
                .attachmentUrl(message.getAttachmentUrl())
                .status(message.getStatus().name())
                .sentiment(message.getSentiment())
                .spamScore(message.getSpamScore())
                .isEdited(message.isEdited())
                .isDeleted(message.isDeleted())
                .replyToMessageId(message.getReplyToMessageId())
                .reactions(message.getReactions())
                .timestamp(message.getCreatedAt())
                .expiresAt(message.getExpiresAt())
                .build();
    }
}
