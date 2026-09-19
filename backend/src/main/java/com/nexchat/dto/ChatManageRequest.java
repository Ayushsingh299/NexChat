package com.nexchat.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatManageRequest {
    private Boolean isPinned;
    private Boolean isMuted;
    private Boolean isArchived;
    private Boolean markAsRead;
}
