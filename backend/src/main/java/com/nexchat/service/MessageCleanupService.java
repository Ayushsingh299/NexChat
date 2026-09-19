package com.nexchat.service;

import com.nexchat.model.Message;
import com.nexchat.model.GroupMessage;
import com.nexchat.repository.MessageRepository;
import com.nexchat.repository.GroupMessageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class MessageCleanupService {

    private final MessageRepository messageRepository;
    private final GroupMessageRepository groupMessageRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @Scheduled(fixedRate = 60000) // Run every 60 seconds
    @Transactional
    public void cleanupExpiredMessages() {
        LocalDateTime now = LocalDateTime.now();
        log.debug("Running expired message cleanup job at {}", now);

        // Cleanup direct messages
        List<Message> expiredMessages = messageRepository.findByExpiresAtBefore(now);
        for (Message msg : expiredMessages) {
            log.info("Deleting expired message ID: {}", msg.getId());
            msg.setContent("This message has expired");
            msg.setDeleted(true);
            msg.setAttachmentUrl(null);
            msg.setExpiresAt(null); // Clear expiration to prevent picking it up again
            
            Message saved = messageRepository.save(msg);
            
            // Notify clients to remove it
            messagingTemplate.convertAndSendToUser(
                    String.valueOf(msg.getConversation().getUser1().getId()),
                    "/queue/messages",
                    com.nexchat.dto.ChatMessageResponse.builder().id(msg.getId()).isDeleted(true).build()
            );
            messagingTemplate.convertAndSendToUser(
                    String.valueOf(msg.getConversation().getUser2().getId()),
                    "/queue/messages",
                    com.nexchat.dto.ChatMessageResponse.builder().id(msg.getId()).isDeleted(true).build()
            );
        }

        // Cleanup group messages
        List<GroupMessage> expiredGroupMessages = groupMessageRepository.findByExpiresAtBefore(now);
        for (GroupMessage msg : expiredGroupMessages) {
            log.info("Deleting expired group message ID: {}", msg.getId());
            msg.setContent("This message has expired");
            msg.setDeleted(true);
            msg.setAttachmentUrl(null);
            msg.setExpiresAt(null);
            
            GroupMessage saved = groupMessageRepository.save(msg);
            
            // Notify clients
            messagingTemplate.convertAndSend(
                    "/topic/group." + msg.getGroup().getId(),
                    com.nexchat.dto.ChatMessageResponse.builder().id(msg.getId()).isDeleted(true).status("GROUP").build()
            );
        }
    }
}
