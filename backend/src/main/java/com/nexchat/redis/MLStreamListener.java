package com.nexchat.redis;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.connection.stream.MapRecord;
import org.springframework.data.redis.stream.StreamListener;
import org.springframework.stereotype.Service;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import java.util.Map;

@Service
@Slf4j
public class MLStreamListener implements StreamListener<String, MapRecord<String, String, String>> {

    @Autowired
    private MessageAnalyticsListener messageAnalyticsListener;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public void onMessage(MapRecord<String, String, String> message) {
        try {
            Map<String, String> value = message.getValue();
            String json = objectMapper.writeValueAsString(value);
            messageAnalyticsListener.receiveMessage(json);
        } catch (Exception e) {
            log.error("Failed to process ML stream result", e);
        }
    }
}
