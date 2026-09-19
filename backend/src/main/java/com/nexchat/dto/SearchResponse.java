package com.nexchat.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SearchResponse {
    private List<UserResult> users;
    private List<GroupResult> groups;
    private List<MessageResult> messages;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UserResult {
        private Long id;
        private String name;
        private String email;
        private String avatarUrl;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class GroupResult {
        private Long id;
        private String name;
        private String description;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MessageResult {
        private Long id;
        private String content;
        private String type; // "DIRECT" or "GROUP"
        private Long targetId; // conversationId or groupId
        private String senderName;
        private java.time.LocalDateTime timestamp;
    }
}
