package com.nexchat.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class PerformanceStatsResponse {
    private int activeWebSocketUsers;
    private long usedMemoryMB;
    private long maxMemoryMB;
    private int activeThreads;
    private double systemLoadAverage;
    private int availableProcessors;
}
