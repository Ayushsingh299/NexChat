package com.nexchat.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class AdminDashboardResponse {
    private long totalUsers;
    private long totalGroups;
    private long totalMessages;
    private long messagesToday;
    private long positiveSentimentCount;
    private long negativeSentimentCount;
    private long neutralSentimentCount;
    private long spamMessagesCount;
}
