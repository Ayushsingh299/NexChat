package com.nexchat.repository;

import com.nexchat.model.ChatGroup;
import com.nexchat.model.GroupMember;
import com.nexchat.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface GroupMemberRepository extends JpaRepository<GroupMember, Long> {
    List<GroupMember> findByUser(User user);
    List<GroupMember> findByGroup(ChatGroup group);
    Optional<GroupMember> findByGroupAndUser(ChatGroup group, User user);
    boolean existsByGroupAndUser(ChatGroup group, User user);
    boolean existsByGroupIdAndUserId(Long groupId, Long userId);
}
