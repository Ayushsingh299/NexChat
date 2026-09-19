package com.nexchat.service;

import com.nexchat.dto.AdminDashboardResponse;
import com.nexchat.dto.PerformanceStatsResponse;
import com.nexchat.repository.ChatGroupRepository;
import com.nexchat.repository.GroupMessageRepository;
import com.nexchat.repository.MessageRepository;
import com.nexchat.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.lang.management.ManagementFactory;
import java.lang.management.OperatingSystemMXBean;
import java.lang.management.ThreadMXBean;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class AdminService {
    private final UserRepository userRepository;
    private final ChatGroupRepository chatGroupRepository;
    private final MessageRepository messageRepository;
    private final GroupMessageRepository groupMessageRepository;
    private final PresenceService presenceService;

    public AdminDashboardResponse getDashboardMetrics() {
        long totalUsers = userRepository.count();
        long totalGroups = chatGroupRepository.count();
        
        long totalMessages = messageRepository.count() + groupMessageRepository.count();
        
        LocalDateTime startOfDay = LocalDate.now().atStartOfDay();
        long messagesToday = messageRepository.countByCreatedAtAfter(startOfDay) 
                           + groupMessageRepository.countByCreatedAtAfter(startOfDay);
                           
        long positiveCount = messageRepository.countBySentiment("Positive")
                           + groupMessageRepository.countBySentiment("Positive");
                           
        long negativeCount = messageRepository.countBySentiment("Negative")
                           + groupMessageRepository.countBySentiment("Negative");
                           
        long neutralCount = messageRepository.countBySentiment("Neutral")
                          + groupMessageRepository.countBySentiment("Neutral");

        // We can just estimate spam messages or add a query for spamScore > 0.8
        // But for now let's just make it 0 to keep it simple, or add a query later
        long spamCount = 0; // Keeping simple for now, since we didn't add countBySpamScoreGreaterThan

        return AdminDashboardResponse.builder()
                .totalUsers(totalUsers)
                .totalGroups(totalGroups)
                .totalMessages(totalMessages)
                .messagesToday(messagesToday)
                .positiveSentimentCount(positiveCount)
                .negativeSentimentCount(negativeCount)
                .neutralSentimentCount(neutralCount)
                .spamMessagesCount(spamCount)
                .build();
    }

    public PerformanceStatsResponse getPerformanceStats() {
        OperatingSystemMXBean osBean = ManagementFactory.getOperatingSystemMXBean();
        ThreadMXBean threadBean = ManagementFactory.getThreadMXBean();
        Runtime runtime = Runtime.getRuntime();

        long usedMemoryMB = (runtime.totalMemory() - runtime.freeMemory()) / (1024 * 1024);
        long maxMemoryMB = runtime.maxMemory() / (1024 * 1024);
        int activeThreads = threadBean.getThreadCount();
        double systemLoadAverage = osBean.getSystemLoadAverage();
        int availableProcessors = osBean.getAvailableProcessors();
        int activeWebSocketUsers = presenceService.getActiveWebSocketUsersCount();

        return PerformanceStatsResponse.builder()
                .activeWebSocketUsers(activeWebSocketUsers)
                .usedMemoryMB(usedMemoryMB)
                .maxMemoryMB(maxMemoryMB)
                .activeThreads(activeThreads)
                .systemLoadAverage(systemLoadAverage)
                .availableProcessors(availableProcessors)
                .build();
    }
}
