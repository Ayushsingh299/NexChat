package com.nexchat.service;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class DatabaseMigrationService {
    private final JdbcTemplate jdbcTemplate;

    @PostConstruct
    public void migrate() {
        try {
            log.info("Running manual database schema fixes...");
            jdbcTemplate.execute("ALTER TABLE group_messages ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;");
            jdbcTemplate.execute("ALTER TABLE group_messages ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT FALSE;");
            jdbcTemplate.execute("ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;");
            jdbcTemplate.execute("ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT FALSE;");
            
            // Also ensure expires_at exists just in case
            jdbcTemplate.execute("ALTER TABLE group_messages ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;");
            jdbcTemplate.execute("ALTER TABLE messages ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;");
            
            // And reactions / replyToMessageId
            jdbcTemplate.execute("ALTER TABLE group_messages ADD COLUMN IF NOT EXISTS reactions TEXT;");
            jdbcTemplate.execute("ALTER TABLE group_messages ADD COLUMN IF NOT EXISTS reply_to_message_id BIGINT;");
            
            log.info("Database schema fixes completed successfully.");
        } catch (Exception e) {
            log.error("Failed to run manual database schema fixes", e);
        }
    }
}
