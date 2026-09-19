package com.nexchat.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class ChatMessageRequest {
    private Long recipientId;
    private String content;
    private String clientMessageId;
    private String attachmentUrl;
    private Long replyToMessageId;
    private Integer expiresInSeconds;
}
