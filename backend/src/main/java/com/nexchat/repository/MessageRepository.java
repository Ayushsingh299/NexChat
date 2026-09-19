package com.nexchat.repository;

import com.nexchat.model.Conversation;
import com.nexchat.model.Message;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface MessageRepository extends JpaRepository<Message, Long> {
    java.util.Optional<Message> findByClientMessageId(String clientMessageId);
    List<Message> findByConversationOrderByCreatedAtAsc(Conversation conversation);
    List<Message> findByConversationAndSenderAndStatusNot(Conversation conversation, com.nexchat.model.User sender, com.nexchat.model.MessageStatus status);
    
    long countByCreatedAtAfter(LocalDateTime date);
    
    long countBySentiment(String sentiment);
    List<Message> findBySentiment(String sentiment);
    List<Message> findByExpiresAtBefore(java.time.LocalDateTime date);
    
    @Query("SELECT m FROM Message m WHERE m.conversation.user1.id = :userId OR m.conversation.user2.id = :userId AND LOWER(m.content) LIKE LOWER(CONCAT('%', :query, '%'))")
    List<Message> searchUserMessages(@Param("userId") Long userId, @Param("query") String query);

    @Query("SELECT m FROM Message m WHERE (m.conversation.user1.id = :userId OR m.conversation.user2.id = :userId) AND m.id > :lastMessageId ORDER BY m.id ASC")
    List<Message> findMessagesToSync(@Param("userId") Long userId, @Param("lastMessageId") Long lastMessageId);
    
    @Query("SELECT m FROM Message m WHERE (m.conversation.user1.id = :userId OR m.conversation.user2.id = :userId) AND m.createdAt > :timestamp")
    List<Message> findMissedMessages(@Param("userId") Long userId, @Param("timestamp") LocalDateTime timestamp);
}
