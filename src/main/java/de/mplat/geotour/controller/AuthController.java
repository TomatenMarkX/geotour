package de.mplat.geotour.controller;

import de.mplat.geotour.factory.RefreshCookieFactory;
import de.mplat.geotour.service.RefreshTokenService;
import de.mplat.geotour.service.TokenService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/auth")
public class AuthController {
    private final RefreshTokenService refreshTokenService;
    private final TokenService tokenService;
    private final RefreshCookieFactory refreshCookieFactory;

    public AuthController(RefreshTokenService refreshTokenService, TokenService tokenService, RefreshCookieFactory refreshCookieFactory) {
        this.refreshTokenService = refreshTokenService;
        this.tokenService = tokenService;
        this.refreshCookieFactory = refreshCookieFactory;
    }

    @PostMapping("/refresh")
    public ResponseEntity<RefreshAnswer> refresh(@CookieValue(value = "refresh_token", required = false) String refreshToken) {
        if (refreshToken == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        try {
            RefreshTokenService.TokenRotate rotatedRefreshToken = refreshTokenService.rotate(refreshToken);
            String newAccessToken = tokenService.createAccessToken(rotatedRefreshToken.user());

            return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, refreshCookieFactory.create(rotatedRefreshToken.refreshToken()).toString()).body(new RefreshAnswer(newAccessToken, 900));
        } catch (BadCredentialsException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).header(HttpHeaders.SET_COOKIE, refreshCookieFactory.delete().toString()).build();
        }
    }

    private record RefreshAnswer(String accessToken, long expiresIn){}
}
