package com.nexchat.service;

import com.nexchat.dto.GroupCreateRequest;
import com.nexchat.dto.GroupResponse;
import com.nexchat.dto.ChatMessageResponse;
import com.nexchat.model.*;
import com.nexchat.repository.ChatGroupRepository;
import com.nexchat.repository.GroupMemberRepository;
import com.nexchat.repository.GroupMessageRepository;
import com.nexchat.repository.UserRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class GroupService {

    private final ChatGroupRepository groupRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final GroupMessageRepository groupMessageRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Transactional
    public GroupResponse createGroup(Long creatorId, GroupCreateRequest request) {
        User creator = userRepository.findById(creatorId).orElseThrow();

        ChatGroup group = ChatGroup.builder()
                .name(request.getName())
                .description(request.getDescription())
                .creator(creator)
                .build();
        
        final ChatGroup savedGroup = groupRepository.save(group);

        // Add creator as ADMIN
        GroupMember adminMember = GroupMember.builder()
                .group(savedGroup)
                .user(creator)
                .role(GroupRole.ADMIN)
                .build();
        groupMemberRepository.save(adminMember);

        // Add other members
        if (request.getMemberIds() != null) {
            for (Long memberId : request.getMemberIds()) {
                if (!memberId.equals(creatorId)) {
                    userRepository.findById(memberId).ifPresent(user -> {
                        GroupMember member = GroupMember.builder()
                                .group(savedGroup)
                                .user(user)
                                .role(GroupRole.MEMBER)
                                .build();
                        groupMemberRepository.save(member);
                    });
                }
            }
        }

        return mapToGroupResponse(savedGroup);
    }

    public List<GroupResponse> getUserGroups(Long userId) {
        User user = userRepository.findById(userId).orElseThrow();
        return groupMemberRepository.findByUser(user).stream()
                .map(GroupMember::getGroup)
                .map(this::mapToGroupResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<ChatMessageResponse> getGroupMessages(Long groupId, Long userId) {
        ChatGroup group = groupRepository.findById(groupId).orElseThrow();
        User user = userRepository.findById(userId).orElseThrow();
        
        if (!groupMemberRepository.existsByGroupAndUser(group, user)) {
            throw new RuntimeException("User is not a member of this group");
        }

        return groupMessageRepository.findByGroupOrderByCreatedAtAsc(group).stream()
                .map(msg -> mapToGroupMessageResponse(msg, groupId))
                .collect(Collectors.toList());
    }

    @Transactional
    public ChatMessageResponse toggleReaction(Long userId, Long messageId, String emoji) {
        GroupMessage msg = groupMessageRepository.findById(messageId)
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
            GroupMessage saved = groupMessageRepository.save(msg);
            
            return mapToGroupMessageResponse(saved, saved.getGroup().getId());
        } catch (Exception e) {
            throw new RuntimeException("Failed to toggle reaction", e);
        }
    }

    private ChatMessageResponse mapToGroupMessageResponse(GroupMessage savedMessage, Long groupId) {
        return ChatMessageResponse.builder()
                .id(savedMessage.getId())
                .senderId(savedMessage.getSender().getId())
                .recipientId(groupId)
                .senderName(savedMessage.getSender().getProfile() != null ? savedMessage.getSender().getProfile().getFullName() : savedMessage.getSender().getEmail())
                .content(savedMessage.getContent())
                .attachmentUrl(savedMessage.getAttachmentUrl())
                .status("GROUP")
                .sentiment(savedMessage.getSentiment())
                .spamScore(savedMessage.getSpamScore())
                .isEdited(savedMessage.isEdited())
                .isDeleted(savedMessage.isDeleted())
                .replyToMessageId(savedMessage.getReplyToMessageId())
                .reactions(savedMessage.getReactions())
                .timestamp(savedMessage.getCreatedAt())
                .expiresAt(savedMessage.getExpiresAt())
                .build();
    }

    @Transactional
    public ChatMessageResponse saveGroupMessage(Long senderId, Long groupId, String content, String attachmentUrl, Integer expiresInSeconds, String clientMessageId) {
        if (clientMessageId != null) {
            java.util.Optional<GroupMessage> existing = groupMessageRepository.findByClientMessageId(clientMessageId);
            if (existing.isPresent()) {
                GroupMessage msg = existing.get();
                return ChatMessageResponse.builder()
                        .id(msg.getId())
                        .senderId(msg.getSender().getId())
                        .recipientId(groupId)
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
                        .build();
            }
        }

        User sender = userRepository.findById(senderId).orElseThrow();
        ChatGroup group = groupRepository.findById(groupId).orElseThrow();

        if (!groupMemberRepository.existsByGroupAndUser(group, sender)) {
            throw new RuntimeException("Sender is not a member of this group");
        }

        GroupMessage msg = GroupMessage.builder()
                .group(group)
                .sender(sender)
                .content(content)
                .clientMessageId(clientMessageId)
                .attachmentUrl(attachmentUrl)
                .expiresAt(expiresInSeconds != null ? java.time.LocalDateTime.now().plusSeconds(expiresInSeconds) : null)
                .build();
                
        msg = groupMessageRepository.save(msg);
        
        group.setUpdatedAt(msg.getCreatedAt());
        groupRepository.save(group);

        return ChatMessageResponse.builder()
                .id(msg.getId())
                .senderId(sender.getId())
                .recipientId(groupId)
                .senderName(sender.getProfile() != null ? sender.getProfile().getFullName() : sender.getEmail())
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
                .build();
    }

    private GroupResponse mapToGroupResponse(ChatGroup group) {
        int count = groupMemberRepository.findByGroup(group).size();
        return GroupResponse.builder()
                .id(group.getId())
                .name(group.getName())
                .description(group.getDescription())
                .memberCount(count)
                .build();
    }

    @Transactional
    public void leaveGroup(Long groupId, Long userId) {
        ChatGroup group = groupRepository.findById(groupId).orElseThrow();
        User user = userRepository.findById(userId).orElseThrow();
        
        GroupMember member = groupMemberRepository.findByGroup(group).stream()
            .filter(m -> m.getUser().getId().equals(userId))
            .findFirst()
            .orElseThrow(() -> new RuntimeException("Member not found"));
            
        groupMemberRepository.delete(member);
    }

    @Transactional
    public void addMembers(Long currentUserId, Long groupId, List<Long> memberIds) {
        ChatGroup group = groupRepository.findById(groupId).orElseThrow();
        User currentUser = userRepository.findById(currentUserId).orElseThrow();
        
        if (!groupMemberRepository.existsByGroupAndUser(group, currentUser)) {
            throw new RuntimeException("Only members can add new members");
        }
        
        if (memberIds == null || memberIds.isEmpty()) return;
        
        for (Long memberId : memberIds) {
            User newMember = userRepository.findById(memberId).orElseThrow();
            if (!groupMemberRepository.existsByGroupAndUser(group, newMember)) {
                GroupMember gm = GroupMember.builder()
                        .group(group)
                        .user(newMember)
                        .role(com.nexchat.model.GroupRole.MEMBER)
                        .build();
                groupMemberRepository.save(gm);
            }
        }
    }

    @Transactional(readOnly = true)
    public List<Long> getGroupMemberIds(Long groupId, Long currentUserId) {
        ChatGroup group = groupRepository.findById(groupId).orElseThrow();
        User currentUser = userRepository.findById(currentUserId).orElseThrow();
        if (!groupMemberRepository.existsByGroupAndUser(group, currentUser)) {
            throw new RuntimeException("Not a member");
        }
        return groupMemberRepository.findByGroup(group).stream()
                .map(m -> m.getUser().getId())
                .collect(Collectors.toList());
    }

    @Transactional
    public void manageGroup(Long userId, Long groupId, com.nexchat.dto.ChatManageRequest request) {
        ChatGroup group = groupRepository.findById(groupId).orElseThrow();
        
        GroupMember member = groupMemberRepository.findByGroup(group).stream()
            .filter(m -> m.getUser().getId().equals(userId))
            .findFirst()
            .orElseThrow(() -> new RuntimeException("Member not found"));
            
        if (request.getIsPinned() != null) member.setPinned(request.getIsPinned());
        if (request.getIsMuted() != null) member.setMuted(request.getIsMuted());
        if (request.getIsArchived() != null) member.setArchived(request.getIsArchived());
        if (request.getMarkAsRead() != null && request.getMarkAsRead()) member.setUnreadCount(0);
        
        groupMemberRepository.save(member);
    }
}
