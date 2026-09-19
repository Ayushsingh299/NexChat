package com.nexchat.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "conversations")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Conversation {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // For 1-to-1 chat, we'll store user1 and user2
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "user1_id", nullable = false)
    private User user1;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "user2_id", nullable = false)
    private User user2;

    @OneToMany(mappedBy = "conversation", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<Message> messages = new ArrayList<>();

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "user1_pinned", columnDefinition = "boolean default false")
    private boolean user1Pinned = false;

    @Column(name = "user2_pinned", columnDefinition = "boolean default false")
    private boolean user2Pinned = false;

    @Column(name = "user1_muted", columnDefinition = "boolean default false")
    private boolean user1Muted = false;

    @Column(name = "user2_muted", columnDefinition = "boolean default false")
    private boolean user2Muted = false;

    @Column(name = "user1_archived", columnDefinition = "boolean default false")
    private boolean user1Archived = false;

    @Column(name = "user2_archived", columnDefinition = "boolean default false")
    private boolean user2Archived = false;

    @Column(name = "user1_unread_count", columnDefinition = "integer default 0")
    private int user1UnreadCount = 0;

    @Column(name = "user2_unread_count", columnDefinition = "integer default 0")
    private int user2UnreadCount = 0;

    @PrePersist
    protected void onCreate() { 
        createdAt = LocalDateTime.now(); 
        updatedAt = LocalDateTime.now(); 
    }

    @PreUpdate
    protected void onUpdate() { 
        updatedAt = LocalDateTime.now(); 
    }
}
