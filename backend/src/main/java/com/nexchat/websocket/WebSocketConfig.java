package com.nexchat.websocket;

import com.nexchat.security.JwtService;
import com.nexchat.repository.UserSessionRepository;
import com.nexchat.repository.GroupMemberRepository;
import com.nexchat.model.User;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;
    private final UserSessionRepository sessionRepository;
    private final GroupMemberRepository groupMemberRepository;

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.enableSimpleBroker("/topic", "/queue");
        config.setApplicationDestinationPrefixes("/app");
        config.setUserDestinationPrefix("/user");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOrigins("http://localhost:5173")
                .withSockJS();
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
                if (accessor != null && StompCommand.CONNECT.equals(accessor.getCommand())) {
                    String authHeader = accessor.getFirstNativeHeader("Authorization");
                    if (authHeader != null && authHeader.startsWith("Bearer ")) {
                        String token = authHeader.substring(7);
                        String username = jwtService.extractUsername(token);
                        if (username != null) {
                            UserDetails userDetails = userDetailsService.loadUserByUsername(username);
                            if (jwtService.isTokenValid(token, userDetails)) {
                                String jti = jwtService.extractJti(token);
                                if (jti != null && sessionRepository.findByTokenId(jti).isPresent()) {
                                    UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                                            userDetails, null, userDetails.getAuthorities()) {
                                        @Override
                                        public String getName() {
                                            return String.valueOf(((User) getPrincipal()).getId());
                                        }
                                    };
                                    SecurityContextHolder.getContext().setAuthentication(authentication);
                                    accessor.setUser(authentication);
                                }
                            }
                        }
                    }
                } else if (accessor != null && StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
                    String destination = accessor.getDestination();
                    if (accessor.getUser() instanceof UsernamePasswordAuthenticationToken) {
                        User user = (User) ((UsernamePasswordAuthenticationToken) accessor.getUser()).getPrincipal();
                        
                        if (destination != null) {
                            // Check private queue subscription
                            if (destination.startsWith("/user/") && !destination.startsWith("/user/" + user.getId() + "/")) {
                                throw new IllegalArgumentException("Unauthorized: Cannot subscribe to another user's queue");
                            }
                            
                            // Check group topic subscription
                            if (destination.startsWith("/topic/group.")) {
                                try {
                                    String groupIdStr = destination.split("\\.")[1].replace(".typing", "");
                                    Long groupId = Long.parseLong(groupIdStr);
                                    if (!groupMemberRepository.existsByGroupIdAndUserId(groupId, user.getId())) {
                                        throw new IllegalArgumentException("Unauthorized: Not a member of this group");
                                    }
                                } catch (Exception e) {
                                    throw new IllegalArgumentException("Unauthorized: Invalid group subscription");
                                }
                            }
                        }
                    } else {
                        throw new IllegalArgumentException("Unauthorized: User not authenticated");
                    }
                }
                return message;
            }
        });
    }
}
