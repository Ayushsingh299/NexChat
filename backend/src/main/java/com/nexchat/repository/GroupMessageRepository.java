package com.nexchat.repository;

import com.nexchat.model.ChatGroup;
import com.nexchat.model.GroupMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface GroupMessageRepository extends JpaRepository<GroupMessage, Long> {
    java.util.Optional<GroupMessage> findByClientMessageId(String clientMessageId);
    List<GroupMessage> findByGroupOrderByCreatedAtAsc(ChatGroup group);
    long countByCreatedAtAfter(java.time.LocalDateTime date);
    long countBySentiment(String sentiment);
    List<GroupMessage> findBySentiment(String sentiment);
    List<GroupMessage> findByExpiresAtBefore(java.time.LocalDateTime date);
    List<GroupMessage> findByGroup_IdInAndCreatedAtAfter(List<Long> groupIds, java.time.LocalDateTime date);
    
    @org.springframework.data.jpa.repository.Query("SELECT gm FROM GroupMessage gm JOIN gm.group g JOIN GroupMember m ON m.group.id = g.id WHERE m.user.id = :userId AND gm.id > :lastMessageId ORDER BY gm.id ASC")
    List<GroupMessage> findGroupMessagesToSync(@org.springframework.data.repository.query.Param("userId") Long userId, @org.springframework.data.repository.query.Param("lastMessageId") Long lastMessageId);

    @org.springframework.data.jpa.repository.Query("SELECT gm FROM GroupMessage gm JOIN gm.group g JOIN g.members m WHERE m.user.id = :userId AND LOWER(gm.content) LIKE LOWER(CONCAT('%', :query, '%'))")
    List<GroupMessage> searchUserGroupMessages(@org.springframework.data.repository.query.Param("userId") Long userId, @org.springframework.data.repository.query.Param("query") String query);

    @org.springframework.data.jpa.repository.Query("SELECT gm FROM GroupMessage gm JOIN gm.group g JOIN g.members m WHERE m.user.id = :userId AND gm.createdAt > :timestamp")
    List<GroupMessage> findMissedGroupMessages(@org.springframework.data.repository.query.Param("userId") Long userId, @org.springframework.data.repository.query.Param("timestamp") java.time.LocalDateTime timestamp);
}
