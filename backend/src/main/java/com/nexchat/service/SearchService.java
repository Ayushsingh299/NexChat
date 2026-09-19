package com.nexchat.service;

import com.nexchat.dto.SearchResponse;
import com.nexchat.model.ChatGroup;
import com.nexchat.model.GroupMessage;
import com.nexchat.model.Message;
import com.nexchat.model.User;
import com.nexchat.repository.ChatGroupRepository;
import com.nexchat.repository.GroupMessageRepository;
import com.nexchat.repository.MessageRepository;
import com.nexchat.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SearchService {

    private final UserRepository userRepository;
    private final ChatGroupRepository chatGroupRepository;
    private final MessageRepository messageRepository;
    private final GroupMessageRepository groupMessageRepository;

    @Transactional(readOnly = true)
    public SearchResponse globalSearch(Long currentUserId, String query) {
        // 1. Search Users
        List<User> users = userRepository.findByProfileFullNameContainingIgnoreCaseOrEmailContainingIgnoreCase(query, query);
        List<SearchResponse.UserResult> userResults = users.stream()
                .filter(u -> !u.getId().equals(currentUserId))
                .map(u -> SearchResponse.UserResult.builder()
                        .id(u.getId())
                        .name(u.getProfile() != null ? u.getProfile().getFullName() : "Unknown")
                        .email(u.getEmail())
                        .avatarUrl(u.getProfile() != null ? u.getProfile().getAvatarUrl() : null)
                        .build())
                .collect(Collectors.toList());

        // 2. Search Groups (For now, any group matching name/desc)
        List<ChatGroup> groups = chatGroupRepository.findByNameContainingIgnoreCaseOrDescriptionContainingIgnoreCase(query, query);
        List<SearchResponse.GroupResult> groupResults = groups.stream()
                .map(g -> SearchResponse.GroupResult.builder()
                        .id(g.getId())
                        .name(g.getName())
                        .description(g.getDescription())
                        .build())
                .collect(Collectors.toList());

        // 3. Search Direct Messages
        List<Message> directMsgs = messageRepository.searchUserMessages(currentUserId, query);
        List<SearchResponse.MessageResult> msgResults = directMsgs.stream()
                .map(m -> SearchResponse.MessageResult.builder()
                        .id(m.getId())
                        .content(m.getContent())
                        .type("DIRECT")
                        .targetId(m.getConversation().getUser1().getId().equals(currentUserId) ? m.getConversation().getUser2().getId() : m.getConversation().getUser1().getId())
                        .senderName(m.getSender().getProfile().getFullName())
                        .timestamp(m.getCreatedAt())
                        .build())
                .collect(Collectors.toList());

        // 4. Search Group Messages
        List<GroupMessage> groupMsgs = groupMessageRepository.searchUserGroupMessages(currentUserId, query);
        msgResults.addAll(groupMsgs.stream()
                .map(gm -> SearchResponse.MessageResult.builder()
                        .id(gm.getId())
                        .content(gm.getContent())
                        .type("GROUP")
                        .targetId(gm.getGroup().getId())
                        .senderName(gm.getSender().getProfile().getFullName())
                        .timestamp(gm.getCreatedAt())
                        .build())
                .collect(Collectors.toList()));

        // Sort messages by latest
        msgResults.sort((m1, m2) -> m2.getTimestamp().compareTo(m1.getTimestamp()));

        return SearchResponse.builder()
                .users(userResults)
                .groups(groupResults)
                .messages(msgResults)
                .build();
    }
}
