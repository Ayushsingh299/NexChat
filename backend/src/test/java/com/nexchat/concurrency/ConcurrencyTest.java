package com.nexchat.concurrency;

import com.nexchat.dto.ChatMessageRequest;
import com.nexchat.dto.ChatMessageResponse;
import com.nexchat.service.ChatService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

import com.nexchat.service.GroupService;
import org.springframework.data.redis.core.RedisTemplate;
import com.nexchat.repository.UserRepository;
import com.nexchat.model.User;
import com.nexchat.model.Profile;
import java.util.Optional;
import org.springframework.data.redis.core.StreamOperations;

public class ConcurrencyTest {

    @Mock
    private ChatService chatService;
    
    @Mock
    private GroupService groupService;

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @Mock
    private RedisTemplate<String, Object> redisTemplate;

    @Mock
    private Executor taskExecutor;
    
    @Mock
    private UserRepository userRepository;

    @Mock
    private StreamOperations<String, Object, Object> streamOperations;

    private AsyncMessageProcessor asyncMessageProcessor;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        
        // Use a real executor for the test to actually run threads
        Executor realExecutor = Executors.newFixedThreadPool(5);
        asyncMessageProcessor = new AsyncMessageProcessor(chatService, groupService, messagingTemplate, redisTemplate, userRepository, realExecutor);
        
        when(redisTemplate.opsForStream()).thenReturn(streamOperations);
        
        // Mock the user repository
        User mockUser = new User();
        mockUser.setId(1L);
        when(userRepository.findById(anyLong())).thenReturn(Optional.of(mockUser));
        
        // Mock the chat service response
        when(chatService.saveMessage(anyLong(), any(ChatMessageRequest.class)))
                .thenReturn(ChatMessageResponse.builder().build());
                
        // Start the consumers as would happen in @PostConstruct
        asyncMessageProcessor.startConsumers();
    }

    @Test
    void testConcurrentMessageEnqueueingAndProcessing() throws InterruptedException {
        int numberOfThreads = 100;
        int messagesPerThread = 10;
        int totalMessages = numberOfThreads * messagesPerThread;

        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(numberOfThreads);
        
        // This atomic integer tracks how many times our mock was called
        AtomicInteger processedCount = new AtomicInteger(0);

        doAnswer(invocation -> {
            processedCount.incrementAndGet();
            return ChatMessageResponse.builder().build();
        }).when(chatService).saveMessage(anyLong(), any(ChatMessageRequest.class));

        // Create 100 threads, each sending 10 messages simultaneously
        for (int i = 0; i < numberOfThreads; i++) {
            new Thread(() -> {
                try {
                    startLatch.await(); // wait for all threads to be ready
                    for (int j = 0; j < messagesPerThread; j++) {
                        ChatMessageRequest req = new ChatMessageRequest();
                        req.setRecipientId(2L);
                        req.setContent("Test Message");
                        asyncMessageProcessor.enqueueMessage(1L, req);
                    }
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                } finally {
                    doneLatch.countDown();
                }
            }).start();
        }

        // Start all threads at once to maximize concurrency
        startLatch.countDown();
        doneLatch.await(); // wait for all threads to finish enqueueing

        // Give consumer threads a brief moment to process the queue
        Thread.sleep(1000);

        // Verify that the ChatService was called exactly totalMessages times
        verify(chatService, times(totalMessages)).saveMessage(anyLong(), any(ChatMessageRequest.class));
        assertEquals(totalMessages, processedCount.get(), "Not all messages were processed by the worker threads");
    }
}
