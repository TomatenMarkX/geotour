package de.mplat.geotour.service;

import de.mplat.geotour.entity.RefreshToken;
import de.mplat.geotour.entity.RefreshTokenRepository;
import de.mplat.geotour.entity.User;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;

@Service
public class RefreshTokenService {
    private final RefreshTokenRepository refreshTokenRepository;
    public static final Duration REFRESH_TOKEN_VALIDITY = Duration.ofDays(30);

    public RefreshTokenService(RefreshTokenRepository refreshTokenRepository) {
        this.refreshTokenRepository = refreshTokenRepository;
    }

    public String createRefreshToken(User user) {
        byte[] randomBytes = new byte[32];
        new SecureRandom().nextBytes(randomBytes);
        String refreshToken = Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes);

        refreshTokenRepository.save(new RefreshToken(user, hash(refreshToken), Instant.now().plus(REFRESH_TOKEN_VALIDITY)));
        return refreshToken;
    }

    private String hash(String input) {
        try {
            byte[] bytes = MessageDigest.getInstance("SHA-256").digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(bytes);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    @Transactional
    public String rotate(String token) {
        if(token == null) throw new IllegalArgumentException("Token must not be null");

        Optional<RefreshToken> refreshToken = refreshTokenRepository.findByTokenHash(hash(token));
        if(refreshToken.isEmpty()) throw new BadCredentialsException("Token not found");

        RefreshToken stored = refreshToken.get();
        if(stored.getRevokedAt() != null) throw new BadCredentialsException("Token already revoked");
        if (stored.getExpiresAt().isBefore(Instant.now())) throw new BadCredentialsException("Refresh-Token abgelaufen");

        stored.revoke();
        User user = stored.getUser();
        return createRefreshToken(user);
    }

    @Transactional
    public void revokeAll(User user) {
        List<RefreshToken> tokens = refreshTokenRepository.findByUserAndRevokedAtIsNull(user);
        if(!tokens.isEmpty()) {
            for(RefreshToken token : tokens) {
                token.revoke();
                refreshTokenRepository.save(token);
            }
        }
    }
}
