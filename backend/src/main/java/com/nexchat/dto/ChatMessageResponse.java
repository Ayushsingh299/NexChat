package com.nexchat.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class ChatMessageResponse {
    private Long id;
    private Long senderId;
    private Long recipientId;
    private String senderName;
    private String content;
    private String clientMessageId;
    private String attachmentUrl;
    private String status;
    private String sentiment;
    private Double spamScore;
    private boolean isEdited;
    private boolean isDeleted;
    private Long replyToMessageId;
    private String reactions;
    private LocalDateTime timestamp;
    private LocalDateTime expiresAt;
}
